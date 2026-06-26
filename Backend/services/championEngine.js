// Owns champion roster metadata, starter unlocks, and match-driven unlock progress.
import {
  getDataDragonChampionDictionary,
  getTopChampionMasteriesAcrossPlatforms,
  RiotApiError,
} from "./riotAPI.js";

const FALLBACK_STARTER_CHAMPIONS = ["lux", "yasuo", "darius"];
const CHAMPION_UNLOCK_REQUIREMENT = 100;
const CHAMPION_MAX_LEVEL = 10;
const CHAMPION_LEVEL_COST_STEP = 100;
const STARTER_UNLOCK_SOURCES = ["starter_mastery", "starter_default"];
const UNLOCK_ALL_CHAMPIONS_FOR_TESTING =
  process.env.UNLOCK_ALL_CHAMPIONS_FOR_TESTING === "true";

const CHAMPION_NAME_OVERRIDES = {
  aurelion_sol: "Aurelion Sol",
  belveth: "Bel'Veth",
  camile: "Camille",
  chogath: "Cho'Gath",
  jarvan: "Jarvan IV",
  kaisa: "Kai'Sa",
  khazix: "Kha'Zix",
  kogmaw: "Kog'Maw",
  ksante: "K'Sante",
  leesin: "Lee Sin",
  masteryi: "Master Yi",
  mf: "Miss Fortune",
  mundo: "Dr. Mundo",
  nunu: "Nunu & Willump",
  reksai: "Rek'Sai",
  renataglasc: "Renata Glasc",
  "tahm kench": "Tahm Kench",
  tf: "Twisted Fate",
  velkoz: "Vel'Koz",
  xinzhao: "Xin Zhao",
};

const CHAMPION_SLUG_BY_DATADRAGON_ID = {
  AurelionSol: "aurelion_sol",
  Belveth: "belveth",
  Camille: "camile",
  Chogath: "chogath",
  DrMundo: "mundo",
  JarvanIV: "jarvan",
  Kaisa: "kaisa",
  Khazix: "khazix",
  KogMaw: "kogmaw",
  KSante: "ksante",
  LeeSin: "leesin",
  MasterYi: "masteryi",
  MissFortune: "mf",
  MonkeyKing: "wukong",
  Nunu: "nunu",
  RekSai: "reksai",
  Renata: "renataglasc",
  TahmKench: "tahm kench",
  TwistedFate: "tf",
  Velkoz: "velkoz",
  XinZhao: "xinzhao",
};

const CHAMPION_ROLE_OVERRIDES = {
  aatrox: "Bruiser",
  darius: "Bruiser",
  lux: "Mage",
  yasuo: "Skirmisher",
};

