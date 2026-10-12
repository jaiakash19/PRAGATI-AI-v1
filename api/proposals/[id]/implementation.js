import { db } from "hatchable";
import { indexProposals } from "lib/nvidia.js";

export const access = "user";
export const methods = ["POST"];

export default async function (req, res) {
  const user = req.user;
  const id = String(req.params.id || "");
  const body = req.body || {};
  const milestone = String(body.milestone || "").trim().slice(0, 160);
  const evidence = String(body.evidence || "").trim().slice(0, 3000);
  const progress = Number(body.progress);
  if (!milestone) return res.status(400).json({ error: "Milestone is required." });
  if (!Number.isInteger(progress) || progress < 0 || progress > 100) return res.status(400).json({ error: "Progress must be between 0 and 100." });
  const { rows: prof } = await db.query("SELECT role, station_code,active,si_approved FROM app_profiles WHERE user_id = $1", [user.id]);
  if (!prof.length || prof[0].active === false || (!prof[0].si_approved && !["Admin","SI"].includes(prof[0].role))) return res.status(403).json({ error: "Access not approved or account inactive. Ask your Station SI." });
  const role = prof[0].role;
  const stationCode = prof[0]?.station_code || null;
  const stationWide = ["Admin","SI","SHO / Inspector"].includes(role);
  if (!["Admin", "Implementation Officer", "SI", "SHO / Inspector"].includes(role)) return res.status(403).json({ error: "Only station leadership, Implementation Officers and Admins can record implementation progress." });
  const { rows } = await db.query("SELECT * FROM proposals WHERE id = $1 AND demo_data = FALSE AND (owner_id=$2 OR ($3::boolean=TRUE AND station_code=$4))", [id,user.id,stationWide,stationCode]);
  if (!rows.length) return res.status(404).json({ error: "Proposal not found. Demo proposals are read-only." });
  const p = rows[0];
  if (!["Approved", "Implementing"].includes(p.status)) return res.status(409).json({ error: "Implementation can begin only after approval.", current_status: p.status });
  const nextStatus = progress >= 100 ? "Closed" : "Implementing";
  await db.query("UPDATE proposals SET progress=$2, implementation_notes=$3, outcome=CASE WHEN $2>=100 THEN $3 ELSE outcome END, status=$4, updated_at=NOW() WHERE id=$1", [id, progress, evidence || null, nextStatus]);
  await db.query("INSERT INTO implementation_updates (proposal_id,actor_id,actor_email,milestone,progress,evidence) VALUES ($1,$2,$3,$4,$5,$6)", [id,user.id,user.email,milestone,progress,evidence || null]);
  await db.query("INSERT INTO proposal_decision_records (proposal_id,actor_id,actor_email,record_type,title,details) VALUES ($1,$2,$3,'Outcome',$4,$5)", [id,user.id,user.email,"Implementation milestone: "+milestone,evidence || ("Progress recorded at "+progress+" percent.")]);
  if (nextStatus !== p.status) await db.query("INSERT INTO proposal_audit (proposal_id,actor_id,actor_email,action,from_status,to_status,reason) VALUES ($1,$2,$3,'Implementation progress updated',$4,$5,$6)", [id,user.id,user.email,p.status,nextStatus,milestone]);
  // Do not block implementation updates on the external embedding provider.
  res.json({ ok: true, id, status: nextStatus, progress });
}