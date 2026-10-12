import { db } from "hatchable";
import { indexProposals } from "lib/nvidia.js";

export const access = "user";
export const methods = ["POST"];

const REVIEW = ["Admin", "Reviewer", "SI", "SHO / Inspector"];
const APPROVE = ["Admin", "Approving Officer", "SI", "SHO / Inspector"];
const STAFF = ["Admin", "Reviewer", "Approving Officer", "Implementation Officer", "SI", "SHO / Inspector"];

export default async function (req, res) {
  const user = req.user;
  const id = String(req.params.id || "");
  const action = String((req.body || {}).action || "");
  const reason = String((req.body || {}).reason || "").trim().slice(0, 1200);
  const { rows: profiles } = await db.query("SELECT role, station_code,active,si_approved FROM app_profiles WHERE user_id = $1", [user.id]);
  if (!profiles.length || profiles[0].active === false || (!profiles[0].si_approved && !["Admin","SI"].includes(profiles[0].role))) return res.status(403).json({ error: "Access not approved or account inactive. Ask your Station SI." });
  const role = profiles[0].role;
  const stationCode = profiles[0]?.station_code || null;
  const stationWide = ["Admin","SI","SHO / Inspector"].includes(role);
  const { rows: proposals } = await db.query("SELECT * FROM proposals WHERE id = $1 AND (demo_data = TRUE OR owner_id = $2 OR ($3::boolean = TRUE AND station_code = $4))", [id, user.id, stationWide, stationCode]);
  if (!proposals.length) return res.status(404).json({ error: "Proposal not found or access denied. Demo proposals are read-only." });
  const p = proposals[0];
  if (p.demo_data) return res.status(403).json({ error: "Sample proposals are read-only." });
  const own = p.owner_id === user.id;
  let to = p.status;
  let allowed = false;
  if (action === "submit" && own && ["Draft", "Returned"].includes(p.status)) { to = "Submitted"; allowed = true; }
  if (action === "review" && REVIEW.includes(role) && p.status === "Submitted") { to = "Under Review"; allowed = true; }
  if (action === "recommend" && REVIEW.includes(role) && p.status === "Under Review") { to = "Recommended"; allowed = true; }
  if (action === "return" && ["Admin", "Reviewer", "Approving Officer", "SI"].includes(role) && ["Submitted", "Under Review", "Recommended"].includes(p.status)) { to = "Returned"; allowed = true; }
  if (action === "approve" && APPROVE.includes(role) && p.status === "Recommended") { to = "Approved"; allowed = true; }
  if (action === "reject" && APPROVE.includes(role) && p.status === "Recommended") { to = "Rejected"; allowed = true; }
  if (!allowed) return res.status(403).json({ error: "This action is not permitted for your role or the proposal's current status.", current_status: p.status, role });
  await db.query("UPDATE proposals SET status=$2, decision=CASE WHEN $3 IN ('approve','reject') THEN $2 ELSE decision END, observations=$4, updated_at=NOW(), submitted_at=CASE WHEN $2='Submitted' THEN NOW() ELSE submitted_at END WHERE id=$1", [id, to, action, reason || null]);
  await db.query("INSERT INTO proposal_audit (proposal_id,actor_id,actor_email,action,from_status,to_status,reason) VALUES ($1,$2,$3,$4,$5,$6,$7)", [id,user.id,user.email,action,p.status,to,reason || null]);
  const type = ["approve","reject"].includes(action) ? "Decision" : (action === "return" ? "Modification" : (["review","recommend"].includes(action) ? "Observation" : null));
  if (type) await db.query("INSERT INTO proposal_decision_records (proposal_id,actor_id,actor_email,record_type,title,details) VALUES ($1,$2,$3,$4,$5,$6)", [id,user.id,user.email,type,to+" — "+p.id,reason || "No rationale recorded."]);
  // Keep workflow decisions responsive; archive embeddings can be refreshed through the precedent indexing workflow.
  res.json({ ok: true, id, status: to });
}