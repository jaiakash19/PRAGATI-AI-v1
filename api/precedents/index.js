import { db } from "hatchable";
import { indexProposals, EMBED_MODEL } from "lib/nvidia.js";

export const access = "user";
export const methods = ["POST"];

export default async function (req, res) {
  const user = req.user;
  const { rows: profiles } = await db.query("SELECT role FROM app_profiles WHERE user_id=$1", [user.id]);
  if (profiles[0]?.role !== "Admin") return res.status(403).json({ error: "Only an administrator can index the proposal archive." });
  if (!process.env.NVIDIA_API_KEY) {
    return res.status(503).json({ error: "NVIDIA_API_KEY is not configured. Add it in the project's secret settings, then retry archive indexing." });
  }
  const { rows } = await db.query("SELECT id FROM proposals ORDER BY created_at DESC LIMIT 500");
  try {
    const result = await indexProposals(rows.map(p => p.id));
    if (result.status !== "ready") return res.status(503).json({
      error: "Archive indexing was incomplete (" + result.indexed + " of " + result.total + "). Retry later if NVIDIA's free endpoint is rate limited."
    });
    return res.json({
      ok: true, indexed: result.indexed, total: result.total,
      embedding_model: EMBED_MODEL, dimensions: 2048, ranking: "cosine similarity",
      message: "The latest " + result.indexed + " proposals were indexed with NVIDIA Nemotron 3 Embed 1B."
    });
  } catch (e) {
    console.error("NVIDIA archive indexing failed:", e?.message || e);
    return res.status(503).json({ error: "NVIDIA embedding failed. Check the key, endpoint availability and free-tier rate limits, then retry." });
  }
}