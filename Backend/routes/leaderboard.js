// Exposes global account rankings using backend-owned progression and collection data.
import express from "express";
import pool from "../db.js";

const router = express.Router();
const LEADERBOARD_LIMIT = 20;

function toLeaderboardEntry(row, index) {
  return {
    rank: index + 1,
    userId: row.id,
    summonerName: row.summoner_name,
    tagline: row.tagline,
    displayName: `${row.summoner_name}#${row.tagline}`,
    appLevel: Number(row.app_level) || 1,
    appXp: Number(row.app_xp) || 0,
    championsUnlocked: Number(row.champions_unlocked) || 0,
    itemsBuilt: Number(row.items_built) || 0,
  };
}

router.get("/global", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         u.id,
         u.summoner_name,
         u.tagline,
         u.app_level,
         u.app_xp,
         COALESCE(champions.unlocked_count, 0) AS champions_unlocked,
         COALESCE(items.built_count, 0) AS items_built
       FROM users u
       LEFT JOIN (
         SELECT user_id, COUNT(*) AS unlocked_count
         FROM player_champions
         WHERE is_unlocked = true
         GROUP BY user_id
       ) champions ON champions.user_id = u.id
       LEFT JOIN (
         SELECT user_id, COUNT(*) AS built_count
         FROM player_item_levels
         GROUP BY user_id
       ) items ON items.user_id = u.id
       ORDER BY
         u.app_level DESC,
         u.app_xp DESC,
         COALESCE(champions.unlocked_count, 0) DESC,
         COALESCE(items.built_count, 0) DESC,
         u.created_at ASC
       LIMIT $1`,
      [LEADERBOARD_LIMIT],
    );

    return res.json({
      leaders: result.rows.map(toLeaderboardEntry),
      limit: LEADERBOARD_LIMIT,
    });
  } catch (error) {
    console.error("Global leaderboard error:", error);
    return res.status(500).json({ error: "Failed to load leaderboard" });
  }
});

export default router;
