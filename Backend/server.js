// Bootstraps the Express API server and mounts all League Companion route modules.
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool from "./db.js";

// get league match data
import userRouter from "./routes/users.js";
import matchRouter from "./routes/matches.js";
import statsRouter from "./routes/stats.js";
import groupRouter from "./routes/groups.js";
import inventoryRouter from "./routes/inventory.js";
import craftingRouter from "./routes/crafting.js";
import championRouter from "./routes/champions.js";
import loadoutRouter from "./routes/loadout.js";
import missionRouter from "./routes/missions.js";
import leaderboardRouter from "./routes/leaderboard.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;
const allowedOrigins = String(process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (
        !origin ||
        origin.startsWith("http://localhost:") ||
        origin.endsWith(".vercel.app") ||
        allowedOrigins.includes(origin)
      ) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    },
  }),
);
app.use(express.json());

// API routes
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/health/db", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        NOW() AS checked_at,
        to_regclass('public.users') AS users_table,
        to_regclass('public.match_checkpoints') AS matches_table
    `);
    const row = result.rows[0];

    res.json({
      status: row.users_table && row.matches_table ? "ok" : "schema_missing",
      checkedAt: row.checked_at,
      tables: {
        users: Boolean(row.users_table),
        matchCheckpoints: Boolean(row.matches_table),
      },
    });
  } catch (error) {
    console.error("Database health check failed:", error);
    res.status(500).json({
      status: "error",
      error: "Database connection failed",
      code: error.code || null,
    });
  }
});

app.use("/api/users", userRouter);
app.use("/api/matches", matchRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/crafting", craftingRouter);
app.use("/api/champions", championRouter);
app.use("/api/loadout", loadoutRouter);
app.use("/api/missions", missionRouter);
app.use("/api/leaderboard", leaderboardRouter);
app.use("/api", statsRouter);
app.use("/api/groups", groupRouter);

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
