// Bootstraps the Express API server and mounts all League Companion route modules.
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// get league match data
import userRouter from "./routes/users.js";
import matchRouter from "./routes/matches.js";
import statsRouter from "./routes/stats.js";
import groupRouter from "./routes/groups.js";
import inventoryRouter from "./routes/inventory.js";
import craftingRouter from "./routes/crafting.js";
import championRouter from "./routes/champions.js";
import loadoutRouter from "./routes/loadout.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// API routes
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/users", userRouter);
app.use("/api/matches", matchRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/crafting", craftingRouter);
app.use("/api/champions", championRouter);
app.use("/api/loadout", loadoutRouter);
app.use("/api", statsRouter);
app.use("/api/groups", groupRouter);

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
