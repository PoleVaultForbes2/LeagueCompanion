// Exposes champion roster metadata and unlock state from the backend champion engine.
import express from "express";
import dotenv from "dotenv";
import pool from "../db.js";
import {
  getChampionRoster,
  getRegionProgress,
} from "../services/championEngine.js";

dotenv.config();

const router = express.Router();
const RIOT_KEY = process.env.RIOT_API_KEY;

function parseUserId(value) {
  const userId = Number(value);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

router.get("/:userId/roster", async (req, res) => {
  const userId = parseUserId(req.params.userId);

  if (!userId) {
    return res.status(400).json({ error: "Valid user id is required" });
  }

  try {
    return res.json(await getChampionRoster(pool, userId, RIOT_KEY));
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }

    console.error("Champion roster error:", error);
    return res.status(500).json({ error: "Failed to load champion roster" });
  }
});

router.get("/:userId/regions", async (req, res) => {
  const userId = parseUserId(req.params.userId);

  if (!userId) {
    return res.status(400).json({ error: "Valid user id is required" });
  }

  try {
    return res.json(await getRegionProgress(pool, userId));
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }

    console.error("Region progress error:", error);
    return res.status(500).json({ error: "Failed to load region progress" });
  }
});

export default router;