const CHAMPION_REGION_OVERRIDES = {
  aatrox: "Shurima",
  ahri: "Ionia",
  akali: "Ionia",
  akshan: "Shurima",
  alistar: "Runeterra",
  ambessa: "Noxus",
  amumu: "Shurima",
  anivia: "Freljord",
  annie: "Noxus",
  aphelios: "Targon",
  ashe: "Freljord",
  aurelion_sol: "Targon",
  aurora: "Freljord",
  azir: "Shurima",
  bard: "Runeterra",
  belveth: "The Void",
  blitzcrank: "Zaun",
  brand: "Freljord",
  braum: "Freljord",
  briar: "Noxus",
  caitlyn: "Piltover",
  camile: "Piltover",
  cassiopeia: "Noxus",
  chogath: "The Void",
  corki: "Bandle City",
  darius: "Noxus",
  diana: "Targon",
  draven: "Noxus",
  ekko: "Zaun",
  elise: "Shadow Isles",
  evelynn: "Runeterra",
  ezreal: "Piltover",
  fiddlesticks: "Runeterra",
  fiora: "Demacia",
  fizz: "Bilgewater",
  galio: "Demacia",
  gangplank: "Bilgewater",
  garen: "Demacia",
  gnar: "Freljord",
  gragas: "Freljord",
  graves: "Bilgewater",
  gwen: "Shadow Isles",
  hecarim: "Shadow Isles",
  heimerdinger: "Piltover",
  hwei: "Ionia",
  illaoi: "Bilgewater",
  irelia: "Ionia",
  ivern: "Ionia",
  janna: "Zaun",
  jarvan: "Demacia",
  jax: "Icathia",
  jayce: "Piltover",
  jhin: "Ionia",
  jinx: "Zaun",
  kaisa: "The Void",
  kalista: "Shadow Isles",
  karma: "Ionia",
  karthus: "Shadow Isles",
  kassadin: "The Void",
  katarina: "Noxus",
  kayle: "Demacia",
  kayn: "Ionia",
  kennen: "Ionia",
  khazix: "The Void",
  kindred: "Runeterra",
  kled: "Noxus",
  kogmaw: "The Void",
  ksante: "Shurima",
  leblanc: "Noxus",
  leesin: "Ionia",
  leona: "Targon",
  lillia: "Ionia",
  lissandra: "Freljord",
  locke: "Unknown",
  lucian: "Demacia",
  lulu: "Bandle City",
  lux: "Demacia",
  malphite: "Ixtal",
  malzahar: "The Void",
  maokai: "Shadow Isles",
  masteryi: "Ionia",
  mel: "Noxus",
  mf: "Bilgewater",
  milio: "Ixtal",
  mordekaiser: "Noxus",
  morgana: "Demacia",
  mundo: "Zaun",
  naafiri: "Shurima",
  nami: "Runeterra",
  nasus: "Shurima",
  nautilus: "Bilgewater",
  neeko: "Ixtal",
  nidalee: "Ixtal",
  nilah: "Bilgewater",
  nocturne: "Runeterra",
  nunu: "Freljord",
  olaf: "Freljord",
  orianna: "Piltover",
  ornn: "Freljord",
  pantheon: "Targon",
  poppy: "Demacia",
  pyke: "Bilgewater",
  qiyana: "Ixtal",
  quinn: "Demacia",
  rakan: "Ionia",
  rammus: "Shurima",
  reksai: "The Void",
  rell: "Noxus",
  renataglasc: "Zaun",
  renekton: "Shurima",
  rengar: "Ixtal",
  riven: "Noxus",
  rumble: "Bandle City",
  ryze: "Runeterra",
  samira: "Noxus",
  sejuani: "Freljord",
  senna: "Runeterra",
  seraphine: "Piltover",
  sett: "Ionia",
  shaco: "Runeterra",
  shen: "Ionia",
  shyvana: "Demacia",
  singed: "Zaun",
  sion: "Noxus",
  sivir: "Shurima",
  skarner: "Ixtal",
  smolder: "Runeterra",
  sona: "Demacia",
  soraka: "Targon",
  swain: "Noxus",
  sylas: "Demacia",
  syndra: "Ionia",
  "tahm kench": "Bilgewater",
  taliyah: "Shurima",
  talon: "Noxus",
  taric: "Targon",
  teemo: "Bandle City",
  tf: "Bilgewater",
  thresh: "Shadow Isles",
  tristana: "Bandle City",
  trundle: "Freljord",
  tryndamere: "Freljord",
  twitch: "Zaun",
  udyr: "Freljord",
  urgot: "Zaun",
  varus: "Ionia",
  vayne: "Demacia",
  veigar: "Bandle City",
  velkoz: "The Void",
  vex: "Shadow Isles",
  vi: "Piltover",
  viego: "Shadow Isles",
  viktor: "Zaun",
  vladimir: "Noxus",
  volibear: "Freljord",
  warwick: "Zaun",
  wukong: "Ionia",
  xayah: "Ionia",
  xerath: "Shurima",
  xinzhao: "Demacia",
  yasuo: "Ionia",
  yone: "Ionia",
  yorick: "Shadow Isles",
  yunara: "Ionia",
  yuumi: "Bandle City",
  zaahen: "Unknown",
  zac: "Zaun",
  zed: "Ionia",
  zeri: "Zaun",
  ziggs: "Zaun",
  zilean: "Icathia",
  zoe: "Targon",
  zyra: "Ixtal",
};

const REGION_DISPLAY_ORDER = [
  "Bandle City",
  "Bilgewater",
  "Demacia",
  "Freljord",
  "Icathia",
  "Ionia",
  "Ixtal",
  "Noxus",
  "Piltover",
  "Runeterra",
  "Shadow Isles",
  "Shurima",
  "Targon",
  "The Void",
  "Zaun",
  "Unknown",
];

