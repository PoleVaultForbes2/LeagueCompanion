// Handles account registration, login, Riot account linking, and user profile reads.
import express from "express";
import dotenv from "dotenv";
import pool from "../db.js";
import { hashPassword, verifyPassword } from "../services/passwordHash.js";
import { ensureStarterChampions } from "../services/championEngine.js";
import { getXpForNextLevel } from "../services/rewardEngine.js";
import { getRiotAccountById, RiotApiError } from "../services/riotAPI.js";

dotenv.config();

const router = express.Router();
const RIOT_KEY = process.env.RIOT_API_KEY;

function normalizeRiotId(value) {
  return String(value || "").trim();
}

function normalizeTagline(value) {
  return normalizeRiotId(value).replace(/^#/, "").toUpperCase();
}

function toUserDto(row) {
  return {
    id: row.id,
    summonerName: row.summoner_name,
    tagline: row.tagline,
    summonerLevel: row.summoner_level,
    appLevel: row.app_level,
    appXp: row.app_xp,
    xpToNextLevel: getXpForNextLevel(row.app_level),
    csCurrency: Number(row.cs_currency) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function readCredentials(body) {
  return {
    summonerName: normalizeRiotId(body.summonerName || body.gameName),
    tagline: normalizeTagline(body.tagline || body.tagLine),
    password: String(body.password || ""),
  };
}

function validateCredentials({ summonerName, tagline, password }) {
  if (!summonerName || !tagline || !password) {
    return "Summoner name, tagline, and password are required";
  }

  if (password.length < 6) {
    return "Password must be at least 6 characters";
  }

  return "";
}

function sendRiotError(res, error) {
  if (!(error instanceof RiotApiError)) {
    console.error("Unexpected user link error:", error);
    return res.status(500).json({ error: "Unable to link Riot account" });
  }

  if (error.status === 404) {
    return res.status(404).json({ error: "Riot account not found" });
  }

  if (error.status === 429) {
    return res.status(429).json({ error: "Riot API rate limit reached" });
  }

  if (error.status === 401 || error.status === 403) {
    return res.status(502).json({ error: "Riot API key was rejected" });
  }

  return res.status(502).json({ error: "Riot API request failed" });
}

function looksLikeDatabaseError(error) {
  const message = String(error?.message || "").toLowerCase();

  return (
    Boolean(error?.code) ||
    message.includes("database") ||
    message.includes("relation") ||
    message.includes("connection") ||
    message.includes("connect") ||
    message.includes("password authentication")
  );
}

function sendRegistrationError(res, error) {
  if (error instanceof RiotApiError) {
    return sendRiotError(res, error);
  }

  console.error("Register error:", error);

  if (looksLikeDatabaseError(error)) {
    return res.status(500).json({
      error:
        "Database setup failed. Check the Supabase DATABASE_URL and run the schema SQL.",
    });
  }

  return res.status(500).json({ error: "Failed to create account" });
}

async function ensureUserProgressColumns(db) {
  await db.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS cs_currency INT NOT NULL DEFAULT 0
  `);
}

router.post("/register", async (req, res) => {
  const credentials = readCredentials(req.body);
  const validationError = validateCredentials(credentials);

  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  try {
    await ensureUserProgressColumns(pool);

    const account = await getRiotAccountById(
      credentials.summonerName,
      credentials.tagline,
      RIOT_KEY,
    );

    const existingUser = await pool.query(
      "SELECT id, password_hash FROM users WHERE riot_puuid = $1",
      [account.puuid],
    );

    if (existingUser.rows[0]?.password_hash) {
      return res.status(409).json({ error: "Account already exists" });
    }

    const passwordHash = await hashPassword(credentials.password);
    const result = await pool.query(
      `INSERT INTO users (summoner_name, tagline, riot_puuid, password_hash)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (riot_puuid)
       DO UPDATE SET
         summoner_name = EXCLUDED.summoner_name,
          tagline = EXCLUDED.tagline,
          password_hash = EXCLUDED.password_hash,
          updated_at = CURRENT_TIMESTAMP
       RETURNING id, summoner_name, tagline, riot_puuid, summoner_level, app_level, app_xp, cs_currency, created_at, updated_at`,
      [
        account.gameName || credentials.summonerName,
        account.tagLine || credentials.tagline,
        account.puuid,
        passwordHash,
      ],
    );

    try {
      await ensureStarterChampions(pool, result.rows[0], RIOT_KEY, {
        forceRefresh: true,
      });
    } catch (starterError) {
      console.warn(
        "[users] Starter champion initialization failed:",
        starterError.message,
      );
    }

    return res.status(201).json({ user: toUserDto(result.rows[0]) });
  } catch (error) {
    return sendRegistrationError(res, error);
  }
});

router.post("/login", async (req, res) => {
  const credentials = readCredentials(req.body);

  if (!credentials.summonerName || !credentials.tagline || !credentials.password) {
    return res
      .status(400)
      .json({ error: "Summoner name, tagline, and password are required" });
  }

  try {
    await ensureUserProgressColumns(pool);

    const result = await pool.query(
      `SELECT id, summoner_name, tagline, summoner_level, app_level, app_xp, cs_currency, password_hash, created_at, updated_at
       FROM users
       WHERE LOWER(summoner_name) = LOWER($1)
       AND LOWER(tagline) = LOWER($2)`,
      [credentials.summonerName, credentials.tagline],
    );

    const user = result.rows[0];

    if (!user || !(await verifyPassword(credentials.password, user.password_hash))) {
      return res.status(401).json({ error: "Invalid login credentials" });
    }

    return res.json({ user: toUserDto(user) });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Failed to log in" });
  }
});

router.get("/:userId", async (req, res) => {
  const userId = Number(req.params.userId);

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: "Valid user id is required" });
  }

  try {
    await ensureUserProgressColumns(pool);

    const result = await pool.query(
      `SELECT id, summoner_name, tagline, summoner_level, app_level, app_xp, cs_currency, created_at, updated_at
       FROM users
       WHERE id = $1`,
      [userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({ user: toUserDto(result.rows[0]) });
  } catch (error) {
    console.error("User lookup error:", error);
    return res.status(500).json({ error: "Failed to load user" });
  }
});

export default router;
