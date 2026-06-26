// Builds lightweight group and global leaderboard summaries from stored matches.
import express from "express";
import pool from "../db.js";

const router = express.Router();

function toLeaderboardEntry(user, matches) {
  const kills = matches.reduce((total, match) => total + match.kills, 0);
  const deaths = matches.reduce((total, match) => total + match.deaths, 0);
  const assists = matches.reduce((total, match) => total + match.assists, 0);
  const wins = matches.filter((match) => match.win).length;

  return {
    userId: user.id,
    summonerName: user.summoner_name,
    tagline: user.tagline,
    displayName: `${user.summoner_name}#${user.tagline}`,
    kda: Number(((kills + assists) / Math.max(1, deaths)).toFixed(2)),
    winRate: Number(((wins / matches.length) * 100).toFixed(0)),
  };
}

async function getLeaderboardUsers(groupName) {
  if (!groupName || groupName === "*all") {
    const usersResult = await pool.query(
      "SELECT id, summoner_name, tagline FROM users ORDER BY summoner_name",
    );
    return usersResult.rows;
  }

  const groupResult = await pool.query("SELECT id FROM groups WHERE name = $1", [
    groupName,
  ]);

  if (groupResult.rows.length === 0) {
    return null;
  }

  const membersResult = await pool.query(
    `SELECT u.id, u.summoner_name, u.tagline
     FROM group_members gm
     JOIN users u ON gm.user_id = u.id
     WHERE gm.group_id = $1
     ORDER BY u.summoner_name`,
    [groupResult.rows[0].id],
  );

  return membersResult.rows;
}

router.get("/leaderboard", async (req, res) => {
  try {
    const { groupName } = req.query;
    const users = await getLeaderboardUsers(groupName);

    if (users === null) {
      return res.status(404).json({ error: "Group not found" });
    }

    const results = await Promise.all(
      users.map(async (user) => {
        const matchesResult = await pool.query(
          `SELECT kills, deaths, assists, win
           FROM match_checkpoints
           WHERE user_id = $1
           ORDER BY processed_at DESC
           LIMIT 5`,
          [user.id],
        );

        if (matchesResult.rows.length === 0) {
          return null;
        }

        return toLeaderboardEntry(user, matchesResult.rows);
      }),
    );

    const rankedUsers = results.filter(Boolean);
    let topKDA = [...rankedUsers].sort((a, b) => b.kda - a.kda);
    let topWinRate = [...rankedUsers].sort((a, b) => b.winRate - a.winRate);

    if (!groupName || groupName === "*all") {
      topKDA = topKDA.slice(0, 3);
      topWinRate = topWinRate.slice(0, 3);
    }

    return res.json({ topKDA, topWinRate });
  } catch (error) {
    console.error("Leaderboard error:", error);
    return res.status(500).json({ error: "Failed to get leaderboard" });
  }
});

export default router;
