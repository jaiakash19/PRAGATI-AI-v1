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
  const { rows } = await db.query(
    "SELECT a.id,a.proposal_id,a.actor_email,a.action,a.from_status,a.to_status,a.reason,a.created_at,p.title AS proposal_title,p.demo_data,p.station_code FROM proposal_audit a JOIN proposals p ON p.id = a.proposal_id WHERE p.demo_data = TRUE OR p.owner_id = $1 OR ($2::boolean = TRUE AND p.station_code = $3) OR (p.common_report = TRUE AND p.status <> 'Draft') ORDER BY a.created_at DESC LIMIT 100",
    [user.id, stationWide, stationCode]
  );
  res.json({ events: rows, role });
}