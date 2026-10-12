import { db } from "hatchable";

export const access = "user";
export const methods = ["POST"];

const SI_EMAILS = new Set(["jaiakash1910@gmail.com", "jaiakash1915@gmail.com", "bkrishnakumar037@gmail.com", "subalakshmi20052007@gmail.com"]);
const LEGACY = new Map([
  ["koodalarasi.ds@gmail.com", "PO3"],
]);

export default async function (req, res) {
  const user = req.user;
  const email = String(user?.email || "").trim().toLowerCase();
  const departmentId = String(req.body?.department_id || "").trim().toUpperCase();
  const requestedStation = String(req.body?.station_code || "").trim().toUpperCase();
  const requestedRank = String(req.body?.police_rank || "").trim();
  if (!requestedStation || !requestedRank) return res.status(400).json({ error: "Police station and rank are required." });

  if (SI_EMAILS.has(email)) {
    if (requestedRank !== "SI") return res.status(403).json({ error: "These division accounts are authorized for SI access only." });
    const assignment = await db.query(
      "SELECT a.department_id,s.division,s.station_name FROM station_si_assignments a JOIN police_stations s ON s.station_code=a.station_code WHERE a.station_code=$1 AND LOWER(a.assigned_email)=LOWER($2) AND a.active=TRUE AND s.active=TRUE",
      [requestedStation, email]
    );
    if (!assignment.rows?.length) return res.status(403).json({ error: "This account is not assigned to that station." });
    if (String(assignment.rows[0].department_id).toUpperCase() !== departmentId) return res.status(403).json({ error: "Department ID does not match this station. Use " + assignment.rows[0].department_id + "." });
    const allowed = await db.query("SELECT 1 FROM allowed_department_ids WHERE department_id=$1 AND active=TRUE", [departmentId]);
    if (!allowed.rows?.length) return res.status(403).json({ error: "This Department ID is not active." });
    await db.query(
      "INSERT INTO app_profiles (user_id,email,display_name,role,station_code,police_rank,department_id) VALUES ($1,$2,$3,'SI',$4,'SI',$5) ON CONFLICT (email) DO UPDATE SET user_id=EXCLUDED.user_id,role='SI',station_code=EXCLUDED.station_code,police_rank='SI',department_id=EXCLUDED.department_id",
      [user.id,email,user.name || email.split("@")[0],requestedStation,departmentId]
    );
    return res.json({ ok: true, role: "SI", station_code: requestedStation, station_name: assignment.rows[0].station_name, department_id: departmentId, division: assignment.rows[0].division });
  }

  // SI-preapproved members may sign in using the exact email, station, and Department ID saved by their SI.
  const { rows: approvedInvites } = await db.query(
    "SELECT role,station_code,department_id,police_rank FROM station_member_invites WHERE LOWER(email)=LOWER($1) AND active=TRUE LIMIT 1",
    [email]
  );
  if (approvedInvites.length) {
    const invite = approvedInvites[0];
    if (invite.station_code !== requestedStation) return res.status(403).json({ error: "The selected station does not match the station assigned by your SI." });
    if (String(invite.department_id).toUpperCase() !== departmentId) return res.status(403).json({ error: "Department ID does not match the approval saved by your SI." });
    if (["SI","Admin"].includes(invite.role)) return res.status(403).json({ error: "This member approval cannot grant SI or Admin access." });
    if (invite.police_rank && invite.police_rank !== requestedRank) return res.status(403).json({ error: "The selected police rank does not match the rank saved by your SI." });
    return res.json({ ok: true, approved_member: true, station_code: invite.station_code, department_id: invite.department_id });
  }

  const { rows: approvedProfiles } = await db.query(
    "SELECT role,station_code,department_id,police_rank,active,si_approved FROM app_profiles WHERE user_id=$1 LIMIT 1",
    [user.id]
  );
  if (approvedProfiles.length && approvedProfiles[0].active !== false && approvedProfiles[0].si_approved && !["SI","Admin"].includes(approvedProfiles[0].role)) {
    const profile = approvedProfiles[0];
    if (profile.station_code !== requestedStation) return res.status(403).json({ error: "The selected station does not match the station assigned by your SI." });
    if (String(profile.department_id || "").toUpperCase() !== departmentId) return res.status(403).json({ error: "Department ID does not match the approval saved by your SI." });
    if (profile.police_rank && profile.police_rank !== requestedRank) return res.status(403).json({ error: "The selected police rank does not match your assigned profile." });
    return res.json({ ok: true, approved_member: true, station_code: profile.station_code, department_id: profile.department_id });
  }

  const legacyId = LEGACY.get(email);
  if (!legacyId) return res.status(403).json({ error: "This email has not been approved by a Station SI. Ask your SI to add the exact email in Users & Roles." });
  const { rows: memberProfile } = await db.query("SELECT role,active,si_approved FROM app_profiles WHERE user_id=$1", [user.id]);
  if (!memberProfile.length || memberProfile[0].active === false || !memberProfile[0].si_approved) return res.status(403).json({ error: "Your email must be pre-approved by your Station SI before sign-in." });
  if (departmentId !== legacyId) return res.status(403).json({ error: "The approved Department ID for this email is " + legacyId + "." });
  const allowed = await db.query("SELECT 1 FROM allowed_department_ids WHERE department_id=$1 AND active=TRUE", [departmentId]);
  if (!allowed.rows?.length) return res.status(403).json({ error: "This Department ID is not active." });
  await db.query("INSERT INTO app_profiles (user_id,email,display_name,role) VALUES ($1,$2,$3,'Submitter') ON CONFLICT (user_id) DO NOTHING", [user.id,email,user.name || email.split("@")[0]]);
  const { rows } = await db.query("SELECT station_code,police_rank,department_id FROM app_profiles WHERE user_id=$1", [user.id]);
  if (!rows.length || !rows[0].station_code || !rows[0].police_rank) return res.status(403).json({ error: "Your station and rank have not been assigned yet. Contact your administrator." });
  if (rows[0].department_id && String(rows[0].department_id).toUpperCase() !== departmentId) return res.status(403).json({ error: "Department ID does not match this account." });
  if (rows[0].station_code !== requestedStation || rows[0].police_rank !== requestedRank) return res.status(403).json({ error: "The selected station or rank does not match your assigned account." });
  if (!rows[0].department_id) await db.query("UPDATE app_profiles SET department_id=$2 WHERE user_id=$1 AND department_id IS NULL", [user.id,departmentId]);
  return res.json({ ok: true });
}