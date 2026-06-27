// Owns trial mission definitions, active mission state, and backend-validated mission rewards.
import { applyXpProgression, getXpForNextLevel } from "./rewardEngine.js";

const MISSION_STATUSES = ["available", "active", "completed"];
const SHURIMA_REGION_KEY = "shurima";

const TRIAL_MISSION = {
  key: "first_mission",
  title: "First Mission",
  region: "Shurima",
  description: "Help us find the lost treasure in Shurima",
  requirementText: "Must be level 1",
  requiredLevel: 1,
  requiredChampionSlug: "aatrox",
  status: "available",
  giver: {
    name: "Azir",
    spritePath: "/assets/champion%20spries/azirSprite.png",
  },
  hero: {
    name: "Aatrox",
    spritePath: "/assets/champion%20spries/aatorxSprite.png",
  },
  scene: {
    backgrounds: [
      "/assets/scenes/shurmia1.png",
      "/assets/scenes/shurmia2.png",
    ],
    dialogue: [
      {
        speaker: "Azir",
        text: "The sands whisper of a relic buried beneath Shurima's old roads.",
      },
      {
        speaker: "Aatrox",
        text: "I did not come to chase trinkets through dust.",
      },
      {
        speaker: "Azir",
        text: "Then call it a weapon, Darkin. Help me find it before raiders do.",
      },
      {
        speaker: "Aatrox",
        text: "Very well. Point me toward the fools guarding your treasure.",
      },
      {
        speaker: "Narrator",
        text: "Together, Azir and Aatrox cross the dunes as the buried path begins to glow.",
      },
    ],
  },
  rewards: [
    {
      type: "xp",
      label: "App XP",
      quantity: 50,
      text: "+50 XP",
    },
    {
      type: "region_points",
      label: "Shurima Region Points",
      quantity: 5,
      text: "+5 Shurima Region Points",
    },
  ],
};

const MISSIONS = [TRIAL_MISSION];
const MISSION_BY_KEY = new Map(MISSIONS.map((mission) => [mission.key, mission]));

function createMissionError(message, status = 400, details = null) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

function toMissionDto(mission, row = null) {
  const status = MISSION_STATUSES.includes(row?.status)
    ? row.status
    : mission.status;

  return {
    ...mission,
    status,
    isActive: status === "active",
    isCompleted: status === "completed",
    acceptedAt: row?.accepted_at || null,
    completedAt: row?.completed_at || null,
  };
}

async function getUserForMission(db, userId) {
  const result = await db.query(
    `SELECT id, app_level, app_xp
     FROM users
     WHERE id = $1`,
    [userId],
  );
  const user = result.rows[0];

  if (!user) {
    throw createMissionError("User not found", 404);
  }

  return user;
}

export async function ensurePlayerMissionsTable(db) {
  await db.query(
    `CREATE TABLE IF NOT EXISTS player_missions (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      mission_key VARCHAR(80) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'available'
        CHECK (status IN ('available', 'active', 'completed')),
      accepted_at TIMESTAMP WITH TIME ZONE,
      completed_at TIMESTAMP WITH TIME ZONE,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id, mission_key)
    )`,
  );

  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_player_missions_user_status
     ON player_missions(user_id, status)`,
  );
}

async function ensurePlayerRegionPointsTable(db) {
  await db.query(
    `CREATE TABLE IF NOT EXISTS player_region_points (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      region_key VARCHAR(80) NOT NULL,
      region_name VARCHAR(80) NOT NULL,
      points INT NOT NULL DEFAULT 0 CHECK (points >= 0),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id, region_key)
    )`,
  );

  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_player_region_points_user_id
     ON player_region_points(user_id)`,
  );
}

async function getMissionRowsByKey(db, userId) {
  const result = await db.query(
    `SELECT mission_key, status, accepted_at, completed_at
     FROM player_missions
     WHERE user_id = $1`,
    [userId],
  );

  return new Map(result.rows.map((row) => [row.mission_key, row]));
}

async function getMissionStateForUser(db, userId) {
  await ensurePlayerMissionsTable(db);
  await getUserForMission(db, userId);

  const rowsByKey = await getMissionRowsByKey(db, userId);
  const missions = MISSIONS.map((mission) =>
    toMissionDto(mission, rowsByKey.get(mission.key)),
  );

  return {
    missions,
    activeMission: missions.find((mission) => mission.isActive) || null,
  };
}

