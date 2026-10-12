import { db } from "hatchable";

export const access = "user";
export const methods = ["GET"];

export default async function (req, res) {
  const user = req.user;
  const { rows: pr } = await db.query("SELECT role, station_code,active,si_approved FROM app_profiles WHERE user_id = $1", [user.id]);
  if (!pr.length || pr[0].active === false || (!pr[0].si_approved && !["Admin","SI"].includes(pr[0].role))) return res.status(403).json({ error: "Access not approved or account inactive. Ask your Station SI." });
  const role = pr[0].role;
  const stationCode = pr[0]?.station_code || null;
  const stationWide = ["Admin","SI","SHO / Inspector"].includes(role);
  const params = [user.id, stationWide, stationCode];
  const scope = "(p.demo_data = TRUE OR p.owner_id = $1 OR ($2::boolean = TRUE AND p.station_code = $3) OR (p.common_report = TRUE AND p.status <> 'Draft'))";
  const [countResult, statusResult, recentResult] = await Promise.all([
    db.query(
      "SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status IN ('Submitted','Under Review'))::int AS pending_review, COUNT(*) FILTER (WHERE status = 'Approved')::int AS approved, COUNT(*) FILTER (WHERE status = 'Implementing')::int AS implementing, COUNT(*) FILTER (WHERE status = 'Closed')::int AS closed, COUNT(*) FILTER (WHERE priority IN ('High','Critical') AND status NOT IN ('Closed','Returned'))::int AS high_priority FROM proposals p WHERE "+scope,
      params
    ),
    db.query(
      "SELECT p.status, COUNT(*)::int AS count FROM proposals p WHERE "+scope+" GROUP BY p.status ORDER BY p.status",
      params
    ),
    db.query(
      "SELECT p.id,p.title,p.category,p.priority,p.status,p.department,p.updated_at,p.owner_email,p.progress,p.demo_data,p.station_code FROM proposals p WHERE "+scope+" ORDER BY p.updated_at DESC LIMIT 6",
      params
    )
  ]);
  const counts = countResult.rows;
  const statuses = statusResult.rows;
  const recent = recentResult.rows;
  res.json({ metrics: counts[0] || {}, statuses, recent, role });
}