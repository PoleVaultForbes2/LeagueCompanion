// Handles Riot match synchronization, stored recent-game history, rewards, and champion progress.
import express from "express";
import dotenv from "dotenv";
import pool from "../db.js";
import {
  getDataDragonVersion,
  getDataDragonItemDictionary,
  getMatchDetails,
  getRecentMatches,
  RiotApiError,
} from "../services/riotAPI.js";
import {
  applyXpProgression,
  buildRewardClaimPayload,
  calculateMatchReward,
  getParticipantItemIds,
  getXpForNextLevel,
  mergeShardTotals,
} from "../services/rewardEngine.js";
import { incrementShardInventory } from "../services/inventoryStore.js";
import {
  backfillRegionPointsFromStoredMatches,
  getChampionProgressionState,
  recordChampionProgress,
  toChampionSlugFromRiotName,
} from "../services/championEngine.js";

dotenv.config();

const router = express.Router();
const RIOT_KEY = process.env.RIOT_API_KEY;
const FIRST_SYNC_MATCH_COUNT = 10;
const MAX_SYNC_LOOKBACK = 20;
const MAX_STORED_MATCHES = 20;
const DDRAGON_BASE_URL = "https://ddragon.leagueoflegends.com";

function toMatchDto(row) {
  return {
    id: row.id,
    matchId: row.match_id,
    userId: row.user_id,
    championPlayed: row.champion_played,
    championPlayedSlug: row.champion_played_slug || null,
    championKillCounts: parseJsonObject(row.champion_kill_counts),
    kills: row.kills,
    deaths: row.deaths,
    assists: row.assists,
    win: row.win,
    queueId: row.queue_id,
    gameMode: row.game_mode,
    gameDurationSeconds: row.game_duration_seconds,
    gameEndedAt: row.game_ended_at,
    itemIds: parseJsonArray(row.item_ids),
    processedAt: row.processed_at,
  };
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
    checkpointGameId: row.checkpoint_game_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getChampionIconUrl(championName, dataDragonVersion) {
  if (!championName || !dataDragonVersion) {
    return null;
  }

  return `${DDRAGON_BASE_URL}/cdn/${dataDragonVersion}/img/champion/${championName}.png`;
}

function formatDuration(totalSeconds) {
  const seconds = Number(totalSeconds) || 0;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}m ${String(remainingSeconds).padStart(2, "0")}s`;
}

function getKdaText(row) {
  return `${row.kills} / ${row.deaths} / ${row.assists}`;
}

function getKdaRatio(row) {
  return Number(
    (((row.kills || 0) + (row.assists || 0)) / Math.max(1, row.deaths || 0)).toFixed(
      2,
    ),
  );
}

function toRecentGameDto(row, itemDictionary, dataDragonVersion) {
  const itemIds = parseJsonArray(row.item_ids)
    .map((itemId) => Number(itemId))
    .filter((itemId) => Number.isInteger(itemId) && itemId > 0);

  return {
    id: row.id,
    matchId: row.match_id,
    champion: {
      name: row.champion_played,
      iconUrl: getChampionIconUrl(row.champion_played, dataDragonVersion),
    },
    result: row.win ? "Victory" : "Defeat",
    win: row.win,
    kda: {
      kills: row.kills,
      deaths: row.deaths,
      assists: row.assists,
      text: getKdaText(row),
      ratio: getKdaRatio(row),
    },
    items: itemIds.map((itemId) => {
      const item = itemDictionary.get(itemId);

      return {
        id: itemId,
        name: item?.name || "Unknown Item",
        iconUrl:
          item?.iconUrl ||
          `${DDRAGON_BASE_URL}/cdn/${dataDragonVersion}/img/item/${itemId}.png`,
      };
    }),
    queueId: row.queue_id,
    gameMode: row.game_mode || "Matchmade",
    duration: {
      seconds: row.game_duration_seconds || 0,
      text: formatDuration(row.game_duration_seconds),
    },
    gameEndedAt: row.game_ended_at || row.processed_at,
    processedAt: row.processed_at,
  };
}

function parseUserId(value) {
  const userId = Number(value);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

function parseJsonArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonObject(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }

  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function getChampionProgressForMatch(participant) {
  const playedChampionSlug = toChampionSlugFromRiotName(participant?.championName);

  return {
    playedChampionSlug,
    killsOnChampion: Math.max(0, Math.floor(Number(participant?.kills) || 0)),
  };
}

async function ensureMatchSyncColumns(db) {
  await db.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS checkpoint_game_id VARCHAR(50),
      ADD COLUMN IF NOT EXISTS cs_currency INT NOT NULL DEFAULT 0
  `);

  await db.query(`
    ALTER TABLE match_checkpoints
      ADD COLUMN IF NOT EXISTS item_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS champion_played_slug VARCHAR(80),
      ADD COLUMN IF NOT EXISTS champion_kill_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS queue_id INT,
      ADD COLUMN IF NOT EXISTS game_mode VARCHAR(40),
      ADD COLUMN IF NOT EXISTS game_duration_seconds INT,
      ADD COLUMN IF NOT EXISTS game_ended_at TIMESTAMP WITH TIME ZONE
  `);

  await db.query(`
    DO $$
    DECLARE
      old_constraint_name text;
    BEGIN
      FOR old_constraint_name IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_attribute a
          ON a.attrelid = c.conrelid
         AND a.attnum = ANY(c.conkey)
        WHERE c.conrelid = 'match_checkpoints'::regclass
          AND c.contype = 'u'
          AND array_length(c.conkey, 1) = 1
          AND a.attname = 'match_id'
      LOOP
        EXECUTE format(
          'ALTER TABLE match_checkpoints DROP CONSTRAINT %I',
          old_constraint_name
        );
      END LOOP;
    END $$;
  `);

  await db.query(`
    ALTER TABLE match_checkpoints
    DROP CONSTRAINT IF EXISTS match_checkpoints_user_id_match_id_key
  `);

  await db.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'match_checkpoints'::regclass
          AND conname = 'unique_user_match'
      ) THEN
        ALTER TABLE match_checkpoints
        ADD CONSTRAINT unique_user_match UNIQUE (user_id, match_id);
      END IF;
    END $$;
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_checkpoints_user_champion_slug
    ON match_checkpoints(user_id, champion_played_slug)
  `);
}

async function getUserForSync(userId) {
  const result = await pool.query(
    `SELECT id, summoner_name, tagline, riot_puuid, summoner_level, app_level, app_xp, cs_currency, checkpoint_game_id, created_at, updated_at
     FROM users
     WHERE id = $1`,
    [userId],
  );

  return result.rows[0] || null;
}

async function getStoredCheckpointGameId(db, userId) {
  const result = await db.query(
    `SELECT match_id
     FROM match_checkpoints
     WHERE user_id = $1
     ORDER BY game_ended_at DESC NULLS LAST,
              processed_at DESC
     LIMIT 1`,
    [userId],
  );

  return result.rows[0]?.match_id || null;
}

async function updateCheckpointGame(db, userId, checkpointGameId) {
  if (!checkpointGameId) {
    return null;
  }

  const result = await db.query(
    `UPDATE users
     SET checkpoint_game_id = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING id, summoner_name, tagline, riot_puuid, summoner_level, app_level, app_xp, cs_currency, checkpoint_game_id, created_at, updated_at`,
    [userId, checkpointGameId],
  );

  return result.rows[0] || null;
}

async function trimStoredMatches(db, userId) {
  await db.query(
    `DELETE FROM match_checkpoints
     WHERE user_id = $1
     AND id NOT IN (
       SELECT id
       FROM match_checkpoints
       WHERE user_id = $1
       ORDER BY processed_at DESC
       LIMIT $2
     )`,
    [userId, MAX_STORED_MATCHES],
  );
}

async function backfillRecentMatchMetadata(db, user, row) {
  if (parseJsonArray(row.item_ids).length > 0) {
    return row;
  }

  try {
    const match = await getMatchDetails(row.match_id, RIOT_KEY);
    const participant = match.info?.participants?.find(
      (player) => player.puuid === user.riot_puuid,
    );

    if (!participant) {
      return row;
    }

    const result = await db.query(
      `UPDATE match_checkpoints
       SET item_ids = $2::jsonb,
           queue_id = COALESCE(queue_id, $3),
           game_mode = COALESCE(game_mode, $4),
           game_duration_seconds = COALESCE(game_duration_seconds, $5),
           game_ended_at = COALESCE(game_ended_at, to_timestamp($6 / 1000.0))
       WHERE id = $1
       RETURNING id, user_id, match_id, champion_played, kills, deaths, assists, win, item_ids, queue_id, game_mode, game_duration_seconds, game_ended_at, processed_at`,
      [
        row.id,
        JSON.stringify(getParticipantItemIds(participant)),
        Number(match.info?.queueId) || null,
        match.info?.gameMode || null,
        Number(match.info?.gameDuration) || null,
        Number(match.info?.gameEndTimestamp || match.info?.gameStartTimestamp || Date.now()),
      ],
    );

    return result.rows[0] || row;
  } catch (error) {
    console.warn(`Unable to enrich recent match ${row.match_id}:`, error.message);
    return row;
  }
}

function sendSyncError(res, error) {
  if (error instanceof RiotApiError) {
    if (error.status === 429) {
      return res.status(429).json({ error: "Riot API rate limit reached" });
    }

    if (error.status === 401 || error.status === 403) {
      return res.status(502).json({ error: "Riot API key was rejected" });
    }

    if (error.status === 503) {
      return res.status(502).json({ error: error.message });
    }

    return res.status(502).json({ error: "Riot API request failed" });
  }

  console.error("Match sync error:", error);
  return res.status(500).json({ error: "Failed to sync matches" });
}

function getMatchSyncWindow(matchIds, checkpointGameId) {
  const nextCheckpointGameId = matchIds[0] || checkpointGameId || null;

  if (!checkpointGameId) {
    return {
      matchIdsToProcess: matchIds.slice(0, FIRST_SYNC_MATCH_COUNT),
      nextCheckpointGameId,
    };
  }

  const checkpointIndex = matchIds.indexOf(checkpointGameId);

  if (checkpointIndex === 0) {
    return {
      matchIdsToProcess: [],
      nextCheckpointGameId,
    };
  }

  if (checkpointIndex > 0) {
    return {
      matchIdsToProcess: matchIds.slice(0, checkpointIndex),
      nextCheckpointGameId,
    };
  }

  return {
    matchIdsToProcess: matchIds.slice(0, MAX_SYNC_LOOKBACK),
    nextCheckpointGameId,
  };
}

async function syncRecentMatches(user) {
  await ensureMatchSyncColumns(pool);
  await backfillRegionPointsFromStoredMatches(pool, user.id);

  const storedCheckpointGameId =
    user.checkpoint_game_id || (await getStoredCheckpointGameId(pool, user.id));
  const matchIds = await getRecentMatches(user.riot_puuid, MAX_SYNC_LOOKBACK, RIOT_KEY);
  const { matchIdsToProcess, nextCheckpointGameId } = getMatchSyncWindow(
    matchIds,
    storedCheckpointGameId,
  );

  const existingMatches = await pool.query(
    "SELECT match_id FROM match_checkpoints WHERE user_id = $1",
    [user.id],
  );
  const existingMatchIds = new Set(
    existingMatches.rows.map((row) => row.match_id),
  );

  const candidates = [];

  for (const matchId of [...matchIdsToProcess].reverse()) {
    if (existingMatchIds.has(matchId)) {
      continue;
    }

    const match = await getMatchDetails(matchId, RIOT_KEY);
    const participant = match.info?.participants?.find(
      (player) => player.puuid === user.riot_puuid,
    );

    if (!participant) {
      continue;
    }

    const info = match.info || {};
    const championProgress = getChampionProgressForMatch(participant);

    candidates.push({ matchId, participant, info, championProgress });
  }

  if (candidates.length === 0) {
    const checkpointUser =
      nextCheckpointGameId && nextCheckpointGameId !== user.checkpoint_game_id
        ? await updateCheckpointGame(pool, user.id, nextCheckpointGameId)
        : null;

    return {
      insertedMatches: [],
      rewardClaim: null,
      user: checkpointUser || user,
    };
  }

  const itemDictionary = await getDataDragonItemDictionary();
  const client = await pool.connect();
  const insertedMatches = [];
  const processedRewards = [];
  const shardTotals = {};
  let totalXp = 0;
  let totalCs = 0;
  let updatedUser = user;

  try {
    await client.query("BEGIN");

    for (const candidate of candidates) {
      const { matchId, participant, info, championProgress } = candidate;
      const existingCheckpoint = await client.query(
        `SELECT id
         FROM match_checkpoints
         WHERE user_id = $1
         AND match_id = $2
         LIMIT 1`,
        [user.id, matchId],
      );

      if (existingCheckpoint.rows[0]) {
        continue;
      }

      const result = await client.query(
        `INSERT INTO match_checkpoints
         (
           user_id,
           match_id,
           champion_played,
           champion_played_slug,
           kills,
           deaths,
           assists,
           win,
           item_ids,
           champion_kill_counts,
           queue_id,
           game_mode,
           game_duration_seconds,
           game_ended_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, $12, $13, to_timestamp($14 / 1000.0))
         RETURNING id, user_id, match_id, champion_played, champion_played_slug, kills, deaths, assists, win, item_ids, champion_kill_counts, queue_id, game_mode, game_duration_seconds, game_ended_at, processed_at`,
        [
          user.id,
          matchId,
          participant.championName || "Unknown",
          championProgress.playedChampionSlug || null,
          Number(participant.kills) || 0,
          Number(participant.deaths) || 0,
          Number(participant.assists) || 0,
          Boolean(participant.win),
          JSON.stringify(getParticipantItemIds(participant)),
          JSON.stringify({}),
          Number(info.queueId) || null,
          info.gameMode || null,
          Number(info.gameDuration) || null,
          Number(info.gameEndTimestamp || info.gameStartTimestamp || Date.now()),
        ],
      );

      if (!result.rows[0]) {
        continue;
      }

      const championProgression = await getChampionProgressionState(
        client,
        user.id,
        championProgress.playedChampionSlug,
      );
      const reward = calculateMatchReward(
        participant,
        itemDictionary,
        championProgression,
      );

      await recordChampionProgress(client, user.id, championProgress);
      insertedMatches.push(toMatchDto(result.rows[0]));
      processedRewards.push(reward);
      totalXp += reward.xpAwarded;
      totalCs += reward.csAwarded;
      mergeShardTotals(shardTotals, reward.shardTotals);
    }

    let rewardClaim = null;

    if (processedRewards.length > 0) {
      await incrementShardInventory(client, user.id, shardTotals);

      const progression = applyXpProgression(
        user.app_level,
        user.app_xp,
        totalXp,
      );
      const userResult = await client.query(
        `UPDATE users
         SET app_level = $2,
             app_xp = $3,
             cs_currency = cs_currency + $4,
             checkpoint_game_id = COALESCE($5, checkpoint_game_id),
             updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
          RETURNING id, summoner_name, tagline, summoner_level, app_level, app_xp, cs_currency, checkpoint_game_id, created_at, updated_at`,
        [
          user.id,
          progression.appLevel,
          progression.appXp,
          totalCs,
          nextCheckpointGameId,
        ],
      );

      updatedUser = userResult.rows[0];
      rewardClaim = buildRewardClaimPayload(processedRewards, progression);
    } else if (nextCheckpointGameId) {
      updatedUser =
        (await updateCheckpointGame(client, user.id, nextCheckpointGameId)) || user;
    }

    await trimStoredMatches(client, user.id);
    await client.query("COMMIT");

    return {
      insertedMatches,
      rewardClaim,
      user: updatedUser,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function handleSyncRequest(req, res) {
  const userId = parseUserId(req.params.userId);

  if (!userId) {
    return res.status(400).json({ error: "Valid user id is required" });
  }

  try {
    await ensureMatchSyncColumns(pool);
    const user = await getUserForSync(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const syncResult = await syncRecentMatches(user);

    return res.json({
      success: true,
      newMatchesAdded: syncResult.insertedMatches.length,
      matches: syncResult.insertedMatches,
      rewardClaim: syncResult.rewardClaim,
      user: toUserDto(syncResult.user),
    });
  } catch (error) {
    return sendSyncError(res, error);
  }
}

router.post("/sync/:userId", handleSyncRequest);

router.post("/force-sync/:userId", handleSyncRequest);

router.get("/:userId/recent", async (req, res) => {
  const userId = parseUserId(req.params.userId);

  if (!userId) {
    return res.status(400).json({ error: "Valid user id is required" });
  }

  try {
    await ensureMatchSyncColumns(pool);

    const user = await getUserForSync(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const result = await pool.query(
      `SELECT id, user_id, match_id, champion_played, kills, deaths, assists, win, item_ids, queue_id, game_mode, game_duration_seconds, game_ended_at, processed_at
       FROM match_checkpoints
       WHERE user_id = $1
       ORDER BY processed_at DESC
       LIMIT $2`,
      [userId, MAX_STORED_MATCHES],
    );

    const enrichedRows = [];

    for (const row of result.rows) {
      enrichedRows.push(await backfillRecentMatchMetadata(pool, user, row));
    }

    const [itemDictionary, dataDragonVersion] = await Promise.all([
      getDataDragonItemDictionary(),
      getDataDragonVersion(),
    ]);

    return res.json({
      matches: enrichedRows.map((row) =>
        toRecentGameDto(row, itemDictionary, dataDragonVersion),
      ),
    });
  } catch (error) {
    console.error("Recent matches error:", error);
    return res.status(500).json({ error: "Failed to load recent matches" });
  }
});

export default router;
