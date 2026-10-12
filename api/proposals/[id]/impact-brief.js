import { db } from "hatchable";
import { searchNvidiaPrecedents, generateImpactAssessment, CHAT_MODEL } from "lib/nvidia.js";

export const access = "user";
export const methods = ["GET"];

const STAFF = ["Admin", "Reviewer", "Approving Officer", "Implementation Officer"];

function textOf(p, history = "") {
  return [
    "Proposal title: " + (p.title || ""),
    "Summary: " + (p.summary || ""),
    "Category: " + (p.category || ""),
    "Department: " + (p.department || ""),
    "Decision: " + (p.decision || ""),
    "Observations: " + (p.observations || ""),
    "Outcome: " + (p.outcome || ""),
    "Implementation notes: " + (p.implementation_notes || ""),
    "Decision, sanction and outcome history: " + history
  ].join("\n");
}

function impactBrief(matches) {
  const semantic = Boolean(matches.length && String(matches[0].method || "").includes("Nemotron"));
  const relevant = semantic ? matches.filter(x => Number(x.similarity || 0) >= 35) : matches;
  const adverse = relevant.filter(x => ["Rejected", "Returned", "Modifications Requested"].includes(x.status) || String(x.decision || "").toLowerCase().startsWith("reject"));
  const positive = relevant.filter(x => ["Approved", "Implementing", "Closed"].includes(x.status) && !String(x.decision || "").toLowerCase().startsWith("reject"));
  const conflicting = Boolean(adverse.length && positive.length);
  const sanctions = relevant.flatMap(p => (p.decision_records || []).filter(r => r.record_type === "Sanction").map(r => ({
    reference: p.reference || p.id, title: p.title, record_title: r.title, details: r.details,
    reference_number: r.reference_number, amount: r.amount, currency: r.currency || "INR", effective_date: r.effective_date
  })));
  const texts = relevant.flatMap(p => [p.observations, p.outcome, ...(p.decision_records || []).map(r => r.details)].filter(Boolean));
  const evidenceText = texts.join(" ").toLowerCase();
  const terms = ["privacy", "security", "budget", "cost", "training", "maintenance", "staffing", "procurement", "delay", "compliance", "retention", "access", "evidence", "deployment", "reliability", "feasibility", "safety", "funding", "timeline", "integration", "data quality", "interoperability"];
  const concerns = terms.filter(term => evidenceText.split(term).length - 1 >= 2);
  const missingOutcomes = positive.filter(p => !String(p.outcome || "").trim()).map(p => ({ reference: p.reference || p.id, title: p.title, status: p.status }));
  const departments = [...new Set(relevant.map(p => p.department).filter(Boolean))].sort();
  let signal, basis;
  if (adverse.length >= 2) { signal = "Elevated review"; basis = adverse.length + " relevant records have rejected, returned or modifications-requested statuses."; }
  else if (adverse.length || conflicting) { signal = "Review required"; basis = "At least one relevant adverse precedent exists; compare its recorded reasons with the current proposal."; }
  else if (positive.length) { signal = "No adverse precedent found"; basis = "Successful precedents were found, but this does not prove the current proposal is safe or suitable."; }
  else { signal = "Insufficient historical evidence"; basis = "No sufficiently similar historical record was available to support a stronger conclusion."; }
  const checks = [];
  if (adverse.length) checks.push("Read original rejection, return or modification reasons and show how the current proposal addresses them.");
  if (conflicting) checks.push("Both successful and adverse precedents exist; compare their scope, assumptions and implementation conditions.");
  if (positive.length) checks.push("Compare intended benefits with the recorded outcomes of successful precedents.");
  if (missingOutcomes.length) checks.push("Some comparable successful records lack a measurable outcome; verify whether the expected benefits were delivered.");
  if (sanctions.length) checks.push("Check prior sanction order numbers, amounts, conditions and dates; an old sanction does not automatically apply.");
  if (concerns.length) checks.push("Review recurring recorded concerns: " + concerns.join(", ") + ".");
  if (!checks.length) checks.push("Confirm with relevant departments whether additional historical records exist before reaching a decision.");
  return {
    signal_level: signal, basis, relevant_records_examined: relevant.length,
    adverse_precedents: adverse.slice(0, 5).map(p => ({ reference: p.reference || p.id, title: p.title, status: p.status, decision: p.decision, observations: p.observations, similarity: p.similarity ?? null })),
    successful_precedents: positive.slice(0, 5).map(p => ({ reference: p.reference || p.id, title: p.title, status: p.status, decision: p.decision, outcome: p.outcome, similarity: p.similarity ?? null })),
    conflicting_precedents: conflicting,
    recurring_concerns: concerns,
    missing_outcomes: missingOutcomes.slice(0, 5),
    sanctions: sanctions.slice(0, 10),
    departments_represented: departments,
    checks_before_decision: checks,
    disclaimer: "AI and similarity scores are decision-support aids based only on the records available to this user's role. This is not a calibrated risk probability, a legal assessment or an automated recommendation to approve/reject. Verify original records and do not use confidential/classified data in this prototype."
  };
}

