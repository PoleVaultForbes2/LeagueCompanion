// Wraps all browser-to-Express API calls; frontend state only renders server payloads.
const rawApiBaseUrl =
  import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "/api";

function normalizeApiBaseUrl(value) {
  const trimmedValue = String(value || "/api")
    .trim()
    .replace(/\/+$/, "");

  if (!trimmedValue) {
    return "/api";
  }

  if (/\/api$/i.test(trimmedValue)) {
    return trimmedValue;
  }

  if (/^https?:\/\//i.test(trimmedValue)) {
    return `${trimmedValue}/api`;
  }

  return trimmedValue;
}

const API_BASE_URL = normalizeApiBaseUrl(rawApiBaseUrl);

async function requestJson(path, options = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  } catch {
    throw new Error("Backend is not reachable");
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.error || "Request failed");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export async function createUserAccount({ summonerName, tagline, password }) {
  return requestJson("/users/register", {
    method: "POST",
    body: JSON.stringify({ summonerName, tagline, password }),
  });
}

export async function loginUser({ summonerName, tagline, password }) {
  return requestJson("/users/login", {
    method: "POST",
    body: JSON.stringify({ summonerName, tagline, password }),
  });
}

export async function getUserProfile(userId) {
  return requestJson(`/users/${userId}`);
}

export async function syncRecentMatches(userId, options = {}) {
  return requestJson(`/matches/sync/${userId}`, {
    method: "POST",
    body: JSON.stringify(options),
  });
}

export async function getShardInventory(userId) {
  return requestJson(`/inventory/${userId}/shards`);
}

export async function buyShardWithCs(userId, shardKey, quantity = 1) {
  return requestJson(`/inventory/${userId}/shards/buy`, {
    method: "POST",
    body: JSON.stringify({ shardKey, quantity }),
  });
}

export async function getRecentGames(userId) {
  return requestJson(`/matches/${userId}/recent`);
}

export async function getGlobalLeaderboard() {
  return requestJson("/leaderboard/global");
}

export async function getCraftingState(userId) {
  return requestJson(`/crafting/${userId}`);
}

export async function craftItem(userId, itemName, selectedShardKeys = []) {
  return requestJson(`/crafting/${userId}/craft`, {
    method: "POST",
    body: JSON.stringify({ itemName, selectedShardKeys }),
  });
}

export async function upgradeItem(userId, itemName, selectedShardKeys = []) {
  return requestJson(`/crafting/${userId}/upgrade`, {
    method: "POST",
    body: JSON.stringify({ itemName, selectedShardKeys }),
  });
}

export async function getChampionRoster(userId) {
  return requestJson(`/champions/${userId}/roster`);
}

export async function getRegionProgress(userId) {
  return requestJson(`/champions/${userId}/regions`);
}

export async function getMissionState(userId) {
  return requestJson(`/missions/${userId}`);
}

export async function acceptMission(userId, missionKey) {
  return requestJson(`/missions/${userId}/${missionKey}/accept`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function completeMission(userId, missionKey) {
  return requestJson(`/missions/${userId}/${missionKey}/complete`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function getLoadoutState(userId) {
  return requestJson(`/loadout/${userId}`);
}

export async function setActiveChampion(userId, championSlug) {
  return requestJson(`/loadout/${userId}/champion`, {
    method: "POST",
    body: JSON.stringify({ championSlug }),
  });
}

export async function setBackpackItem(userId, itemName, slotIndex) {
  return requestJson(`/loadout/${userId}/backpack`, {
    method: "POST",
    body: JSON.stringify({ itemName, slotIndex }),
  });
}
