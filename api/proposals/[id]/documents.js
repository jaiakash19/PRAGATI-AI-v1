import { db, storage } from "hatchable";

export const access = "user";
export const methods = ["POST"];

const ALLOWED = new Set(["pdf","docx","doc","xlsx","xls","csv","txt","png","jpg","jpeg"]);

export default async function (req, res) {
  const user = req.user;
  const proposalId = String(req.params.id || "");
  const file = (req.files || []).find(f => f.field === "file");
  if (!file) return res.status(400).json({ error: "Choose a file to upload." });
  const filename = String(file.filename || "document").replace(/[\\/\r\n\0]/g,"_").slice(0,180);
  const ext = filename.split(".").pop().toLowerCase();
  if (!ALLOWED.has(ext)) return res.status(415).json({ error: "Allowed file types: PDF, DOC/DOCX, XLS/XLSX, CSV, TXT, PNG and JPG." });
  const size = file.buffer?.byteLength || file.buffer?.length || 0;
  if (!size || size > 10 * 1024 * 1024) return res.status(413).json({ error: "File must be between 1 byte and 10 MB." });
  const { rows: prof } = await db.query("SELECT role, station_code,active,si_approved FROM app_profiles WHERE user_id = $1", [user.id]);
  if (!prof.length || prof[0].active === false || (!prof[0].si_approved && !["Admin","SI"].includes(prof[0].role))) return res.status(403).json({ error: "Access not approved or account inactive. Ask your Station SI." });
  const role = prof[0].role;
  const stationCode = prof[0]?.station_code || null;
  const stationWide = ["Admin","SI","SHO / Inspector"].includes(role);
  const { rows: proposals } = await db.query("SELECT id,owner_id,demo_data,status,station_code FROM proposals WHERE id = $1 AND (owner_id=$2 OR ($3::boolean=TRUE AND station_code=$4))", [proposalId,user.id,stationWide,stationCode]);
  if (!proposals.length) return res.status(404).json({ error: "Proposal not found." });
  const p = proposals[0];
  if (p.demo_data || (p.owner_id !== user.id && !["Admin","Reviewer","Approving Officer","Implementation Officer"].includes(role))) {
    return res.status(403).json({ error: "You cannot attach a document to this proposal." });
  }
  const key = "ipmprs/" + user.id + "/" + crypto.randomUUID() + "-" + filename;
  const saved = await storage.put(key, file.buffer, file.contentType || "application/octet-stream");
  const { rows } = await db.query("INSERT INTO proposal_documents (proposal_id,uploaded_by,filename,storage_key,content_type,size_bytes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,proposal_id,filename,content_type,size_bytes,created_at", [proposalId,user.id,filename,key,file.contentType || "application/octet-stream",size]);
  await db.query("INSERT INTO proposal_audit (proposal_id,actor_id,actor_email,action,from_status,to_status,reason) VALUES ($1,$2,$3,'Document uploaded',NULL,NULL,$4)", [proposalId,user.id,user.email,filename]);
  res.status(201).json({ document: rows[0], storage_saved: !!saved });
}