export const CHAMPION_SPRITE_FILES = [
  "aatrox",
  "ahri",
  "akali",
  "akshan",
  "alistar",
  "ambessa",
  "amumu",
  "anivia",
  "annie",
  "aphelios",
  "ashe",
  "aurelion_sol",
  "aurora",
  "azir",
  "bard",
  "belveth",
  "blitzcrank",
  "brand",
  "braum",
  "briar",
  "caitlyn",
  "camile",
  "cassiopeia",
  "chogath",
  "corki",
  "darius",
  "diana",
  "draven",
  "ekko",
  "elise",
  "evelynn",
  "ezreal",
  "fiddlesticks",
  "fiora",
  "fizz",
  "galio",
  "gangplank",
  "garen",
  "gnar",
  "gragas",
  "graves",
  "gwen",
  "hecarim",
  "heimerdinger",
  "hwei",
  "illaoi",
  "irelia",
  "ivern",
  "janna",
  "jarvan",
  "jax",
  "jayce",
  "jhin",
  "jinx",
  "kaisa",
  "kalista",
  "karma",
  "karthus",
  "kassadin",
  "katarina",
  "kayle",
  "kayn",
  "kennen",
  "khazix",
  "kindred",
  "kled",
  "kogmaw",
  "ksante",
  "leblanc",
  "leesin",
  "leona",
  "lillia",
  "lissandra",
  "locke",
  "lucian",
  "lulu",
  "lux",
  "malphite",
  "malzahar",
  "maokai",
  "masteryi",
  "mel",
  "mf",
  "milio",
  "mordekaiser",
  "morgana",
  "mundo",
  "naafiri",
  "nami",
  "nasus",
  "nautilus",
  "neeko",
  "nidalee",
  "nilah",
  "nocturne",
  "nunu",
  "olaf",
  "orianna",
  "ornn",
  "pantheon",
  "poppy",
  "pyke",
  "qiyana",
  "quinn",
  "rakan",
  "rammus",
  "reksai",
  "rell",
  "renataglasc",
  "renekton",
  "rengar",
  "riven",
  "rumble",
  "ryze",
  "samira",
  "sejuani",
  "senna",
  "seraphine",
  "sett",
  "shaco",
  "shen",
  "shyvana",
  "singed",
  "sion",
  "sivir",
  "skarner",
  "smolder",
  "sona",
  "soraka",
  "swain",
  "sylas",
  "syndra",
  "tahm kench",
  "taliyah",
  "talon",
  "taric",
  "teemo",
  "tf",
  "thresh",
  "tristana",
  "trundle",
  "tryndamere",
  "twitch",
  "udyr",
  "urgot",
  "varus",
  "vayne",
  "veigar",
  "velkoz",
  "vex",
  "vi",
  "viego",
  "viktor",
  "vladimir",
  "volibear",
  "warwick",
  "wukong",
  "xayah",
  "xerath",
  "xinzhao",
  "yasuo",
  "yone",
  "yorick",
  "yunara",
  "yuumi",
  "zaahen",
  "zac",
  "zed",
  "zeri",
  "ziggs",
  "zilean",
  "zoe",
  "zyra",
];

const CHAMPION_SLUG_SET = new Set(CHAMPION_SPRITE_FILES);

function normalizeChampionIdentity(value) {
  return String(value || "")
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9_ ]/g, "")
    .toLowerCase()
    .replace(/[_ ]+/g, "")
    .trim();
}

const CHAMPION_SLUG_BY_NORMALIZED_NAME = new Map(
  CHAMPION_SPRITE_FILES.flatMap((slug) => [
    [normalizeChampionIdentity(slug), slug],
    [normalizeChampionIdentity(getChampionDisplayName(slug)), slug],
  ]),
);

export function toChampionSlugFromRiotName(value) {
  const directMappedSlug = CHAMPION_SLUG_BY_DATADRAGON_ID[String(value || "")];

  if (directMappedSlug) {
    return directMappedSlug;
  }

  return CHAMPION_SLUG_BY_NORMALIZED_NAME.get(normalizeChampionIdentity(value)) || "";
}

function isStarterUnlockSource(unlockSource) {
  return (
    STARTER_UNLOCK_SOURCES.includes(unlockSource) ||
    unlockSource === "testing_unlock_all"
  );
}

function getChampionNextLevelCost(level) {
  return Math.max(1, level) * CHAMPION_LEVEL_COST_STEP;
}

