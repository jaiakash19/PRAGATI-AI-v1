import { db } from "hatchable";
import { indexProposals } from "lib/nvidia.js";

export const access = "user";
export const methods = ["POST"];

export default async function (req, res) {
  const user = req.user;
  const roleRows = await db.query("SELECT role,active,si_approved FROM app_profiles WHERE user_id = $1", [user.id]);
  if (!roleRows.rows.length || roleRows.rows[0].active === false || (!roleRows.rows[0].si_approved && !["Admin","SI"].includes(roleRows.rows[0].role)) || !["Admin", "Approving Officer"].includes(roleRows.rows[0]?.role)) {
    return res.status(403).json({ error: "Only an Admin or Approving Officer can publish institutional precedents." });
  }
  const id = String(req.params.id || "");
  const { rows } = await db.query("SELECT * FROM proposals WHERE id = $1 AND demo_data = FALSE", [id]);
  if (!rows.length) return res.status(404).json({ error: "Proposal not found. Demo proposals are read-only." });
  const p = rows[0];
  if (!["Approved", "Rejected", "Returned", "Recommended", "Implementing", "Closed"].includes(p.status)) {
    return res.status(409).json({ error: "Only a reviewed or completed proposal can be published as a precedent." });
  }
  const visible = Boolean((req.body || {}).visible);
  await db.query("UPDATE proposals SET precedent_visible=$2, updated_at=NOW() WHERE id=$1", [id, visible]);
  await db.query("INSERT INTO proposal_audit (proposal_id,actor_id,actor_email,action,from_status,to_status,reason) VALUES ($1,$2,$3,$4,$5,$5,$6)", [id,user.id,user.email,visible?"Published as institutional precedent":"Removed from institutional precedent",p.status,visible?"Approved for cross-department precedent search":"Publication revoked"]);
  // Publishing is saved immediately; refresh archive embeddings separately to avoid a slow response.
  res.json({ id, precedent_visible: visible });
}