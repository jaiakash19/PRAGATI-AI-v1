import { db } from "hatchable";

export const access = "user";
export const methods = ["GET", "POST", "PATCH"];

const ROLES = ["Admin","Submitter","Reviewer","Approving Officer","Implementation Officer","SI","SHO / Inspector","ASI","Head Constable","Police Constable"];
const MEMBER_ROLES = ["Submitter","Reviewer","Approving Officer","Implementation Officer","SHO / Inspector","ASI","Head Constable","Police Constable"];

export default async function (req, res) {
  const user = req.user;
  const { rows: mine } = await db.query("SELECT role,station_code,email FROM app_profiles WHERE user_id=$1", [user.id]);
  const myProfile = mine[0];
  const isAdmin = myProfile?.role === "Admin";
  const isSI = myProfile?.role === "SI" && !!myProfile.station_code;
  if (!isAdmin && !isSI) return res.status(403).json({ error: "Administrator or assigned SI access required." });

  if (req.method === "GET") {
    const { rows } = isAdmin
      ? await db.query("SELECT p.user_id,p.email,p.display_name,p.role,p.station_code,p.police_rank,p.contact_phone,p.contact_extension,p.department_id,p.active,p.created_at,s.station_name FROM app_profiles p LEFT JOIN police_stations s ON s.station_code=p.station_code ORDER BY p.created_at ASC LIMIT 500")
      : await db.query("SELECT p.user_id,p.email,p.display_name,p.role,p.station_code,p.police_rank,p.contact_phone,p.contact_extension,p.department_id,p.active,p.created_at,s.station_name FROM app_profiles p LEFT JOIN police_stations s ON s.station_code=p.station_code WHERE p.station_code=$1 ORDER BY p.created_at ASC LIMIT 500", [myProfile.station_code]);
    const stations = isAdmin
      ? await db.query("SELECT s.station_code,s.station_name,s.division,a.department_id FROM police_stations s LEFT JOIN station_si_assignments a ON a.station_code=s.station_code WHERE s.active=TRUE ORDER BY s.division,s.station_name")
      : await db.query("SELECT s.station_code,s.station_name,s.division,a.department_id FROM police_stations s JOIN station_si_assignments a ON a.station_code=s.station_code WHERE s.active=TRUE AND s.station_code=$1", [myProfile.station_code]);
    const counts = await db.query("SELECT (SELECT COUNT(*) FROM app_profiles WHERE station_code=$1 AND active=TRUE) + (SELECT COUNT(*) FROM station_member_invites WHERE station_code=$1 AND active=TRUE) AS active_members", [isAdmin ? (req.query?.station_code || myProfile.station_code || "") : myProfile.station_code]);
    const invites = await db.query("SELECT email,display_name,role,station_code,department_id,created_at FROM station_member_invites WHERE station_code=$1 AND active=TRUE ORDER BY created_at DESC", [myProfile.station_code]);
    return res.json({ users: rows, pending_invites: invites.rows, stations: stations.rows, member_limit: 50, active_members: Number(counts.rows[0]?.active_members || 0), can_manage_members: true });
  }

  const body = req.body || {};
  if (req.method === "POST") {
    if (!isSI) return res.status(403).json({ error: "Only an assigned SI can pre-approve station members." });
    const email = String(body.email || "").trim().toLowerCase();
    const displayName = String(body.display_name || "").trim().slice(0,120);
    const role = String(body.role || "Police Constable");
    const { rows: assignment } = await db.query("SELECT department_id FROM station_si_assignments WHERE station_code=$1 AND active=TRUE", [myProfile.station_code]);
    if (!assignment.length || !assignment[0].department_id) return res.status(403).json({ error: "Your assigned station has no active Department ID. Contact the administrator." });
    // SI may choose the Department ID to save with this email approval; it must be active in the system.
    const departmentId = String(body.department_id || assignment[0].department_id).trim().toUpperCase();
    const rank = String(body.police_rank || role).trim().slice(0,80);
    const phone = String(body.contact_phone || "").trim().slice(0,30) || null;
    const extension = String(body.contact_extension || "").trim().slice(0,30) || null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Enter a valid member email address." });
    if (!MEMBER_ROLES.includes(role)) return res.status(400).json({ error: "Choose a permitted station-member role." });
    const { rows: allowedDepartment } = await db.query("SELECT department_id FROM allowed_department_ids WHERE department_id=$1 AND active=TRUE LIMIT 1", [departmentId]);
    if (!allowedDepartment.length) return res.status(400).json({ error: "Enter an active Department ID approved in the system." });
    const { rows: existingInvite } = await db.query("SELECT station_code FROM station_member_invites WHERE LOWER(email)=LOWER($1) AND active=TRUE LIMIT 1", [email]);
    if (existingInvite.length && existingInvite[0].station_code !== myProfile.station_code) return res.status(409).json({ error: "This email is already pre-approved for another station." });
    const { rows: existingProfile } = await db.query("SELECT user_id,station_code,role FROM app_profiles WHERE LOWER(email)=LOWER($1) LIMIT 1", [email]);
    if (existingProfile.length && ["Admin","SI"].includes(existingProfile[0].role)) return res.status(409).json({ error: "An existing SI or Admin account cannot be reassigned as a station member." });
    if (existingProfile.length && existingProfile[0].station_code && existingProfile[0].station_code !== myProfile.station_code) return res.status(409).json({ error: "This email is already assigned to another station." });
    const { rows: registered } = await db.query("SELECT id,email,name FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1", [email]);
    if (existingProfile.length) {
      const { rows } = await db.query("UPDATE app_profiles SET display_name=COALESCE(NULLIF($2,''),display_name),role=$3,station_code=$4,department_id=$5,police_rank=$6,contact_phone=$7,contact_extension=$8,active=TRUE,si_approved=TRUE WHERE user_id=$1 RETURNING user_id,email,display_name,role,station_code,department_id,active", [existingProfile[0].user_id,displayName,role,myProfile.station_code,departmentId,rank,phone,extension]);
      await db.query("UPDATE station_member_invites SET active=FALSE,updated_at=NOW() WHERE LOWER(email)=LOWER($1)", [email]);
      return res.status(201).json({ user: rows[0], message: "Existing account assigned to your station. The member can sign in now.", status: "assigned" });
    }
    if (registered.length) {
      const member = registered[0];
      const { rows: inserted } = await db.query("INSERT INTO app_profiles (user_id,email,display_name,role,station_code,department_id,police_rank,contact_phone,contact_extension,active,si_approved) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE,TRUE) RETURNING user_id,email,display_name,role,station_code,department_id,active", [member.id,email,displayName || member.name || email.split("@")[0],role,myProfile.station_code,departmentId,rank,phone,extension]);
      await db.query("UPDATE station_member_invites SET active=FALSE,updated_at=NOW() WHERE LOWER(email)=LOWER($1)", [email]);
      return res.status(201).json({ user: inserted[0], message: "Member assigned to your station. They can sign in now.", status: "assigned" });
    }
    const { rows: invite } = await db.query("INSERT INTO station_member_invites (email,display_name,role,station_code,department_id,police_rank,active,created_by,updated_at) VALUES ($1,$2,$3,$4,$5,$6,TRUE,$7,NOW()) ON CONFLICT (email) DO UPDATE SET display_name=EXCLUDED.display_name,role=EXCLUDED.role,station_code=EXCLUDED.station_code,department_id=EXCLUDED.department_id,police_rank=EXCLUDED.police_rank,active=TRUE,created_by=EXCLUDED.created_by,updated_at=NOW() RETURNING email,display_name,role,station_code,department_id,police_rank,active,created_at", [email,displayName || email.split("@")[0],role,myProfile.station_code,departmentId,rank,user.id]);
    return res.status(201).json({ invite: invite[0], member_limit: 50, message: "Email approved and saved. The member can now sign in with this exact email; their profile will activate automatically.", status: "preapproved" });
  }

  if (!body.user_id) return res.status(400).json({ error: "Choose a member account." });
  const { rows: targetRows } = await db.query("SELECT user_id,email,station_code,role,active FROM app_profiles WHERE user_id=$1", [String(body.user_id)]);
  const target = targetRows[0];
  if (!target) return res.status(404).json({ error: "Member account not found." });
  if (isSI && target.user_id !== user.id && target.station_code && target.station_code !== myProfile.station_code) return res.status(403).json({ error: "You can manage members of your assigned station only." });
  if (isSI && target.user_id === user.id) return res.status(403).json({ error: "SI cannot change their own access." });
  const stationCode = isSI ? myProfile.station_code : (body.station_code ? String(body.station_code).trim().toUpperCase() : null);
  const role = String(body.role || target.role);
  if (!ROLES.includes(role)) return res.status(400).json({ error: "Choose a valid role." });
  if (isSI && !MEMBER_ROLES.includes(role)) return res.status(403).json({ error: "SI can assign member roles only; SI/Admin roles are reserved for administrators." });
  if (stationCode) {
    const station = await db.query("SELECT 1 FROM police_stations WHERE station_code=$1 AND active=TRUE", [stationCode]);
    if (!station.rows.length) return res.status(400).json({ error: "Select a valid active police station." });
  }
  const makeActive = body.active === undefined ? target.active !== false : body.active === true;
  if (makeActive && (target.active === false || target.station_code !== stationCode)) {
    const count = await db.query("SELECT (SELECT COUNT(*) FROM app_profiles WHERE station_code=$1 AND active=TRUE AND user_id<>$2) + (SELECT COUNT(*) FROM station_member_invites WHERE station_code=$1 AND active=TRUE) AS n", [stationCode,target.user_id]);
    if (Number(count.rows[0]?.n || 0) >= 50) return res.status(409).json({ error: "This station already has 50 active members or pending invitations." });
  }
  const rank = String(body.police_rank || (isSI ? target.police_rank : "") || "").trim().slice(0,80) || null;
  const phone = String(body.contact_phone || "").trim().slice(0,30) || null;
  const extension = String(body.contact_extension || "").trim().slice(0,30) || null;
  const { rows } = await db.query("UPDATE app_profiles SET role=$2,station_code=$3,police_rank=$4,contact_phone=$5,contact_extension=$6,active=$7 WHERE user_id=$1 RETURNING user_id,email,display_name,role,station_code,police_rank,contact_phone,contact_extension,department_id,active,created_at", [target.user_id,role,stationCode,rank,phone,extension,makeActive]);
  return res.json({ user: rows[0], member_limit: 50 });
}