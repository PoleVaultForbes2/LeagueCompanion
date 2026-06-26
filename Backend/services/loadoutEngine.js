// Owns active champion and six-slot backpack loadout state for each player.
import { getChampionRoster } from "./championEngine.js";
import { getCraftingState } from "./craftingEngine.js";

const BACKPACK_SIZE = 6;

function toEmptyBackpackSlots() {
  return Array.from({ length: BACKPACK_SIZE }, (_value, index) => ({
    slotIndex: index,
    item: null,
  }));
}

function mergeBackpackSlots(backpackRows, itemById) {
  const slots = toEmptyBackpackSlots();

  for (const row of backpackRows) {
    const slotIndex = Number(row.slot_index);

    if (slotIndex < 0 || slotIndex >= BACKPACK_SIZE) {
      continue;
    }

    slots[slotIndex] = {
      slotIndex,
      item: itemById.get(Number(row.item_id)) || null,
    };
  }

  return slots;
}

function getOwnedCraftedItems(craftingState) {
  return (craftingState.items || []).filter((item) => item.isOwned);
}

async function ensureLoadoutTables(db) {
  await db.query(
    `CREATE TABLE IF NOT EXISTS player_loadouts (
      user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      active_champion_slug VARCHAR(80),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`,
  );

  await db.query(
    `CREATE TABLE IF NOT EXISTS player_backpack_slots (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      slot_index INT NOT NULL CHECK (slot_index >= 0 AND slot_index < 6),
      item_id INT NOT NULL REFERENCES items_dictionary(id) ON DELETE CASCADE,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id, slot_index)
    )`,
  );

  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_player_backpack_slots_user_id
     ON player_backpack_slots(user_id)`,
  );
}

async function ensureUserLoadoutRow(db, userId) {
  await db.query(
    `INSERT INTO player_loadouts (user_id)
     SELECT $1
     WHERE NOT EXISTS (
       SELECT 1
       FROM player_loadouts
       WHERE user_id = $1
     )`,
    [userId],
  );
}

async function getItemIdsByKey(db, itemKeys) {
  if (itemKeys.length === 0) {
    return new Map();
  }

  const result = await db.query(
    `SELECT id, item_key
     FROM items_dictionary
     WHERE item_key = ANY($1::varchar[])`,
    [itemKeys],
  );

  return new Map(result.rows.map((row) => [row.item_key, Number(row.id)]));
}

async function autoFillBackpackWhenSmall(db, userId, ownedItems) {
  if (ownedItems.length > BACKPACK_SIZE) {
    return;
  }

  await db.query("DELETE FROM player_backpack_slots WHERE user_id = $1", [userId]);

  const itemIdsByKey = await getItemIdsByKey(
    db,
    ownedItems.map((item) => item.key),
  );

  for (const [index, item] of ownedItems.entries()) {
    const itemId = itemIdsByKey.get(item.key);

    if (!itemId) {
      continue;
    }

    await db.query(
      `INSERT INTO player_backpack_slots (user_id, slot_index, item_id)
       VALUES ($1, $2, $3)`,
      [userId, index, itemId],
    );
  }
}

async function syncBackpackWithOwnedItems(db, userId, ownedItems) {
  const ownedKeys = ownedItems.map((item) => item.key);

  if (ownedKeys.length === 0) {
    await db.query("DELETE FROM player_backpack_slots WHERE user_id = $1", [userId]);
    return;
  }

  const itemIdsByKey = await getItemIdsByKey(db, ownedKeys);
  const ownedItemIds = Array.from(itemIdsByKey.values());

  await db.query(
    `DELETE FROM player_backpack_slots
     WHERE user_id = $1
     AND NOT (item_id = ANY($2::int[]))`,
    [userId, ownedItemIds],
  );

  await autoFillBackpackWhenSmall(db, userId, ownedItems);
}

async function getLoadoutRow(db, userId) {
  const result = await db.query(
    `SELECT user_id, active_champion_slug
     FROM player_loadouts
     WHERE user_id = $1`,
    [userId],
  );

  return result.rows[0] || null;
}

async function getBackpackRows(db, userId) {
  const result = await db.query(
    `SELECT slot_index, item_id
     FROM player_backpack_slots
     WHERE user_id = $1
     ORDER BY slot_index ASC`,
    [userId],
  );

  return result.rows;
}

function getActiveChampionFromRoster(activeChampionSlug, champions) {
  if (!activeChampionSlug) {
    return null;
  }

  return (
    champions.find((champion) => champion.slug === activeChampionSlug && champion.isUnlocked) ||
    null
  );
}

async function ensureDefaultActiveChampion(db, userId, loadoutRow, champions) {
  const activeChampion = getActiveChampionFromRoster(
    loadoutRow?.active_champion_slug,
    champions,
  );

  if (activeChampion) {
    return activeChampion;
  }

  const firstUnlockedChampion = champions.find((champion) => champion.isUnlocked) || null;

  await db.query(
    `UPDATE player_loadouts
     SET active_champion_slug = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $1`,
    [userId, firstUnlockedChampion?.slug || null],
  );

  return firstUnlockedChampion;
}

export async function getLoadoutState(db, userId, riotApiKey) {
  await ensureLoadoutTables(db);
  await ensureUserLoadoutRow(db, userId);

  const [championRoster, craftingState] = await Promise.all([
    getChampionRoster(db, userId, riotApiKey),
    getCraftingState(db, userId),
  ]);
  const ownedItems = getOwnedCraftedItems(craftingState);

  await syncBackpackWithOwnedItems(db, userId, ownedItems);

  const itemIdByKey = await getItemIdsByKey(
    db,
    ownedItems.map((item) => item.key),
  );
  const itemById = new Map(
    ownedItems.map((item) => [itemIdByKey.get(item.key), item]).filter(([itemId]) => itemId),
  );
  const [loadoutRow, backpackRows] = await Promise.all([
    getLoadoutRow(db, userId),
    getBackpackRows(db, userId),
  ]);
  const activeChampion = await ensureDefaultActiveChampion(
    db,
    userId,
    loadoutRow,
    championRoster.champions || [],
  );

  return {
    activeChampion,
    backpack: mergeBackpackSlots(backpackRows, itemById),
    backpackSize: BACKPACK_SIZE,
    ownedItemCount: ownedItems.length,
    replacementRequired: false,
  };
}

export async function setActiveChampion(db, userId, championSlug, riotApiKey) {
  await ensureLoadoutTables(db);
  await ensureUserLoadoutRow(db, userId);

  const championRoster = await getChampionRoster(db, userId, riotApiKey);
  const champion = (championRoster.champions || []).find(
    (candidate) => candidate.slug === championSlug,
  );

  if (!champion) {
    const error = new Error("Champion not found");
    error.status = 404;
    throw error;
  }

  if (!champion.isUnlocked) {
    const error = new Error("Locked champions cannot be set active");
    error.status = 400;
    throw error;
  }

  await db.query(
    `UPDATE player_loadouts
     SET active_champion_slug = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $1`,
    [userId, championSlug],
  );

  return getLoadoutState(db, userId, riotApiKey);
}

export async function setBackpackItem(db, userId, itemName, slotIndex, riotApiKey) {
  await ensureLoadoutTables(db);
  await ensureUserLoadoutRow(db, userId);

  const craftingState = await getCraftingState(db, userId);
  const ownedItems = getOwnedCraftedItems(craftingState);
  const selectedItem = ownedItems.find(
    (item) => item.name.toLowerCase() === String(itemName || "").toLowerCase(),
  );

  if (!selectedItem) {
    const error = new Error("Craft this item before adding it to the backpack");
    error.status = 400;
    throw error;
  }

  if (ownedItems.length <= BACKPACK_SIZE) {
    await autoFillBackpackWhenSmall(db, userId, ownedItems);
    return getLoadoutState(db, userId, riotApiKey);
  }

  const itemIdsByKey = await getItemIdsByKey(
    db,
    ownedItems.map((item) => item.key),
  );
  const selectedItemId = itemIdsByKey.get(selectedItem.key);
  const currentRows = await getBackpackRows(db, userId);
  const existingSlot = currentRows.find((row) => Number(row.item_id) === selectedItemId);

  if (existingSlot) {
    return getLoadoutState(db, userId, riotApiKey);
  }

  const normalizedSlotIndex = Number(slotIndex);

  if (
    !Number.isInteger(normalizedSlotIndex) ||
    normalizedSlotIndex < 0 ||
    normalizedSlotIndex >= BACKPACK_SIZE
  ) {
    const error = new Error("Choose a backpack slot to replace");
    error.status = 409;
    error.details = {
      ...(await getLoadoutState(db, userId, riotApiKey)),
      replacementRequired: true,
      pendingItem: selectedItem,
    };
    throw error;
  }

  await db.query(
    `DELETE FROM player_backpack_slots
     WHERE user_id = $1
     AND item_id = $2`,
    [userId, selectedItemId],
  );

  await db.query(
    `INSERT INTO player_backpack_slots (user_id, slot_index, item_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, slot_index)
     DO UPDATE SET item_id = EXCLUDED.item_id,
                   updated_at = CURRENT_TIMESTAMP`,
    [userId, normalizedSlotIndex, selectedItemId],
  );

  return getLoadoutState(db, userId, riotApiKey);
}
