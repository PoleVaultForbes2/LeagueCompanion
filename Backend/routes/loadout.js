// Exposes active champion and backpack loadout endpoints for the authenticated UI.
import express from "express";
import dotenv from "dotenv";
import pool from "../db.js";
import {
  getLoadoutState,
  setActiveChampion,
  setBackpackItem,
} from "../services/loadoutEngine.js";

dotenv.config();

const router = express.Router();
const RIOT_KEY = process.env.RIOT_API_KEY;

function parseUserId(value) {
  const userId = Number(value);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
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

    return res.json(await getLoadoutState(pool, userId, RIOT_KEY));
  } catch (error) {
    console.error("Loadout state error:", error);
    return res.status(500).json({ error: "Failed to load active setup" });
  }
});

router.post("/:userId/champion", async (req, res) => {
  const userId = parseUserId(req.params.userId);
  const championSlug = String(req.body?.championSlug || "").trim();

  if (!userId || !championSlug) {
    return res
      .status(400)
      .json({ error: "Valid user id and champion are required" });
  }

  try {
    if (!(await ensureUserExists(userId))) {
      return res.status(404).json({ error: "User not found" });
    }

    const loadout = await setActiveChampion(pool, userId, championSlug, RIOT_KEY);
    return res.json({ success: true, loadout });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }

    console.error("Set active champion error:", error);
    return res.status(500).json({ error: "Failed to set active champion" });
  }
});

router.post("/:userId/backpack", async (req, res) => {
  const userId = parseUserId(req.params.userId);
  const itemName = String(req.body?.itemName || "").trim();
  const slotIndex = req.body?.slotIndex;

  if (!userId || !itemName) {
    return res.status(400).json({ error: "Valid user id and item are required" });
  }

  try {
    if (!(await ensureUserExists(userId))) {
      return res.status(404).json({ error: "User not found" });
    }

    const loadout = await setBackpackItem(
      pool,
      userId,
      itemName,
      slotIndex,
      RIOT_KEY,
    );
    return res.json({ success: true, loadout });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        error: error.message,
        loadout: error.details || null,
      });
    }

    console.error("Set backpack item error:", error);
    return res.status(500).json({ error: "Failed to update backpack" });
  }
});

export default router;
