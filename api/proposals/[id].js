import { db } from "hatchable";

export const access = "user";
export const methods = ["GET"];

export default async function (req, res) {
  const user = req.user;
  const id = String(req.params.id || "");
  const { rows: pr } = await db.query("SELECT role, station_code,active,si_approved FROM app_profiles WHERE user_id = $1", [user.id]);
  if (!pr.length || pr[0].active === false || (!pr[0].si_approved && !["Admin","SI"].includes(pr[0].role))) return res.status(403).json({ error: "Access not approved or account inactive. Ask your Station SI." });
  const role = pr[0].role;
  const stationCode = pr[0]?.station_code || null;
  const stationWide = ["Admin","SI","SHO / Inspector"].includes(role);
  const { rows } = await db.query("SELECT * FROM proposals WHERE id = $1 AND (demo_data = TRUE OR owner_id = $2 OR ($3::boolean = TRUE AND station_code = $4) OR (common_report = TRUE AND status <> 'Draft')) LIMIT 1", [id, user.id, stationWide, stationCode]);
  if (!rows.length) return res.status(404).json({ error: "Proposal not found or access denied." });
  const p = rows[0];
  const [audit, implementation, documents, decisionRecords] = await Promise.all([
    db.query("SELECT id,actor_email,action,from_status,to_status,reason,created_at FROM proposal_audit WHERE proposal_id = $1 ORDER BY created_at DESC LIMIT 50", [id]),
    db.query("SELECT id,actor_email,milestone,progress,evidence,created_at FROM implementation_updates WHERE proposal_id = $1 ORDER BY created_at DESC LIMIT 30", [id]),
    db.query("SELECT id,filename,content_type,size_bytes,uploaded_by,created_at FROM proposal_documents WHERE proposal_id = $1 ORDER BY created_at DESC", [id]),
    db.query("SELECT id,actor_email,record_type,title,details,reference_number,amount,currency,effective_date,created_at FROM proposal_decision_records WHERE proposal_id = $1 ORDER BY created_at DESC", [id])
  ]);
  res.json({ proposal: p, audit: audit.rows, implementation: implementation.rows, documents: documents.rows, decision_records: decisionRecords.rows, role });
}