async function lexicalSearch(p, userId, canSeeAll, excludeId) {
  const query = [p.title, p.summary, p.category, p.priority, p.decision || "", p.observations || "", p.outcome || ""].join(" ");
  const { rows } = await db.query(
    "SELECT x.*, COALESCE(h.history_text,'') AS history_text, COALESCE(h.decision_records,'[]'::json) AS decision_records, ts_rank(to_tsvector('english',x.title || ' ' || x.summary || ' ' || x.category || ' ' || x.department || ' ' || COALESCE(x.decision,'') || ' ' || COALESCE(x.observations,'') || ' ' || COALESCE(x.outcome,'') || ' ' || COALESCE(h.history_text,'')),plainto_tsquery('english',$4)) AS lexical_rank FROM proposals x LEFT JOIN LATERAL (SELECT STRING_AGG(CONCAT_WS(' ',r.record_type,r.title,r.details,r.reference_number,r.amount::text,r.currency,r.effective_date::text),' ') AS history_text, JSON_AGG(JSON_BUILD_OBJECT('id',r.id,'proposal_id',r.proposal_id,'actor_email',r.actor_email,'record_type',r.record_type,'title',r.title,'details',r.details,'reference_number',r.reference_number,'amount',r.amount,'currency',r.currency,'effective_date',r.effective_date,'created_at',r.created_at) ORDER BY r.created_at DESC) AS decision_records FROM proposal_decision_records r WHERE r.proposal_id=x.id) h ON TRUE WHERE x.id<>$1 AND x.status<>'Draft' AND (x.demo_data=TRUE OR x.owner_id=$2 OR x.precedent_visible=TRUE OR $3::boolean=TRUE) AND (to_tsvector('english',x.title || ' ' || x.summary || ' ' || x.category || ' ' || x.department || ' ' || COALESCE(x.decision,'') || ' ' || COALESCE(x.observations,'') || ' ' || COALESCE(x.outcome,'') || ' ' || COALESCE(h.history_text,'')) @@ plainto_tsquery('english',$4) OR x.title ILIKE '%' || $4 || '%' OR x.summary ILIKE '%' || $4 || '%' OR COALESCE(h.history_text,'') ILIKE '%' || $4 || '%') ORDER BY lexical_rank DESC,x.updated_at DESC LIMIT 12",
    [String(excludeId), userId, canSeeAll, query.slice(0, 500)]
  );
  return rows.map(x => ({
    ...x, similarity: null, decision_records: x.decision_records || [],
    matched_excerpt: textOf(x, x.history_text).slice(0, 520),
    method: "keyword fallback (NVIDIA embeddings unavailable or archive not indexed)"
  }));
}

export default async function (req, res) {
  const user = req.user;
  const id = String(req.params.id || "");
  const { rows: profiles } = await db.query("SELECT role,active,si_approved FROM app_profiles WHERE user_id=$1", [user.id]);
  if (!profiles.length || profiles[0].active === false || (!profiles[0].si_approved && !["Admin","SI"].includes(profiles[0].role))) return res.status(403).json({ error: "Access not approved or account inactive. Ask your Station SI." });
  const role = profiles[0].role;
  const canSeeAll = STAFF.includes(role);
  const { rows: currentRows } = await db.query(
    "SELECT * FROM proposals WHERE id=$1 AND (demo_data=TRUE OR owner_id=$2 OR $3::boolean=TRUE) LIMIT 1",
    [id, user.id, canSeeAll]
  );
  if (!currentRows.length) return res.status(404).json({ error: "Proposal not found or access denied." });
  const current = currentRows[0];
  const query = textOf(current);
  let matches = [], method = "keyword fallback";
  try {
    const semantic = await searchNvidiaPrecedents(query, user.id, canSeeAll, 12, id);
    if (semantic?.length) { matches = semantic; method = "NVIDIA Nemotron 3 Embed 1B semantic embeddings"; }
  } catch (e) {
    console.error("NVIDIA impact-brief retrieval unavailable; using keyword fallback:", e?.message || e);
  }
  if (!matches.length) matches = await lexicalSearch(current, user.id, canSeeAll, id);
  if (matches.length && String(matches[0].method || "").includes("Nemotron")) method = "NVIDIA Nemotron 3 Embed 1B semantic embeddings";
  const brief = impactBrief(matches);
  let generation = { status: "not_configured", assessment: null, model: CHAT_MODEL };
  try { generation = await generateImpactAssessment(brief, matches); }
  catch (e) {
    console.error("NVIDIA impact assessment generation unavailable:", e?.message || e);
    generation = { status: "provider_error", assessment: null, model: CHAT_MODEL };
  }
  brief.ai_assessment = generation.assessment;
  brief.ai_status = generation.status;
  brief.ai_model = generation.model;
  return res.json({ proposal_id: id, method, matches, impact_brief: brief });
}