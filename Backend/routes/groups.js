// Handles simple player group creation, membership, and group member listing.
import express from "express";
import pool from "../db.js";

const router = express.Router();

function toMemberDto(row) {
  return {
    id: row.id,
    summonerName: row.summoner_name,
    tagline: row.tagline,
    displayName: `${row.summoner_name}#${row.tagline}`,
  };
}

router.post("/join", async (req, res) => {
  try {
    const userId = Number(req.body.userId);
    const groupName = String(req.body.groupName || "").trim();

    if (!Number.isInteger(userId) || userId <= 0 || !groupName) {
      return res
        .status(400)
        .json({ error: "Valid user id and group name are required" });
    }

    const userResult = await pool.query("SELECT id FROM users WHERE id = $1", [
      userId,
    ]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const groupResult = await pool.query(
      `INSERT INTO groups (name)
       VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [groupName],
    );

    await pool.query(
      `INSERT INTO group_members (group_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (group_id, user_id) DO NOTHING`,
      [groupResult.rows[0].id, userId],
    );

    return res.json({ success: true, message: `Joined group ${groupName}` });
  } catch (error) {
    console.error("Join group error:", error);
    return res.status(500).json({ error: "Failed to join group" });
  }
});

router.get("/:groupName", async (req, res) => {
  try {
    const groupName = String(req.params.groupName || "").trim();

    const groupResult = await pool.query("SELECT id FROM groups WHERE name = $1", [
      groupName,
    ]);

    if (groupResult.rows.length === 0) {
      return res.status(404).json({ error: "Group not found" });
    }

    const membersResult = await pool.query(
      `SELECT u.id, u.summoner_name, u.tagline
       FROM group_members gm
       JOIN users u ON gm.user_id = u.id
       WHERE gm.group_id = $1
       ORDER BY u.summoner_name`,
      [groupResult.rows[0].id],
    );

    return res.json(membersResult.rows.map(toMemberDto));
  } catch (error) {
    console.error("Fetch group error:", error);
    return res.status(500).json({ error: "Failed to fetch group data" });
  }
});

export default router;
