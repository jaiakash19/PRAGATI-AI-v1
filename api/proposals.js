import { db } from "hatchable";
import { indexProposals } from "lib/nvidia.js";

export const access = "user";
export const methods = ["GET", "POST"];

const REVIEW_ROLES = ["Admin", "Reviewer", "Approving Officer", "Implementation Officer"];

export default async function (req, res) {
  const user = req.user;
  const { rows: profileRows } = await db.query("SELECT role, station_code,active,si_approved FROM app_profiles WHERE user_id = $1", [user.id]);
  if (!profileRows.length || profileRows[0].active === false || (!profileRows[0].si_approved && !["Admin","SI"].includes(profileRows[0].role))) return res.status(403).json({ error: "Access not approved or account inactive. Ask your Station SI." });
  const role = profileRows[0].role;
  const stationCode = profileRows[0]?.station_code || null;
  const stationWide = ["Admin","SI","SHO / Inspector"].includes(role);
  if (req.method === "GET") {
    const status = req.query.status || null;
    const q = (req.query.q || "").trim() || null;
    const result = await db.query(
      "SELECT p.*, (SELECT COUNT(*)::int FROM proposal_documents d WHERE d.proposal_id = p.id) AS document_count FROM proposals p WHERE (p.demo_data = TRUE OR p.owner_id = $1 OR ($2::boolean = TRUE AND p.station_code = $3) OR (p.common_report = TRUE AND p.status <> 'Draft')) AND ($4::text IS NULL OR p.status = $4) AND ($5::text IS NULL OR p.title ILIKE '%' || $5 || '%' OR p.summary ILIKE '%' || $5 || '%' OR p.category ILIKE '%' || $5 || '%' OR p.department ILIKE '%' || $5 || '%') ORDER BY CASE p.priority WHEN 'Critical' THEN 0 WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END, p.updated_at DESC LIMIT 200",
      [user.id, stationWide, stationCode, status, q]
    );
    return res.json({ proposals: result.rows, role, station_code: stationCode, total: result.rows.length });
  }
  if (!stationCode) return res.status(403).json({ error: "Your account has no police station assigned. Contact the administrator." });
  const body = req.body || {};
  const title = String(body.title || "").trim();
  const summary = String(body.summary || "").trim();
  if (title.length < 5 || title.length > 180) return res.status(400).json({ error: "Title must be 5–180 characters." });
  if (summary.length < 12 || summary.length > 5000) return res.status(400).json({ error: "Summary must be 12–5000 characters." });
  const category = String(body.category || "General").slice(0, 80);
  const department = String(body.department || "Police Administration").slice(0, 120);
  const priority = ["Low", "Medium", "High", "Critical"].includes(body.priority) ? body.priority : "Medium";
  const dueDate = body.due_date && /^\d{4}-\d{2}-\d{2}$/.test(body.due_date) ? body.due_date : null;
  const commonReport = ["Admin","SI","SHO / Inspector"].includes(role) && body.common_report === "true";
  const created = await db.query(
    "INSERT INTO proposals (title, summary, category, priority, department, owner_id, owner_email, due_date, status, station_code, common_report) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Draft',$9,$10) RETURNING *",
    [title, summary, category, priority, department, user.id, user.email, dueDate, stationCode, commonReport]
  );
  const p = created.rows[0];
  await db.query("INSERT INTO proposal_audit (proposal_id, actor_id, actor_email, action, from_status, to_status, reason) VALUES ($1,$2,$3,'Proposal created',NULL,'Draft','Created as a draft')", [p.id, user.id, user.email]);
  // Drafts are excluded from precedent search; avoid a slow external embedding call during proposal creation.
  res.status(201).json({ proposal: p });
}