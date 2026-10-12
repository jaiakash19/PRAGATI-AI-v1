import { db } from "hatchable";

export const access = "user";
export const methods = ["GET"];

export default async function (req, res) {
  const user = req.user;
  const email = String(user.email || "").trim().toLowerCase();
  let { rows } = await db.query("SELECT user_id,email,display_name,role,station_code,police_rank,contact_phone,contact_extension,department_id,active,si_approved,created_at FROM app_profiles WHERE user_id=$1", [user.id]);

  // Recover an existing profile by verified email when the auth provider has issued a new user ID.
  if (!rows.length) {
    const existingByEmail = await db.query("SELECT user_id FROM app_profiles WHERE LOWER(email)=LOWER($1) LIMIT 1", [email]);
    if (existingByEmail.rows.length) {
      await db.query("UPDATE app_profiles SET user_id=$2 WHERE user_id=$1", [existingByEmail.rows[0].user_id,user.id]);
      const refreshed = await db.query("SELECT user_id,email,display_name,role,station_code,police_rank,contact_phone,contact_extension,department_id,active,si_approved,created_at FROM app_profiles WHERE user_id=$1", [user.id]);
      rows = refreshed.rows;
    }
  }

  if (!rows.length) {
    const { rows: invites } = await db.query("SELECT email,display_name,role,station_code,department_id,police_rank FROM station_member_invites WHERE LOWER(email)=LOWER($1) AND active=TRUE LIMIT 1", [email]);
    const invite = invites[0];
    if (!invite) return res.status(403).json({ error: "Access not approved. Ask your Station SI to add your exact email address, role, and Department ID in Users & Roles before signing in." });
    // Member Department IDs are approved by their SI in the invite itself; the
    // station_si_assignments table is only for SI accounts and must not block members.
    const { rows: validStation } = await db.query("SELECT 1 FROM police_stations WHERE station_code=$1 AND active=TRUE", [invite.station_code]);
    if (!validStation.length) return res.status(403).json({ error: "The approved police station is inactive. Contact your Station SI." });
    await db.query("UPDATE station_member_invites SET active=FALSE,updated_at=NOW() WHERE LOWER(email)=LOWER($1) AND active=TRUE", [email]);
    try {
      const result = await db.query("INSERT INTO app_profiles (user_id,email,display_name,role,station_code,department_id,police_rank,active,si_approved) VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,TRUE) RETURNING user_id,email,display_name,role,station_code,police_rank,contact_phone,contact_extension,department_id,active,si_approved,created_at", [user.id,email,invite.display_name || user.name || email.split("@")[0],invite.role,invite.station_code,invite.department_id,invite.police_rank || invite.role]);
      rows = result.rows;
    } catch (error) {
      await db.query("UPDATE station_member_invites SET active=TRUE,updated_at=NOW() WHERE LOWER(email)=LOWER($1)", [email]);
      throw error;
    }
  }

  if (!rows.length || rows[0].active === false) return res.status(403).json({ error: "Your PRAGATI-AI account is inactive. Contact your Station SI or administrator." });
  if (!rows[0].si_approved && !["Admin","SI"].includes(rows[0].role)) return res.status(403).json({ error: "Access not approved. Ask your Station SI to add your exact email, role, and Department ID in Users & Roles." });
  await db.query("UPDATE app_profiles SET email=$2,display_name=COALESCE(display_name,$3) WHERE user_id=$1", [user.id,email,user.name || email.split("@")[0]]);
  return res.json({ user: rows[0], signedIn: true, note: "Access is available only to existing active profiles or emails pre-approved by a Station SI." });
}