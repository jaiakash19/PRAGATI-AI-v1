import { db } from "hatchable";
import { indexProposals } from "lib/nvidia.js";

export const access = "user";
export const methods = ["GET", "POST"];

const ROLES = {
  Decision: ["Admin", "Approving Officer", "SI", "SHO / Inspector"],
  Sanction: ["Admin", "Approving Officer", "SI", "SHO / Inspector"],
  Observation: ["Admin", "Reviewer", "Approving Officer", "Implementation Officer"],
  Modification: ["Admin", "Reviewer"],
  Outcome: ["Admin", "Implementation Officer"]
};
const STAFF = ["Admin", "Reviewer", "Approving Officer", "Implementation Officer", "SI", "SHO / Inspector"];

export default async function (req, res) {
  const user = req.user;
  const id = String(req.params.id || "");
  const { rows: profiles } = await db.query("SELECT role, station_code,active,si_approved FROM app_profiles WHERE user_id = $1", [user.id]);
  if (!profiles.length || profiles[0].active === false || (!profiles[0].si_approved && !["Admin","SI"].includes(profiles[0].role))) return res.status(403).json({ error: "Access not approved or account inactive. Ask your Station SI." });
  const role = profiles[0].role;
  const stationCode = profiles[0]?.station_code || null;
  const stationWide = ["Admin","SI","SHO / Inspector"].includes(role);
  const { rows: proposals } = await db.query(
    "SELECT * FROM proposals WHERE id=$1 AND (demo_data=TRUE OR owner_id=$2 OR ($3::boolean=TRUE AND station_code=$4) OR (common_report=TRUE AND status<>'Draft')) LIMIT 1",
    [id, user.id, stationWide, stationCode]
  );
  if (!proposals.length) return res.status(404).json({ error: "Proposal not found or access denied." });
  const p = proposals[0];
  if (req.method === "GET") {
    const { rows } = await db.query(
      "SELECT id,proposal_id,actor_email,record_type,title,details,reference_number,amount,currency,effective_date,created_at FROM proposal_decision_records WHERE proposal_id=$1 ORDER BY created_at DESC",
      [id]
    );
    return res.json({ records: rows });
  }
  if (role !== "Admin" && p.station_code !== stationCode) return res.status(403).json({ error: "Common reports from other stations are read-only." });
  if (p.demo_data) return res.status(403).json({ error: "Sample proposals are read-only." });
  const body = req.body || {};
  const type = String(body.record_type || "");
  if (!ROLES[type]) return res.status(400).json({ error: "Choose Decision, Sanction, Observation, Modification or Outcome." });
  if (!ROLES[type].includes(role)) return res.status(403).json({ error: "Your role cannot create this record type." });
  const title = String(body.title || "").trim().slice(0, 240);
  const details = String(body.details || "").trim().slice(0, 10000);
  const ref = String(body.reference_number || "").trim().slice(0, 100) || null;
  const amount = body.amount === null || body.amount === undefined || body.amount === "" ? null : Number(body.amount);
  const currency = String(body.currency || "INR").toUpperCase();
  const effectiveDate = body.effective_date && /^\d{4}-\d{2}-\d{2}$/.test(String(body.effective_date)) ? body.effective_date : null;
  if (title.length < 3 || details.length < 3) return res.status(400).json({ error: "Title and details are required." });
  if (amount !== null && (!Number.isFinite(amount) || amount <= 0 || type !== "Sanction")) return res.status(400).json({ error: "Only a sanction may have a positive amount." });
  if (!/^[A-Z]{3}$/.test(currency)) return res.status(400).json({ error: "Currency must be a three-letter code." });
  if (type === "Sanction" && !["Approved", "Implementing", "Closed"].includes(p.status)) return res.status(409).json({ error: "A sanction can be recorded only after approval." });
  if (type === "Outcome" && !["Approved", "Implementing", "Closed"].includes(p.status)) return res.status(409).json({ error: "An implementation outcome requires an approved proposal." });
  const saved = await db.query(
    "INSERT INTO proposal_decision_records (proposal_id,actor_id,actor_email,record_type,title,details,reference_number,amount,currency,effective_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::date) RETURNING id,proposal_id,actor_email,record_type,title,details,reference_number,amount,currency,effective_date,created_at",
    [id, user.id, user.email, type, title, details, ref, amount, currency, effectiveDate]
  );
  await db.query("INSERT INTO proposal_audit (proposal_id,actor_id,actor_email,action,from_status,to_status,reason) VALUES ($1,$2,$3,$4,NULL,NULL,$5)", [id,user.id,user.email,"Structured "+type.toLowerCase()+" recorded",title+": "+details.slice(0,700)]);
  // Save the record without waiting for the external embedding provider; archive reindex is separate.
  return res.status(201).json({ record: saved.rows[0] });
}