function getChampionLevelState(totalProgress, isUnlocked, unlockSource) {
  if (!isUnlocked) {
    const required = CHAMPION_UNLOCK_REQUIREMENT;

    return {
      level: 0,
      maxLevel: CHAMPION_MAX_LEVEL,
      shardBonusPercent: 0,
      dropMultiplier: 1,
      nextLevel: 1,
      levelProgress: Math.min(totalProgress, required),
      levelRequired: required,
      remaining: Math.max(0, required - totalProgress),
      percent: Math.min(100, Math.round((totalProgress / required) * 100)),
    };
  }

  let level = 1;
  let progressPool = isStarterUnlockSource(unlockSource)
    ? totalProgress
    : Math.max(0, totalProgress - CHAMPION_UNLOCK_REQUIREMENT);

  while (
    level < CHAMPION_MAX_LEVEL &&
    progressPool >= getChampionNextLevelCost(level)
  ) {
    progressPool -= getChampionNextLevelCost(level);
    level += 1;
  }

  const levelRequired =
    level >= CHAMPION_MAX_LEVEL ? 0 : getChampionNextLevelCost(level);
  const shardBonusPercent = level * 10;

  return {
    level,
    maxLevel: CHAMPION_MAX_LEVEL,
    shardBonusPercent,
    dropMultiplier: 1 + shardBonusPercent / 100,
    nextLevel: level >= CHAMPION_MAX_LEVEL ? null : level + 1,
    levelProgress: level >= CHAMPION_MAX_LEVEL ? 0 : progressPool,
    levelRequired,
    remaining:
      level >= CHAMPION_MAX_LEVEL ? 0 : Math.max(0, levelRequired - progressPool),
    percent:
      level >= CHAMPION_MAX_LEVEL
        ? 100
        : Math.min(100, Math.round((progressPool / levelRequired) * 100)),
  };
}

function getChampionDisplayName(fileName) {
  if (CHAMPION_NAME_OVERRIDES[fileName]) {
    return CHAMPION_NAME_OVERRIDES[fileName];
  }

  return fileName
    .replace(/_/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function toChampionSlug(champion) {
  if (!champion) {
    return "";
  }

  const mappedSlug = CHAMPION_SLUG_BY_DATADRAGON_ID[champion.dataDragonId];

  if (mappedSlug) {
    return mappedSlug;
  }

  return String(champion.dataDragonId || champion.name || "")
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9_ ]/g, "")
    .toLowerCase()
    .trim();
}

