// Centralizes Riot API and Data Dragon HTTP access so secrets never leave the backend.
const RIOT_AMERICAS_BASE_URL = "https://americas.api.riotgames.com";
const DDRAGON_BASE_URL = "https://ddragon.leagueoflegends.com";
const AMERICAS_PLATFORM_ROUTES = ["na1", "br1", "la1", "la2", "oc1"];

let cachedItemDictionary = null;
let cachedChampionDictionary = null;
let cachedDataDragonVersion = null;

export class RiotApiError extends Error {
  constructor(message, status, details, context = {}) {
    super(message);
    this.name = "RiotApiError";
    this.status = status;
    this.details = details;
    this.context = context;
  }
}

function normalizeRiotApiKey(apiKey) {
  const trimmedKey = String(apiKey || "").trim();

  if (
    (trimmedKey.startsWith('"') && trimmedKey.endsWith('"')) ||
    (trimmedKey.startsWith("'") && trimmedKey.endsWith("'"))
  ) {
    return trimmedKey.slice(1, -1).trim();
  }

  return trimmedKey;
}

async function requestRiotJson(path, apiKey) {
  const riotApiKey = normalizeRiotApiKey(apiKey);

  if (!riotApiKey) {
    throw new RiotApiError("Missing RIOT_API_KEY in Backend/.env", 500);
  }

  let response;
  const url = `${RIOT_AMERICAS_BASE_URL}${path}`;

  try {
    response = await fetch(url, {
      headers: {
        "X-Riot-Token": riotApiKey,
      },
    });
  } catch (error) {
    throw new RiotApiError("Backend could not reach the Riot API", 503, {
      cause: error.message,
    });
  }

  if (!response.ok) {
    let details = null;

    try {
      details = await response.json();
    } catch {
      details = await response.text();
    }

    const riotMessage =
      details?.status?.message || details?.message || response.statusText;

    throw new RiotApiError(riotMessage, response.status, details, {
      path,
      region: "americas",
      statusText: response.statusText,
    });
  }

  return response.json();
}

async function requestPlatformRiotJson(platform, path, apiKey) {
  const riotApiKey = normalizeRiotApiKey(apiKey);

  if (!riotApiKey) {
    throw new RiotApiError("Missing RIOT_API_KEY in Backend/.env", 500);
  }

  const platformRoute = String(platform || "na1").toLowerCase();
  let response;
  const url = `https://${platformRoute}.api.riotgames.com${path}`;

  try {
    response = await fetch(url, {
      headers: {
        "X-Riot-Token": riotApiKey,
      },
    });
  } catch (error) {
    throw new RiotApiError("Backend could not reach the Riot API", 503, {
      cause: error.message,
    });
  }

  if (!response.ok) {
    let details = null;

    try {
      details = await response.json();
    } catch {
      details = await response.text();
    }

    const riotMessage =
      details?.status?.message || details?.message || response.statusText;

    throw new RiotApiError(riotMessage, response.status, details, {
      path,
      region: platformRoute,
      statusText: response.statusText,
    });
  }

  return response.json();
}

async function requestExternalJson(url) {
  let response;

  try {
    response = await fetch(url);
  } catch (error) {
    throw new RiotApiError("Backend could not reach Data Dragon item data", 503, {
      cause: error.message,
    });
  }

  if (!response.ok) {
    let details = null;

    try {
      details = await response.json();
    } catch {
      details = await response.text();
    }

    const message = details?.status?.message || details?.message || response.statusText;
    throw new RiotApiError(message, response.status, details);
  }

  return response.json();
}

export async function getRiotAccountById(gameName, tagLine, apiKey) {
  const encodedGameName = encodeURIComponent(gameName);
  const encodedTagLine = encodeURIComponent(tagLine);

  return requestRiotJson(
    `/riot/account/v1/accounts/by-riot-id/${encodedGameName}/${encodedTagLine}`,
    apiKey,
  );
}

export async function getSummonerDataByName(summonerName, apiKey, tagLine) {
  return getRiotAccountById(summonerName, tagLine, apiKey);
}

export async function getRecentMatches(puuid, count = 5, apiKey) {
  const matchCount = Math.min(Math.max(Number(count) || 5, 1), 20);
  const encodedPuuid = encodeURIComponent(puuid);

  return requestRiotJson(
    `/lol/match/v5/matches/by-puuid/${encodedPuuid}/ids?start=0&count=${matchCount}`,
    apiKey,
  );
}

