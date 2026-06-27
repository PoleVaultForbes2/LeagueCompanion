// Exposes backend-owned mission state, mission acceptance, and completion endpoints.
import express from "express";
import pool from "../db.js";
import {
  acceptMission,
  completeMission,
  getMissionState,
} from "../services/missionEngine.js";

const router = express.Router();

function parseUserId(value) {
  const userId = Number(value);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

function sendMissionError(res, error, fallbackMessage) {
  if (error.status) {
    return res.status(error.status).json({
      error: error.message,
      details: error.details || null,
    });
  }

  console.error(fallbackMessage, error);
  return res.status(500).json({ error: fallbackMessage });
}

router.get("/:userId", async (req, res) => {
  const userId = parseUserId(req.params.userId);

  if (!userId) {
    return res.status(400).json({ error: "Valid user id is required" });
  }

  try {
    return res.json(await getMissionState(pool, userId));
  } catch (error) {
    return sendMissionError(res, error, "Failed to load missions");
  }
});

router.post("/:userId/:missionKey/accept", async (req, res) => {
  const userId = parseUserId(req.params.userId);
  const missionKey = String(req.params.missionKey || "").trim();

  if (!userId || !missionKey) {
    return res
      .status(400)
      .json({ error: "Valid user id and mission key are required" });
  }

  try {
    const missionState = await acceptMission(pool, userId, missionKey);
    return res.json({ success: true, missionState });
  } catch (error) {
    return sendMissionError(res, error, "Failed to accept mission");
  }
});

router.post("/:userId/:missionKey/complete", async (req, res) => {
  const userId = parseUserId(req.params.userId);
  const missionKey = String(req.params.missionKey || "").trim();

  if (!userId || !missionKey) {
    return res
      .status(400)
      .json({ error: "Valid user id and mission key are required" });
  }

  try {
    const completion = await completeMission(pool, userId, missionKey);
    return res.json({ success: true, ...completion });
  } catch (error) {
    return sendMissionError(res, error, "Failed to complete mission");
  }
});

export default router;
