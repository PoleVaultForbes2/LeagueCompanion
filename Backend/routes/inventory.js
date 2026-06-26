// Exposes player shard inventory counts calculated from persisted backend state.
import express from "express";
import pool from "../db.js";
import {
  buyShardWithCs,
  CS_COST_PER_SHARD,
  getShardInventoryForUser,
} from "../services/inventoryStore.js";

const router = express.Router();

function parseUserId(value) {
  const userId = Number(value);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

router.get("/:userId/shards", async (req, res) => {
  const userId = parseUserId(req.params.userId);

  if (!userId) {
    return res.status(400).json({ error: "Valid user id is required" });
  }

  try {
    const userResult = await pool.query("SELECT id FROM users WHERE id = $1", [
      userId,
    ]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const shards = await getShardInventoryForUser(pool, userId);
    const totalShards = shards.reduce(
      (total, shard) => total + shard.quantity,
      0,
    );

    return res.json({
      shards,
      totalShards,
      shop: {
        costPerShard: CS_COST_PER_SHARD,
      },
    });
  } catch (error) {
    console.error("Shard inventory error:", error);
    return res.status(500).json({ error: "Failed to load shard inventory" });
  }
});

router.post("/:userId/shards/buy", async (req, res) => {
  const userId = parseUserId(req.params.userId);
  const shardKey = String(req.body?.shardKey || "").trim();
  const quantity = Math.floor(Number(req.body?.quantity) || 1);

  if (!userId) {
    return res.status(400).json({ error: "Valid user id is required" });
  }

  try {
    const purchase = await buyShardWithCs(pool, userId, shardKey, quantity);

    return res.json({
      success: true,
      ...purchase,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        error: error.message,
        details: error.details || null,
      });
    }

    console.error("Shard purchase error:", error);
    return res.status(500).json({ error: "Failed to buy shard" });
  }
});

export default router;