function toRegionKey(regionName) {
  return String(regionName || "Unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function getChampionRegion(championSlug) {
  const normalizedChampionSlug = toChampionSlugFromRiotName(championSlug);
  return CHAMPION_REGION_OVERRIDES[normalizedChampionSlug] || "Unknown";
}

function formatChampionRole(slug, championProfile) {
  if (CHAMPION_ROLE_OVERRIDES[slug]) {
    return CHAMPION_ROLE_OVERRIDES[slug];
  }

  const firstTag = championProfile?.tags?.[0] || "";
  const roleLabels = {
    Assassin: "Assassin",
    Fighter: "Bruiser",
    Mage: "Mage",
    Marksman: "Marksman",
    Support: "Support",
    Tank: "Tank",
  };

  return roleLabels[firstTag] || "Adventurer";
}

function getChampionDescription(slug, championProfile) {
  if (championProfile?.blurb) {
    return championProfile.blurb;
  }

  return `${getChampionDisplayName(slug)} champion details are coming soon.`;
}

async function getDataDragonProfilesBySlug() {
  const championDictionary = await getDataDragonChampionDictionary();
  const profilesBySlug = new Map();

  for (const champion of championDictionary.values()) {
    const slug = toChampionSlug(champion);

    if (CHAMPION_SLUG_SET.has(slug)) {
      profilesBySlug.set(slug, champion);
    }
  }

  return profilesBySlug;
}

function toChampionDto(slug, unlockedBySlug, profilesBySlug) {
  const unlockState = unlockedBySlug.get(slug);
  const championProfile = profilesBySlug.get(slug);
  const playedCount = Number(unlockState?.gamesPlayedCount) || 0;
  const killsOnChampionCount = Number(unlockState?.killsOnChampionCount) || 0;
  const totalProgress = playedCount + killsOnChampionCount;
  const isUnlocked = Boolean(unlockState?.isUnlocked);
  const levelState = getChampionLevelState(
    totalProgress,
    isUnlocked,
    unlockState?.unlockSource || null,
  );

  return {
    slug,
    name: championProfile?.name || getChampionDisplayName(slug),
    title: championProfile?.title || "",
    role: formatChampionRole(slug, championProfile),
    region: CHAMPION_REGION_OVERRIDES[slug] || "Unknown",
    description: getChampionDescription(slug, championProfile),
    assetPath: `/assets/champs/${slug}.png`,
    isUnlocked,
    unlockSource: unlockState?.unlockSource || null,
    unlockedAt: unlockState?.unlockedAt || null,
    level: levelState.level,
    maxLevel: levelState.maxLevel,
    shardBonusPercent: levelState.shardBonusPercent,
    dropMultiplier: levelState.dropMultiplier,
    progress: {
      played: playedCount,
      killed: killsOnChampionCount,
      kills: killsOnChampionCount,
      total: totalProgress,
      required: levelState.levelRequired || CHAMPION_UNLOCK_REQUIREMENT,
      remaining: levelState.remaining,
      percent: levelState.percent,
      nextLevel: levelState.nextLevel,
      levelProgress: levelState.levelProgress,
      levelRequired: levelState.levelRequired,
    },
  };
}

export async function ensurePlayerChampionTable(db) {
  await db.query(
    `CREATE TABLE IF NOT EXISTS player_champions (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      champion_slug VARCHAR(80) NOT NULL,
      is_unlocked BOOLEAN NOT NULL DEFAULT false,
      unlock_source VARCHAR(40),
      unlocked_at TIMESTAMP WITH TIME ZONE,
      games_played_count INT NOT NULL DEFAULT 0 CHECK (games_played_count >= 0),
      kills_against_count INT NOT NULL DEFAULT 0 CHECK (kills_against_count >= 0),
      kills_on_champion_count INT NOT NULL DEFAULT 0 CHECK (kills_on_champion_count >= 0),
      progress_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id, champion_slug)
    )`,
  );

  await db.query(`
    ALTER TABLE player_champions
      ALTER COLUMN unlocked_at DROP DEFAULT,
      ADD COLUMN IF NOT EXISTS games_played_count INT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS kills_against_count INT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS kills_on_champion_count INT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS progress_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  `);

  await db.query(
    `UPDATE player_champions
     SET unlocked_at = NULL
     WHERE is_unlocked = false
     AND unlocked_at IS NOT NULL`,
  );

  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_player_champions_user_id
     ON player_champions(user_id)`,
  );
}

export async function ensurePlayerRegionPointsTable(db) {
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

async function setChampionUnlocked(db, userId, championSlug, unlockSource) {
  const existingChampion = await db.query(
    `SELECT id
     FROM player_champions
     WHERE user_id = $1
     AND champion_slug = $2
     ORDER BY id
     LIMIT 1`,
    [userId, championSlug],
  );

  if (existingChampion.rows[0]) {
    await db.query(
      `UPDATE player_champions
       SET is_unlocked = true,
           unlock_source = CASE
             WHEN unlock_source IS NULL
               OR unlock_source IN ('starter_mastery', 'starter_default')
               OR unlock_source = 'testing_unlock_all'
               OR is_unlocked = false
             THEN $2
             ELSE unlock_source
           END,
           unlocked_at = CASE
              WHEN is_unlocked = false THEN CURRENT_TIMESTAMP
              ELSE COALESCE(unlocked_at, CURRENT_TIMESTAMP)
           END,
           progress_updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [existingChampion.rows[0].id, unlockSource],
    );
    return;
  }

  await db.query(
    `INSERT INTO player_champions
     (user_id, champion_slug, is_unlocked, unlock_source, unlocked_at)
     VALUES ($1, $2, true, $3, CURRENT_TIMESTAMP)`,
    [userId, championSlug, unlockSource],
  );
}