export async function getMissionState(db, userId) {
  return getMissionStateForUser(db, userId);
}

export async function acceptMission(db, userId, missionKey) {
  await ensurePlayerMissionsTable(db);

  const mission = MISSION_BY_KEY.get(missionKey);

  if (!mission) {
    throw createMissionError("Mission not found", 404);
  }

  const user = await getUserForMission(db, userId);

  if ((Number(user.app_level) || 1) < mission.requiredLevel) {
    throw createMissionError(mission.requirementText, 400, {
      requiredLevel: mission.requiredLevel,
    });
  }

  await db.query(
    `UPDATE player_missions
     SET status = 'available',
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $1
     AND status = 'active'
     AND mission_key <> $2`,
    [userId, mission.key],
  );

  await db.query(
    `INSERT INTO player_missions
       (user_id, mission_key, status, accepted_at, updated_at)
     VALUES ($1, $2, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id, mission_key)
     DO UPDATE SET
       status = 'active',
       accepted_at = COALESCE(player_missions.accepted_at, CURRENT_TIMESTAMP),
       completed_at = NULL,
       updated_at = CURRENT_TIMESTAMP`,
    [userId, mission.key],
  );

  return getMissionStateForUser(db, userId);
}

async function addRegionPoints(db, userId, regionName, points) {
  await ensurePlayerRegionPointsTable(db);

  await db.query(
    `INSERT INTO player_region_points
       (user_id, region_key, region_name, points, updated_at)
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id, region_key)
     DO UPDATE SET
       region_name = EXCLUDED.region_name,
       points = player_region_points.points + EXCLUDED.points,
       updated_at = CURRENT_TIMESTAMP`,
    [userId, SHURIMA_REGION_KEY, regionName, points],
  );
}

export async function completeMission(db, userId, missionKey) {
  await ensurePlayerMissionsTable(db);

  const mission = MISSION_BY_KEY.get(missionKey);

  if (!mission) {
    throw createMissionError("Mission not found", 404);
  }

  const client = await db.connect();

  try {
    await client.query("BEGIN");
    const user = await getUserForMission(client, userId);
    const missionRowResult = await client.query(
      `SELECT status
       FROM player_missions
       WHERE user_id = $1
       AND mission_key = $2
       FOR UPDATE`,
      [userId, mission.key],
    );
    const missionRow = missionRowResult.rows[0];

    if (!missionRow || missionRow.status !== "active") {
      throw createMissionError("Mission is not active", 400);
    }

    await client.query(
      `UPDATE player_missions
       SET status = 'completed',
           completed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1
       AND mission_key = $2`,
      [userId, mission.key],
    );

    const xpReward =
      mission.rewards.find((reward) => reward.type === "xp")?.quantity || 0;
    const progression = applyXpProgression(
      user.app_level,
      user.app_xp,
      xpReward,
    );

    const userResult = await client.query(
      `UPDATE users
       SET app_level = $2,
           app_xp = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, summoner_name, tagline, summoner_level, app_level, app_xp, cs_currency, created_at, updated_at`,
      [userId, progression.appLevel, progression.appXp],
    );

    const regionReward =
      mission.rewards.find((reward) => reward.type === "region_points")
        ?.quantity || 0;
    await addRegionPoints(client, userId, mission.region, regionReward);

    const missionState = await getMissionStateForUser(client, userId);
    const completion = {
      missionState,
      user: {
        id: userResult.rows[0].id,
        summonerName: userResult.rows[0].summoner_name,
        tagline: userResult.rows[0].tagline,
        summonerLevel: userResult.rows[0].summoner_level,
        appLevel: userResult.rows[0].app_level,
        appXp: userResult.rows[0].app_xp,
        xpToNextLevel: getXpForNextLevel(userResult.rows[0].app_level),
        csCurrency: Number(userResult.rows[0].cs_currency) || 0,
        createdAt: userResult.rows[0].created_at,
        updatedAt: userResult.rows[0].updated_at,
      },
      rewards: mission.rewards,
      progression,
    };

    await client.query("COMMIT");

    return completion;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
