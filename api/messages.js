import { db } from "hatchable";
export const access = "user";
export const methods = ["GET", "POST", "PATCH"];
const MEMBER_ROLES = ["Submitter","Reviewer","Approving Officer","Implementation Officer","SHO / Inspector","ASI","Head Constable","Police Constable","SI","Admin"];
async function getProfile(userId) {
 const r = await db.query("SELECT user_id,email,display_name,role,station_code,active,si_approved FROM app_profiles WHERE user_id=$1",[userId]);
 return r.rows[0];
}
export default async function(req,res){
 const auth=req.user; const me=await getProfile(auth.id);
 if(!me || me.active===false || (!me.si_approved && !["Admin","SI"].includes(me.role))) return res.status(403).json({error:"Messaging access requires an active, approved account."});
 if(!me.station_code) return res.status(403).json({error:"Your account has no station assigned."});
 if(req.method==="GET"){
  const [contacts,messages,pending]=await Promise.all([
   db.query("SELECT user_id,email,display_name,role,station_code FROM app_profiles WHERE active=TRUE AND si_approved=TRUE AND user_id<>$1 AND (station_code=$2 OR $3::boolean=TRUE) ORDER BY station_code,display_name,email LIMIT 500",[auth.id,me.station_code,['Admin','SI'].includes(me.role)]),
   db.query("SELECT id,sender_id,sender_email,sender_name,sender_station_code,recipient_id,recipient_email,recipient_name,recipient_station_code,message_text,status,approved_by,approved_at,created_at FROM station_messages WHERE (sender_id=$1 OR (recipient_id=$1 AND status='delivered')) ORDER BY created_at DESC LIMIT 300",[auth.id]),
   ["SI","Admin"].includes(me.role)?db.query("SELECT id,sender_email,sender_name,sender_station_code,recipient_email,recipient_name,recipient_station_code,message_text,created_at FROM station_messages WHERE recipient_station_code=$1 AND status='pending' ORDER BY created_at ASC LIMIT 100",[me.station_code]):Promise.resolve({rows:[]})
  ]);
  return res.json({contacts:contacts.rows,messages:messages.rows,pending:pending.rows,my_station:me.station_code,role:me.role});
 }
 const b=req.body||{};
 if(req.method==="POST"){
  const recipientId=String(b.recipient_id||'').trim(),message=String(b.message_text||'').trim();
  if(!recipientId||message.length<1||message.length>2000)return res.status(400).json({error:"Choose a recipient and enter a message of 1–2000 characters."});
  if(recipientId==='station_all'){
   const recipients=await db.query("SELECT user_id,email,display_name,station_code FROM app_profiles WHERE station_code=$1 AND active=TRUE AND si_approved=TRUE AND user_id<>$2 ORDER BY role,email",[me.station_code,auth.id]);
   if(!recipients.rows.length)return res.status(404).json({error:"No other active, approved members were found in your station."});
   const saved=[];
   for(const to of recipients.rows){
    const row=await db.query("INSERT INTO station_messages (sender_id,sender_email,sender_name,sender_station_code,recipient_id,recipient_email,recipient_name,recipient_station_code,message_text,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'delivered') RETURNING id,status,created_at",[auth.id,me.email,me.display_name||auth.name||me.email,me.station_code,to.user_id,to.email,to.display_name||to.email,to.station_code,message]);
    saved.push(row.rows[0]);
   }
   return res.status(201).json({message:{count:saved.length,status:'delivered'},notice:'Message delivered to '+saved.length+' approved member(s) in your station, including the SI if their account is approved and assigned here.'});
  }
  const rr=await db.query("SELECT user_id,email,display_name,role,station_code,active,si_approved FROM app_profiles WHERE user_id=$1",[recipientId]); const to=rr.rows[0];
  if(!to||to.active===false||!to.si_approved||!to.station_code)return res.status(404).json({error:"Recipient is not an active, approved station member."});
  const cross=to.station_code!==me.station_code;
  if(cross && !["SI","Admin"].includes(me.role)) return res.status(403).json({error:"Only an SI can initiate a message to another station. Ask your SI to approve or send it."});
  const status=cross?'pending':'delivered';
  const saved=await db.query("INSERT INTO station_messages (sender_id,sender_email,sender_name,sender_station_code,recipient_id,recipient_email,recipient_name,recipient_station_code,message_text,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,status,created_at",[auth.id,me.email,me.display_name||auth.name||me.email,me.station_code,to.user_id,to.email,to.display_name||to.email,to.station_code,message,status]);
  return res.status(201).json({message:saved.rows[0],notice:cross?'Message request sent to the receiving station SI for approval.':'Message sent.'});
 }
 const id=String(b.message_id||'').trim(),action=String(b.action||'');
 if(!id||!['approve','reject'].includes(action))return res.status(400).json({error:"Choose a message and approve or reject it."});
 if(!["SI","Admin"].includes(me.role))return res.status(403).json({error:"Only the receiving station SI can approve cross-station messages."});
 const updated=await db.query("UPDATE station_messages SET status=$3,approved_by=$4,approved_at=NOW() WHERE id=$1 AND recipient_station_code=$2 AND status='pending' RETURNING id,status",[id,me.station_code,action==='approve'?'delivered':'rejected',me.email]);
 if(!updated.rows.length)return res.status(404).json({error:"Pending message not found for your station."});
 return res.json({message:updated.rows[0],notice:action==='approve'?'Cross-station message approved and delivered.':'Message request rejected.'});
}