export async function recordChampionProgress(
  db,
  userId,
  { playedChampionSlug, killsOnChampion = 0 },
) {
  await ensurePlayerChampionTable(db);

  const normalizedPlayedSlug = toChampionSlugFromRiotName(playedChampionSlug);

  if (!CHAMPION_SLUG_SET.has(normalizedPlayedSlug)) {
    return;
  }

  const killsOnPlayedChampion = Math.max(0, Math.floor(Number(killsOnChampion) || 0));

  await db.query(
    `INSERT INTO player_champions
       (
         user_id,
         champion_slug,
         games_played_count,
         kills_on_champion_count,
         is_unlocked,
         unlock_source,
         unlocked_at,
         progress_updated_at
       )
       VALUES (
         $1::int,
         $2::varchar,
         $3::int,
         $4::int,
         ($3::int + $4::int) >= $5::int,
         CASE WHEN ($3::int + $4::int) >= $5::int THEN 'progression' ELSE NULL END,
         CASE WHEN ($3::int + $4::int) >= $5::int THEN CURRENT_TIMESTAMP ELSE NULL END,
         CURRENT_TIMESTAMP
       )
       ON CONFLICT (user_id, champion_slug)
       DO UPDATE SET
         games_played_count = player_champions.games_played_count + EXCLUDED.games_played_count,
         kills_on_champion_count = player_champions.kills_on_champion_count + EXCLUDED.kills_on_champion_count,
         is_unlocked = CASE
           WHEN player_champions.is_unlocked THEN true
           WHEN (
             player_champions.games_played_count +
             player_champions.kills_on_champion_count +
             EXCLUDED.games_played_count +
             EXCLUDED.kills_on_champion_count
           ) >= $5::int THEN true
           ELSE false
         END,
         unlock_source = CASE
           WHEN player_champions.is_unlocked THEN player_champions.unlock_source
           WHEN (
             player_champions.games_played_count +
             player_champions.kills_on_champion_count +
             EXCLUDED.games_played_count +
             EXCLUDED.kills_on_champion_count
           ) >= $5::int THEN 'progression'
           ELSE player_champions.unlock_source
         END,
         unlocked_at = CASE
           WHEN player_champions.is_unlocked THEN COALESCE(player_champions.unlocked_at, CURRENT_TIMESTAMP)
           WHEN (
             player_champions.games_played_count +
             player_champions.kills_on_champion_count +
             EXCLUDED.games_played_count +
             EXCLUDED.kills_on_champion_count
           ) >= $5::int THEN CURRENT_TIMESTAMP
           ELSE player_champions.unlocked_at
         END,
         progress_updated_at = CURRENT_TIMESTAMP`,
    [
      userId,
      normalizedPlayedSlug,
      1,
      killsOnPlayedChampion,
      CHAMPION_UNLOCK_REQUIREMENT,
    ],
  );

  await recordRegionPointForChampion(db, userId, normalizedPlayedSlug);
}

export async function recordRegionPointForChampion(db, userId, championSlug) {
  await ensurePlayerRegionPointsTable(db);

  const regionName = getChampionRegion(championSlug);
  const regionKey = toRegionKey(regionName);

  await db.query(
    `INSERT INTO player_region_points
       (user_id, region_key, region_name, points, updated_at)
     VALUES ($1, $2, $3, 1, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id, region_key)
     DO UPDATE SET
       region_name = EXCLUDED.region_name,
       points = player_region_points.points + 1,
       updated_at = CURRENT_TIMESTAMP`,
    [userId, regionKey, regionName],
  );
}

export async function backfillRegionPointsFromStoredMatches(db, userId) {
  await ensurePlayerRegionPointsTable(db);

  const existingRegionRows = await db.query(
    `SELECT id
     FROM player_region_points
     WHERE user_id = $1
     LIMIT 1`,
    [userId],
  );

  if (existingRegionRows.rows[0]) {
    return;
  }

  const matchResult = await db.query(
    `SELECT champion_played_slug, champion_played
     FROM match_checkpoints
     WHERE user_id = $1`,
    [userId],
  );
  const regionCounts = new Map();

  for (const row of matchResult.rows) {
    const championSlug = row.champion_played_slug || row.champion_played;
    const regionName = getChampionRegion(championSlug);
    const regionKey = toRegionKey(regionName);

    regionCounts.set(regionKey, {
      name: regionName,
      points: (regionCounts.get(regionKey)?.points || 0) + 1,
    });
  }

  for (const [regionKey, region] of regionCounts) {
    await db.query(
      `INSERT INTO player_region_points
         (user_id, region_key, region_name, points, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, region_key)
       DO NOTHING`,
      [userId, regionKey, region.name, region.points],
    );
  }
}

