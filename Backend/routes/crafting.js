// Exposes backend-validated crafting and item upgrade endpoints to the React UI.
import express from "express";
import pool from "../db.js";
import { craftItem, getCraftingState, upgradeItem } from "../services/craftingEngine.js";

const router = express.Router();

function parseUserId(value) {
  const userId = Number(value);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

function parseSelectedShardKeys(value) {
  return Array.isArray(value)
    ? value.map((shardKey) => String(shardKey || "").trim()).filter(Boolean)
    : [];
}

async function ensureUserExists(userId) {
  const result = await pool.query("SELECT id FROM users WHERE id = $1", [userId]);
  return Boolean(result.rows[0]);
}

router.get("/:userId", async (req, res) => {
  const userId = parseUserId(req.params.userId);

  if (!userId) {
    return res.status(400).json({ error: "Valid user id is required" });
  }

  try {
    if (!(await ensureUserExists(userId))) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json(await getCraftingState(pool, userId));
  } catch (error) {
    console.error("Crafting state error:", error);
    return res.status(500).json({ error: "Failed to load crafting state" });
  }
});

router.post("/:userId/craft", async (req, res) => {
  const userId = parseUserId(req.params.userId);
  const itemName = String(req.body?.itemName || "").trim();
  const selectedShardKeys = parseSelectedShardKeys(req.body?.selectedShardKeys);

  if (!userId || !itemName) {
    return res
      .status(400)
      .json({ error: "Valid user id and item name are required" });
  }

  try {
    if (!(await ensureUserExists(userId))) {
      return res.status(404).json({ error: "User not found" });
    }

    const craftingState = await craftItem(pool, userId, itemName, selectedShardKeys);
    return res.json({ success: true, crafting: craftingState });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        error: error.message,
        item: error.details || null,
      });
    }

    console.error("Craft item error:", error);
    return res.status(500).json({ error: "Failed to craft item" });
  }
});

router.post("/:userId/upgrade", async (req, res) => {
  const userId = parseUserId(req.params.userId);
  const itemName = String(req.body?.itemName || "").trim();
  const selectedShardKeys = parseSelectedShardKeys(req.body?.selectedShardKeys);

  if (!userId || !itemName) {
    return res
      .status(400)
      .json({ error: "Valid user id and item name are required" });
  }

  try {
    if (!(await ensureUserExists(userId))) {
      return res.status(404).json({ error: "User not found" });
    }

    const craftingState = await upgradeItem(pool, userId, itemName, selectedShardKeys);
    return res.json({ success: true, crafting: craftingState });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        error: error.message,
        item: error.details || null,
      });
    }

    console.error("Upgrade item error:", error);
    return res.status(500).json({ error: "Failed to upgrade item" });
  }
});

export default router;