export async function getMatchDetails(matchId, apiKey) {
  const encodedMatchId = encodeURIComponent(matchId);

  return requestRiotJson(`/lol/match/v5/matches/${encodedMatchId}`, apiKey);
}

export async function getMatchTimeline(matchId, apiKey) {
  const encodedMatchId = encodeURIComponent(matchId);

  return requestRiotJson(`/lol/match/v5/matches/${encodedMatchId}/timeline`, apiKey);
}

export async function getTopChampionMasteries(
  puuid,
  count = 3,
  apiKey,
  platform = process.env.RIOT_PLATFORM || "na1",
) {
  const masteryCount = Math.min(Math.max(Number(count) || 3, 1), 10);
  const encodedPuuid = encodeURIComponent(puuid);

  return requestPlatformRiotJson(
    platform,
    `/lol/champion-mastery/v4/champion-masteries/by-puuid/${encodedPuuid}/top?count=${masteryCount}`,
    apiKey,
  );
}

export async function getTopChampionMasteriesAcrossPlatforms(
  puuid,
  count = 3,
  apiKey,
) {
  const configuredPlatforms = String(process.env.RIOT_PLATFORM || "")
    .split(",")
    .map((platform) => platform.trim().toLowerCase())
    .filter(Boolean);
  const candidatePlatforms = Array.from(
    new Set([...configuredPlatforms, ...AMERICAS_PLATFORM_ROUTES]),
  );
  let lastNotFoundError = null;
  let emptyMasteries = null;

  for (const platform of candidatePlatforms) {
    try {
      const masteries = await getTopChampionMasteries(puuid, count, apiKey, platform);

      if (Array.isArray(masteries) && masteries.length > 0) {
        return masteries;
      }

      emptyMasteries = masteries;
    } catch (error) {
      if (error instanceof RiotApiError && error.status === 404) {
        lastNotFoundError = error;
        continue;
      }

      throw error;
    }
  }

  if (emptyMasteries) {
    return emptyMasteries;
  }

  if (lastNotFoundError) {
    throw lastNotFoundError;
  }

  return [];
}

export async function getDataDragonVersion() {
  if (cachedDataDragonVersion) {
    return cachedDataDragonVersion;
  }

  const versions = await requestExternalJson(`${DDRAGON_BASE_URL}/api/versions.json`);
  cachedDataDragonVersion = versions?.[0];

  if (!cachedDataDragonVersion) {
    throw new RiotApiError("Unable to resolve Data Dragon version", 502);
  }

  return cachedDataDragonVersion;
}

export async function getDataDragonItemDictionary() {
  if (cachedItemDictionary) {
    return cachedItemDictionary;
  }

  const latestVersion = await getDataDragonVersion();

  const payload = await requestExternalJson(
    `${DDRAGON_BASE_URL}/cdn/${latestVersion}/data/en_US/item.json`,
  );

  cachedItemDictionary = new Map(
    Object.entries(payload?.data || {}).map(([itemId, item]) => [
      Number(itemId),
      {
        id: Number(itemId),
        name: item.name,
        imageFull: item.image?.full || `${itemId}.png`,
        iconUrl: `${DDRAGON_BASE_URL}/cdn/${latestVersion}/img/item/${
          item.image?.full || `${itemId}.png`
        }`,
      },
    ]),
  );

  return cachedItemDictionary;
}

export async function getDataDragonChampionDictionary() {
  if (cachedChampionDictionary) {
    return cachedChampionDictionary;
  }

  const latestVersion = await getDataDragonVersion();
  const payload = await requestExternalJson(
    `${DDRAGON_BASE_URL}/cdn/${latestVersion}/data/en_US/champion.json`,
  );

  cachedChampionDictionary = new Map(
    Object.values(payload?.data || {}).map((champion) => [
      Number(champion.key),
      {
        championId: Number(champion.key),
        dataDragonId: champion.id,
        name: champion.name,
        title: champion.title || "",
        blurb: champion.blurb || "",
        tags: champion.tags || [],
        imageFull: champion.image?.full || `${champion.id}.png`,
        iconUrl: `${DDRAGON_BASE_URL}/cdn/${latestVersion}/img/champion/${
          champion.image?.full || `${champion.id}.png`
        }`,
      },
    ]),
  );

  return cachedChampionDictionary;
}