export async function getRegionProgress(db, userId) {
  await ensurePlayerRegionPointsTable(db);

  const userResult = await db.query("SELECT id FROM users WHERE id = $1", [userId]);

  if (!userResult.rows[0]) {
    const error = new Error("User not found");
    error.status = 404;
    throw error;
  }

  await backfillRegionPointsFromStoredMatches(db, userId);

  const result = await db.query(
    `SELECT region_key, region_name, points, updated_at
     FROM player_region_points
     WHERE user_id = $1`,
    [userId],
  );
  const pointsByRegionKey = new Map(
    result.rows.map((row) => [
      row.region_key,
      {
        points: Number(row.points) || 0,
        updatedAt: row.updated_at,
      },
    ]),
  );
  const regions = REGION_DISPLAY_ORDER.map((regionName) => {
    const regionKey = toRegionKey(regionName);
    const regionProgress = pointsByRegionKey.get(regionKey);

    return {
      key: regionKey,
      name: regionName,
      points: regionProgress?.points || 0,
      updatedAt: regionProgress?.updatedAt || null,
    };
  });

  return {
    regions,
    totalPoints: regions.reduce((total, region) => total + region.points, 0),
  };
}

export async function getChampionProgressionState(db, userId, championSlug) {
  await ensurePlayerChampionTable(db);

  const normalizedChampionSlug = toChampionSlugFromRiotName(championSlug);

  if (!CHAMPION_SLUG_SET.has(normalizedChampionSlug)) {
    return getChampionLevelState(0, false, null);
  }

  const result = await db.query(
    `SELECT
       is_unlocked,
       unlock_source,
       games_played_count,
       kills_on_champion_count
     FROM player_champions
     WHERE user_id = $1
     AND champion_slug = $2
     LIMIT 1`,
    [userId, normalizedChampionSlug],
  );
  const row = result.rows[0];
  const gamesPlayedCount = Number(row?.games_played_count) || 0;
  const killsOnChampionCount = Number(row?.kills_on_champion_count) || 0;
  const totalProgress = gamesPlayedCount + killsOnChampionCount;

  return {
    ...getChampionLevelState(
      totalProgress,
      Boolean(row?.is_unlocked),
      row?.unlock_source || null,
    ),
    championSlug: normalizedChampionSlug,
    gamesPlayedCount,
    killsOnChampionCount,
    totalProgress,
  };
}

async function getMasteryStarterChampions(user, apiKey) {
  const starterSlugs = [];

  if (!user.riot_puuid) {
    return null;
  }

  try {
    const [topMasteries, championDictionary] = await Promise.all([
      getTopChampionMasteriesAcrossPlatforms(user.riot_puuid, 10, apiKey),
      getDataDragonChampionDictionary(),
    ]);

    for (const mastery of topMasteries || []) {
      const champion = championDictionary.get(Number(mastery.championId));
      const slug = toChampionSlug(champion);

      if (CHAMPION_SLUG_SET.has(slug) && !starterSlugs.includes(slug)) {
        starterSlugs.push(slug);
      }

      if (starterSlugs.length >= 3) {
        break;
      }
    }

    return starterSlugs.map((slug) => ({
      slug,
      unlockSource: "starter_mastery",
    }));
  } catch (error) {
    const status = error instanceof RiotApiError ? ` (${error.status})` : "";
    console.warn(`[champions] Starter mastery lookup failed${status}:`, error.message);
    return null;
  }
}

function fillFallbackStarterChampions(starterChampions) {
  const nextStarterChampions = [...starterChampions];

  for (const fallbackSlug of FALLBACK_STARTER_CHAMPIONS) {
    if (nextStarterChampions.length >= 3) {
      break;
    }

    if (!nextStarterChampions.some((starter) => starter.slug === fallbackSlug)) {
      nextStarterChampions.push({
        slug: fallbackSlug,
        unlockSource: "starter_default",
      });
    }
  }

  return nextStarterChampions.slice(0, 3);
}

async function getExistingStarterChampionRows(db, userId) {
  const result = await db.query(
    `SELECT champion_slug, unlock_source, is_unlocked
     FROM player_champions
     WHERE user_id = $1
     AND unlock_source = ANY($2::varchar[])
     ORDER BY unlocked_at ASC NULLS LAST, champion_slug ASC`,
    [userId, STARTER_UNLOCK_SOURCES],
  );

  return result.rows;
}

