import { db, storage } from "hatchable";

export const access = "user";
export const methods = ["GET"];

export default async function (req, res) {
  const user = req.user;
  const { rows: prof } = await db.query("SELECT role, station_code,active,si_approved FROM app_profiles WHERE user_id = $1", [user.id]);
  if (!prof.length || prof[0].active === false || (!prof[0].si_approved && !["Admin","SI"].includes(prof[0].role))) return res.status(403).json({ error: "Access not approved or account inactive. Ask your Station SI." });
  const role = prof[0].role;
  const stationCode = prof[0]?.station_code || null;
  const stationWide = ["Admin","SI","SHO / Inspector"].includes(role);
  const { rows } = await db.query(
    "SELECT d.id,d.filename,d.storage_key,d.content_type,p.owner_id,p.demo_data FROM proposal_documents d JOIN proposals p ON p.id = d.proposal_id WHERE d.id = $1 AND (p.demo_data = TRUE OR p.owner_id = $2 OR ($3::boolean = TRUE AND p.station_code = $4)) LIMIT 1",
    [String(req.params.id || ""),user.id,stationWide,stationCode]
  );
  if (!rows.length) return res.status(404).json({ error: "Document not found or access denied." });
  const file = await storage.get(rows[0].storage_key);
  if (!file || !file.buffer) return res.status(404).json({ error: "Stored file is unavailable." });
  res.setHeader("Content-Type", rows[0].content_type || file.contentType || "application/octet-stream");
  res.setHeader("Content-Disposition", "attachment; filename*=UTF-8''" + encodeURIComponent(rows[0].filename));
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(file.buffer);
}