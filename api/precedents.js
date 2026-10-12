import { db } from "hatchable";
import { searchNvidiaPrecedents } from "lib/nvidia.js";

export const access = "user";
export const methods = ["GET"];

const STAFF = ["Admin", "Reviewer", "Approving Officer", "Implementation Officer"];

function docText(p) {
  return [
    "Proposal title: " + (p.title || ""),
    "Summary: " + (p.summary || ""),
    "Category: " + (p.category || ""),
    "Department: " + (p.department || ""),
    "Priority: " + (p.priority || ""),
    "Status: " + (p.status || ""),
    "Decision: " + (p.decision || ""),
    "Observations: " + (p.observations || ""),
    "Outcome: " + (p.outcome || ""),
    "Recorded decisions, sanctions and outcomes: " + (p.history_text || "")
  ].join("\n");
}

async function lexicalFallback(q, userId, canSeeAll) {
  const { rows } = await db.query(
    "SELECT p.*, COALESCE(h.history_text,'') AS history_text, COALESCE(h.decision_records,'[]'::json) AS decision_records, ts_rank(to_tsvector('english',p.title || ' ' || p.summary || ' ' || p.category || ' ' || p.department || ' ' || COALESCE(p.decision,'') || ' ' || COALESCE(p.observations,'') || ' ' || COALESCE(p.outcome,'') || ' ' || COALESCE(h.history_text,'')),plainto_tsquery('english',$3)) AS lexical_rank FROM proposals p LEFT JOIN LATERAL (SELECT STRING_AGG(CONCAT_WS(' ',r.record_type,r.title,r.details,r.reference_number,r.amount::text,r.currency,r.effective_date::text),' ') AS history_text, JSON_AGG(JSON_BUILD_OBJECT('id',r.id,'proposal_id',r.proposal_id,'actor_email',r.actor_email,'record_type',r.record_type,'title',r.title,'details',r.details,'reference_number',r.reference_number,'amount',r.amount,'currency',r.currency,'effective_date',r.effective_date,'created_at',r.created_at) ORDER BY r.created_at DESC) AS decision_records FROM proposal_decision_records r WHERE r.proposal_id=p.id) h ON TRUE WHERE p.status<>'Draft' AND (p.demo_data=TRUE OR p.owner_id=$1 OR p.precedent_visible=TRUE OR $2::boolean=TRUE) AND (to_tsvector('english',p.title || ' ' || p.summary || ' ' || p.category || ' ' || p.department || ' ' || COALESCE(p.decision,'') || ' ' || COALESCE(p.observations,'') || ' ' || COALESCE(p.outcome,'') || ' ' || COALESCE(h.history_text,'')) @@ plainto_tsquery('english',$3) OR p.title ILIKE '%' || $3 || '%' OR p.summary ILIKE '%' || $3 || '%' OR COALESCE(h.history_text,'') ILIKE '%' || $3 || '%') ORDER BY lexical_rank DESC,p.updated_at DESC LIMIT 20",
    [userId, canSeeAll, q]
  );
  return rows.map(p => ({
    ...p,
    similarity: null,
    matched_excerpt: docText(p).slice(0, 520),
    decision_records: p.decision_records || [],
    method: "keyword fallback (NVIDIA semantic embeddings unavailable or archive not indexed)"
  }));
}

export default async function (req, res) {
  const user = req.user;
  const q = String(req.query.q || "").trim().slice(0, 500);
  if (q.length < 2) return res.json({
    query: q, results: [],
    search_mode: "NVIDIA Nemotron 3 Embed 1B semantic retrieval with keyword fallback",
    message: "Enter at least two characters."
  });
  const { rows: profiles } = await db.query("SELECT role FROM app_profiles WHERE user_id = $1", [user.id]);
  const role = profiles[0]?.role || "Submitter";
  const canSeeAll = STAFF.includes(role);

  try {
    const semantic = await searchNvidiaPrecedents(q, user.id, canSeeAll, 20);
    if (semantic?.length) return res.json({
      query: q,
      results: semantic,
      search_mode: "NVIDIA Nemotron 3 Embed 1B semantic search (2048 dimensions)",
      message: "Ranked by NVIDIA semantic embedding similarity. Scores measure textual closeness, not truth or approval suitability; inspect the original record."
    });
  } catch (e) {
    console.error("NVIDIA semantic search unavailable; falling back to keywords:", e?.message || e);
  }

  const fallback = await lexicalFallback(q, user.id, canSeeAll);
  return res.json({
    query: q,
    results: fallback,
    search_mode: "Keyword fallback — NVIDIA API key or indexed vectors unavailable",
    message: "Keyword matching includes saved decisions, sanctions, observations and outcomes. It is not semantic ranking. Configure NVIDIA_API_KEY and index the archive to activate Nemotron embeddings."
  });
}