async function applyStarterChampions(db, userId, starterChampions) {
  const starterSlugs = starterChampions.map((starterChampion) => starterChampion.slug);

  await db.query(
    `UPDATE player_champions
     SET is_unlocked = (games_played_count + kills_on_champion_count) >= $3::int,
         unlock_source = CASE
           WHEN (games_played_count + kills_on_champion_count) >= $3::int THEN 'progression'
           ELSE NULL
         END,
         unlocked_at = CASE
           WHEN (games_played_count + kills_on_champion_count) >= $3::int THEN COALESCE(unlocked_at, CURRENT_TIMESTAMP)
           ELSE NULL
         END,
         progress_updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $1
     AND unlock_source IN ('starter_mastery', 'starter_default', 'testing_unlock_all')
     AND NOT (champion_slug = ANY($2::varchar[]))`,
    [userId, starterSlugs, CHAMPION_UNLOCK_REQUIREMENT],
  );

  for (const starterChampion of starterChampions) {
    await setChampionUnlocked(
      db,
      userId,
      starterChampion.slug,
      starterChampion.unlockSource,
    );
  }
}

export async function ensureStarterChampions(
  db,
  user,
  apiKey,
  { forceRefresh = false } = {},
) {
  const existingStarterRows = await getExistingStarterChampionRows(db, user.id);
  const existingMasteryStarters = existingStarterRows.filter(
    (row) => row.is_unlocked && row.unlock_source === "starter_mastery",
  );

  if (!forceRefresh && existingMasteryStarters.length >= 3) {
    return existingMasteryStarters.slice(0, 3).map((row) => ({
      slug: row.champion_slug,
      unlockSource: row.unlock_source,
    }));
  }

  const masteryStarterChampions = await getMasteryStarterChampions(user, apiKey);
  let starterChampions = [];

  if (masteryStarterChampions && masteryStarterChampions.length > 0) {
    starterChampions = fillFallbackStarterChampions(masteryStarterChampions);
  } else if (existingStarterRows.length > 0 && !forceRefresh) {
    starterChampions = existingStarterRows.slice(0, 3).map((row) => ({
      slug: row.champion_slug,
      unlockSource: row.unlock_source,
    }));
  } else {
    starterChampions = fillFallbackStarterChampions([]);
  }

  await applyStarterChampions(db, user.id, starterChampions);
  return starterChampions;
}

async function ensureAllChampionsUnlockedForTesting(db, userId) {
  for (const championSlug of CHAMPION_SPRITE_FILES) {
    await setChampionUnlocked(db, userId, championSlug, "testing_unlock_all");
  }
}

export async function getChampionRoster(db, userId, apiKey) {
  await ensurePlayerChampionTable(db);

  const userResult = await db.query(
    `SELECT id, summoner_name, tagline, riot_puuid
     FROM users
     WHERE id = $1`,
    [userId],
  );
  const user = userResult.rows[0];

  if (!user) {
    const error = new Error("User not found");
    error.status = 404;
    throw error;
  }

  if (UNLOCK_ALL_CHAMPIONS_FOR_TESTING) {
    await ensureAllChampionsUnlockedForTesting(db, user.id);
  } else {
    await ensureStarterChampions(db, user, apiKey);
  }

  const unlockedResult = await db.query(
    `SELECT
       champion_slug,
       is_unlocked,
       unlock_source,
       unlocked_at,
       games_played_count,
       kills_on_champion_count
     FROM player_champions
     WHERE user_id = $1`,
    [userId],
  );
  const unlockedBySlug = new Map(
    unlockedResult.rows.map((row) => [
      row.champion_slug,
      {
        isUnlocked: row.is_unlocked,
        unlockSource: row.unlock_source,
        unlockedAt: row.unlocked_at,
        gamesPlayedCount: row.games_played_count,
        killsOnChampionCount: row.kills_on_champion_count,
      },
    ]),
  );
  let profilesBySlug = new Map();

  try {
    profilesBySlug = await getDataDragonProfilesBySlug();
  } catch (error) {
    const status = error instanceof RiotApiError ? ` (${error.status})` : "";
    console.warn(`[champions] Data Dragon profile lookup failed${status}:`, error.message);
  }

  const champions = CHAMPION_SPRITE_FILES.map((slug) =>
    toChampionDto(slug, unlockedBySlug, profilesBySlug),
  );

  return {
    champions,
    unlockedCount: champions.filter((champion) => champion.isUnlocked).length,
    starterUnlockCount: 3,
    isUnlockAllTesting: UNLOCK_ALL_CHAMPIONS_FOR_TESTING,
  };
}
