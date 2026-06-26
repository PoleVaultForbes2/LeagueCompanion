// Owns craftable item recipes, shard cost validation, item levels, and inventory mutation.
import { SHARD_CATEGORIES, toShardInventoryItems } from "./rewardEngine.js";
import { ensureShardCategoryItems } from "./inventoryStore.js";

const COMMON_SHARD_KEY = "common_shard";
const ANY_SHARD_KEY = "any_shard";
const COMMON_SUBSTITUTION_RATE = 10;
const MAX_ITEM_LEVEL = 5;
const TEST_CRAFTING_COSTS = process.env.CRAFTING_TEST_COSTS === "true";
const UPGRADE_COST_MULTIPLIER_BY_TARGET_LEVEL = {
  2: 1,
  3: 2,
  4: 4,
  5: 8,
};

const SHARD_LABELS = new Map(
  SHARD_CATEGORIES.map((category) => [category.key, category.displayName]),
);
const SHARD_CATEGORY_BY_KEY = new Map(
  SHARD_CATEGORIES.map((category) => [category.key, category]),
);

export const CRAFTABLE_ITEMS = [
  {
    name: "Galeforce",
    assetPath: "/assets/items/galeforce.png",
    stats: { ad: 60, as_percent: 20, crit_percent: 20 },
    recipe: { ad_shard: 600, as_shard: 400, crit_shard: 400 },
  },
  {
    name: "Kraken Slayer",
    assetPath: "/assets/items/krakenslayer.png",
    stats: { ad: 50, as_percent: 40, movement_percent: 4 },
    recipe: { ad_shard: 500, as_shard: 800, movement_shard: 80 },
  },
  {
    name: "Immortal Shieldbow",
    assetPath: "/assets/items/immortalshieldbow.png",
    stats: { ad: 50, crit_percent: 20, health: 250 },
    recipe: { ad_shard: 500, crit_shard: 400, health_shard: 250 },
  },
  {
    name: "Sunfire Aegis",
    assetPath: "/assets/items/sunfire.png",
    stats: { health: 500, armor: 50 },
    recipe: { health_shard: 500, armor_shard: 500 },
  },
  {
    name: "Frostfire Gauntlet",
    assetPath: "/assets/items/frostfire.png",
    stats: { health: 450, armor: 25, mr: 25 },
    recipe: { health_shard: 450, armor_shard: 250, mr_shard: 250 },
  },
  {
    name: "Heartsteel",
    assetPath: "/assets/items/heartsteel.png",
    stats: { health: 800 },
    recipe: { health_shard: 800, common_shard: 200 },
  },
  {
    name: "Duskblade of Draktharr",
    assetPath: "/assets/items/duskblade.png",
    stats: { ad: 60, movement_percent: 5 },
    recipe: { ad_shard: 600, movement_shard: 100, common_shard: 100 },
  },
  {
    name: "Eclipse",
    assetPath: "/assets/items/eclipse.png",
    stats: { ad: 70, health: 200 },
    recipe: { ad_shard: 700, health_shard: 200 },
  },
  {
    name: "Prowler's Claw",
    assetPath: "/assets/items/prowlersclaw.png",
    stats: { ad: 60, movement_percent: 5 },
    recipe: { ad_shard: 600, movement_shard: 100, common_shard: 100 },
  },
  {
    name: "Liandry's Anguish",
    assetPath: "/assets/items/liandrys.png",
    stats: { ap: 80, mana: 600 },
    recipe: { ap_shard: 800, mana_shard: 600 },
  },
  {
    name: "Luden's Tempest",
    assetPath: "/assets/items/ludens.png",
    stats: { ap: 80, mana: 600, movement_percent: 5 },
    recipe: { ap_shard: 800, mana_shard: 600, movement_shard: 100 },
  },
  {
    name: "Everfrost",
    assetPath: "/assets/items/everfrost.png",
    stats: { ap: 70, mana: 600, health: 250 },
    recipe: { ap_shard: 700, mana_shard: 600, health_shard: 250 },
  },
  {
    name: "Hextech Rocketbelt",
    assetPath: "/assets/items/rocketbelt.png",
    stats: { ap: 90, health: 250 },
    recipe: { ap_shard: 900, health_shard: 250 },
  },
  {
    name: "Night Harvester",
    assetPath: "/assets/items/nightharvester.png",
    stats: { ap: 90, health: 300 },
    recipe: { ap_shard: 900, health_shard: 300 },
  },
  {
    name: "Trinity Force",
    assetPath: "/assets/items/trinity.png",
    stats: { ad: 35, as_percent: 30, health: 300 },
    recipe: { ad_shard: 350, as_shard: 600, health_shard: 300 },
  },
  {
    name: "Goredrinker",
    assetPath: "/assets/items/goredrinker.png",
    stats: { ad: 55, health: 400 },
    recipe: { ad_shard: 550, health_shard: 400 },
  },
  {
    name: "Stridebreaker",
    assetPath: "/assets/items/stridebreaker.png",
    stats: { ad: 50, as_percent: 20, health: 400 },
    recipe: { ad_shard: 500, as_shard: 400, health_shard: 400 },
  },
  {
    name: "Divine Devourer",
    assetPath: "/assets/items/divine.png",
    stats: { ad: 40, health: 400 },
    recipe: { ad_shard: 400, health_shard: 400, common_shard: 100 },
  },
  {
    name: "Shurelya's Battlesong",
    assetPath: "/assets/items/shurelyas.png",
    stats: { ap: 40, health: 200, movement_percent: 5 },
    recipe: { ap_shard: 400, health_shard: 200, movement_shard: 100 },
  },
  {
    name: "Locket of the Iron Solari",
    assetPath: "/assets/items/locket.png",
    stats: { health: 200, armor: 30, mr: 30 },
    recipe: { health_shard: 200, armor_shard: 300, mr_shard: 300 },
  },
  {
    name: "Moonstone Renewer",
    assetPath: "/assets/items/moonstone.png",
    stats: { ap: 40, health: 200, mana: 200 },
    recipe: { ap_shard: 400, health_shard: 200, mana_shard: 200 },
  },
  {
    name: "Jak'Sho, The Protean",
    assetPath: "/assets/items/jaksho.png",
    stats: { health: 350, armor: 45, mr: 45 },
    recipe: { health_shard: 350, armor_shard: 450, mr_shard: 450 },
  },
];

function toItemKey(itemName) {
  return `crafted_${String(itemName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")}`;
}

function getItemByName(itemName) {
  return CRAFTABLE_ITEMS.find(
    (item) => item.name.toLowerCase() === String(itemName || "").toLowerCase(),
  );
}

function toQuantityMap(rows) {
  return new Map(rows.map((row) => [row.item_key, Number(row.quantity) || 0]));
}

function getShardQuantity(quantityByKey, shardKey) {
  return Number(quantityByKey.get(shardKey)) || 0;
}

function normalizeSelectedShardKeys(selectedShardKeys) {
  if (!Array.isArray(selectedShardKeys)) {
    return null;
  }

  const validShardKeys = new Set(SHARD_CATEGORIES.map((category) => category.key));

  return Array.from(
    new Set(
      selectedShardKeys
        .map((shardKey) => String(shardKey || "").trim())
        .filter((shardKey) => validShardKeys.has(shardKey)),
    ),
  );
}

function formatStatLabel(statKey, value) {
  const labels = {
    ad: "AD",
    ap: "AP",
    armor: "Armor",
    as_percent: "Attack Speed",
    crit_percent: "Crit",
    health: "Health",
    mana: "Mana",
    movement_percent: "Movement",
    mr: "MR",
  };

  const suffix = statKey.endsWith("_percent") ? "%" : "";
  return `+${value}${suffix} ${labels[statKey] || statKey}`;
}

function getItemCategory(recipe) {
  const primaryShardKey =
    Object.keys(recipe).find((shardKey) => shardKey !== COMMON_SHARD_KEY) ||
    COMMON_SHARD_KEY;
  const shardCategory = SHARD_CATEGORY_BY_KEY.get(primaryShardKey);

  return {
    key: primaryShardKey,
    slug: shardCategory?.slug || "common",
    label: shardCategory?.category || "Common",
    displayName: shardCategory?.displayName || "Common Shards",
  };
}

function getTotalShardQuantity(inventoryQuantities) {
  return SHARD_CATEGORIES.reduce(
    (total, category) => total + getShardQuantity(inventoryQuantities, category.key),
    0,
  );
}

function getTestShardSpendKey(inventoryQuantities, selectedShardKeys = null) {
  const selectedSet = selectedShardKeys ? new Set(selectedShardKeys) : null;

  return SHARD_CATEGORIES.find(
    (category) =>
      getShardQuantity(inventoryQuantities, category.key) > 0 &&
      (!selectedSet || selectedSet.has(category.key)),
  )?.key;
}

function getSelectedTotalShardQuantity(inventoryQuantities, selectedShardKeys) {
  return SHARD_CATEGORIES.reduce(
    (total, category) =>
      selectedShardKeys.includes(category.key)
        ? total + getShardQuantity(inventoryQuantities, category.key)
        : total,
    0,
  );
}

function getTestCostPlan(inventoryQuantities, selectedShardKeys = null) {
  const totalShards = selectedShardKeys
    ? getSelectedTotalShardQuantity(inventoryQuantities, selectedShardKeys)
    : getTotalShardQuantity(inventoryQuantities);
  const spendKey = getTestShardSpendKey(inventoryQuantities, selectedShardKeys);
  const costs = new Map();

  if (spendKey) {
    costs.set(spendKey, 1);
  }

  return {
    canUse: totalShards >= 1,
    recipeRows: [
      {
        shardKey: ANY_SHARD_KEY,
        label: "Any Shard",
        required: 1,
        owned: totalShards,
        directUsed: totalShards >= 1 ? 1 : 0,
        directMissing: totalShards >= 1 ? 0 : 1,
        commonUsed: 0,
        commonNeeded: 0,
        isSelected: selectedShardKeys ? Boolean(spendKey) : null,
        isCovered: totalShards >= 1,
        shortfall: Math.max(0, 1 - totalShards),
      },
    ],
    costs,
  };
}

function getRecipeRows(recipe, inventoryQuantities, selectedShardKeys = null) {
  const selectedSet = selectedShardKeys ? new Set(selectedShardKeys) : null;
  const isCommonSelected = !selectedSet || selectedSet.has(COMMON_SHARD_KEY);
  const commonAvailable = isCommonSelected
    ? getShardQuantity(inventoryQuantities, COMMON_SHARD_KEY)
    : 0;
  let commonReservedForDirectCost = Math.min(
    commonAvailable,
    recipe[COMMON_SHARD_KEY] || 0,
  );
  let commonRemaining = Math.max(0, commonAvailable - (recipe[COMMON_SHARD_KEY] || 0));

  return Object.entries(recipe)
    .map(([shardKey, required]) => {
      const owned = getShardQuantity(inventoryQuantities, shardKey);
      const isSelected = !selectedSet || selectedSet.has(shardKey);
      const directUsed = isSelected ? Math.min(owned, required) : 0;
      const directMissing = Math.max(0, required - directUsed);
      const commonNeeded =
        shardKey === COMMON_SHARD_KEY
          ? 0
          : directMissing * COMMON_SUBSTITUTION_RATE;
      const commonUsed =
        shardKey === COMMON_SHARD_KEY
          ? 0
          : Math.min(commonRemaining, commonNeeded);

      if (shardKey !== COMMON_SHARD_KEY) {
        commonRemaining -= commonUsed;
      }

      if (shardKey === COMMON_SHARD_KEY) {
        commonReservedForDirectCost = directUsed;
      }

      return {
        shardKey,
        label: SHARD_LABELS.get(shardKey) || shardKey,
        required,
        owned,
        directUsed,
        directMissing,
        commonUsed,
        commonNeeded,
        isSelected,
        isCovered:
          shardKey === COMMON_SHARD_KEY
            ? isSelected && directMissing === 0
            : isSelected && (directMissing === 0 || commonUsed >= commonNeeded),
        shortfall:
          shardKey === COMMON_SHARD_KEY
            ? Math.max(0, required - owned)
            : Math.max(0, commonNeeded - commonUsed),
      };
    })
    .map((row) =>
      row.shardKey === COMMON_SHARD_KEY
        ? { ...row, directUsed: commonReservedForDirectCost }
        : row,
    );
}

function getNormalCostPlan(recipe, inventoryQuantities, selectedShardKeys = null) {
  const recipeRows = getRecipeRows(recipe, inventoryQuantities, selectedShardKeys);
  const costs = new Map();

  for (const row of recipeRows) {
    costs.set(row.shardKey, (costs.get(row.shardKey) || 0) + row.directUsed);

    if (row.commonUsed > 0) {
      costs.set(COMMON_SHARD_KEY, (costs.get(COMMON_SHARD_KEY) || 0) + row.commonUsed);
    }
  }

  return {
    canUse: recipeRows.every((row) => row.isCovered),
    recipeRows,
    costs,
  };
}

function getCostPlan(recipe, inventoryQuantities, selectedShardKeys) {
  const normalizedSelectedShardKeys = normalizeSelectedShardKeys(selectedShardKeys);

  if (TEST_CRAFTING_COSTS) {
    return getTestCostPlan(inventoryQuantities, normalizedSelectedShardKeys);
  }

  return getNormalCostPlan(recipe, inventoryQuantities, normalizedSelectedShardKeys);
}

function createShardSelectionError(message, selectedItem, plan) {
  const error = new Error(message);
  error.status = 400;
  error.details = selectedItem
    ? {
        ...selectedItem,
        selectedRecipe: plan.recipeRows,
      }
    : { selectedRecipe: plan.recipeRows };
  throw error;
}

function getUpgradeRecipe(item, currentLevel) {
  const targetLevel = Math.min(MAX_ITEM_LEVEL, currentLevel + 1);
  const multiplier = UPGRADE_COST_MULTIPLIER_BY_TARGET_LEVEL[targetLevel] || 1;

  return Object.fromEntries(
    Object.entries(item.recipe).map(([shardKey, required]) => [
      shardKey,
      required * multiplier,
    ]),
  );
}

function getItemAction({ craftPlan, isOwned, level, upgradePlan }) {
  if (!isOwned) {
    return {
      type: "craft",
      label: "Craft",
      targetLevel: 1,
      canUse: craftPlan.canUse,
      recipe: craftPlan.recipeRows,
    };
  }

  if (level >= MAX_ITEM_LEVEL) {
    return {
      type: "maxed",
      label: "Max Level",
      targetLevel: MAX_ITEM_LEVEL,
      canUse: false,
      recipe: [],
    };
  }

  return {
    type: "upgrade",
    label: `Upgrade to Level ${level + 1}`,
    targetLevel: level + 1,
    canUse: upgradePlan.canUse,
    recipe: upgradePlan.recipeRows,
  };
}

function toCraftableDto(item, ownedQuantity, level, inventoryQuantities) {
  const isOwned = ownedQuantity > 0;
  const safeLevel = isOwned ? Math.max(1, Math.min(MAX_ITEM_LEVEL, level || 1)) : 0;
  const craftPlan = getCostPlan(item.recipe, inventoryQuantities);
  const upgradePlan =
    isOwned && safeLevel < MAX_ITEM_LEVEL
      ? getCostPlan(getUpgradeRecipe(item, safeLevel), inventoryQuantities)
      : { canUse: false, recipeRows: [], costs: new Map() };
  const action = getItemAction({
    craftPlan,
    isOwned,
    level: safeLevel,
    upgradePlan,
  });

  return {
    key: toItemKey(item.name),
    name: item.name,
    assetPath: item.assetPath,
    category: getItemCategory(item.recipe),
    description: `${item.name} is crafted from ${Object.keys(item.recipe)
      .map((shardKey) => SHARD_LABELS.get(shardKey) || shardKey)
      .join(", ")}.`,
    quantity: ownedQuantity,
    level: safeLevel,
    maxLevel: MAX_ITEM_LEVEL,
    isOwned,
    stats: Object.entries(item.stats).map(([statKey, value]) => ({
      key: statKey,
      value,
      label: formatStatLabel(statKey, value),
    })),
    recipe: action.recipe,
    craftRecipe: craftPlan.recipeRows,
    upgradeRecipe: upgradePlan.recipeRows,
    canCraft: !isOwned && craftPlan.canUse,
    canUpgrade: isOwned && safeLevel < MAX_ITEM_LEVEL && upgradePlan.canUse,
    action,
    commonSubstitutionRate: COMMON_SUBSTITUTION_RATE,
    isTestCostMode: TEST_CRAFTING_COSTS,
  };
}

export async function ensureCraftedItemDefinitions(db) {
  const itemIds = new Map();

  for (const item of CRAFTABLE_ITEMS) {
    const itemKey = toItemKey(item.name);
    const existingItem = await db.query(
      `SELECT id, item_key
       FROM items_dictionary
       WHERE item_key = $1
       ORDER BY id
       LIMIT 1`,
      [itemKey],
    );

    const result = existingItem.rows[0]
      ? await db.query(
          `UPDATE items_dictionary
           SET name = $2,
               description = $3,
               tier = 'Mythic',
               image_url = $4
           WHERE id = $1
           RETURNING id, item_key`,
          [
            existingItem.rows[0].id,
            item.name,
            JSON.stringify({ stats: item.stats, recipe: item.recipe }),
            item.assetPath,
          ],
        )
      : await db.query(
          `INSERT INTO items_dictionary
           (item_key, name, description, tier, image_url)
           VALUES ($1, $2, $3, 'Mythic', $4)
           RETURNING id, item_key`,
          [
            itemKey,
            item.name,
            JSON.stringify({ stats: item.stats, recipe: item.recipe }),
            item.assetPath,
          ],
        );

    itemIds.set(result.rows[0].item_key, result.rows[0].id);
  }

  return itemIds;
}

export async function ensurePlayerItemLevelTable(db) {
  await db.query(
    `CREATE TABLE IF NOT EXISTS player_item_levels (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_id INT NOT NULL REFERENCES items_dictionary(id) ON DELETE CASCADE,
      level INT NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 5),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id, item_id)
    )`,
  );

  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_player_item_levels_user_id
     ON player_item_levels(user_id)`,
  );
}

export async function getCraftingState(db, userId) {
  await ensureShardCategoryItems(db);
  await ensurePlayerItemLevelTable(db);
  const craftedItemIds = await ensureCraftedItemDefinitions(db);
  const allItemKeys = [
    ...SHARD_CATEGORIES.map((category) => category.key),
    ...Array.from(craftedItemIds.keys()),
  ];
  const result = await db.query(
    `SELECT d.item_key, COALESCE(SUM(pi.quantity), 0)::int AS quantity
     FROM items_dictionary d
     LEFT JOIN player_inventories pi
       ON pi.item_id = d.id
       AND pi.user_id = $1
     WHERE d.item_key = ANY($2::varchar[])
     GROUP BY d.item_key`,
    [userId, allItemKeys],
  );
  const quantityByKey = toQuantityMap(result.rows);

  await ensureLevelRowsForOwnedItems(db, userId, craftedItemIds, quantityByKey);

  const levelByItemKey = await getItemLevelsByKey(
    db,
    userId,
    Array.from(craftedItemIds.keys()),
  );
  const shardQuantities = new Map(
    SHARD_CATEGORIES.map((category) => [
      category.key,
      getShardQuantity(quantityByKey, category.key),
    ]),
  );

  return {
    shards: toShardInventoryItems(shardQuantities),
    totalShards: Array.from(shardQuantities.values()).reduce(
      (total, quantity) => total + quantity,
      0,
    ),
    items: CRAFTABLE_ITEMS.map((item) =>
      toCraftableDto(
        item,
        getShardQuantity(quantityByKey, toItemKey(item.name)),
        levelByItemKey.get(toItemKey(item.name)) || 0,
        quantityByKey,
      ),
    ),
    itemLevelCap: MAX_ITEM_LEVEL,
    commonSubstitutionRate: COMMON_SUBSTITUTION_RATE,
    isTestCostMode: TEST_CRAFTING_COSTS,
  };
}

async function ensureLevelRowsForOwnedItems(db, userId, craftedItemIds, quantityByKey) {
  for (const [itemKey, itemId] of craftedItemIds.entries()) {
    if (getShardQuantity(quantityByKey, itemKey) <= 0) {
      continue;
    }

    await db.query(
      `INSERT INTO player_item_levels (user_id, item_id, level)
       SELECT $1, $2, 1
       WHERE NOT EXISTS (
         SELECT 1
         FROM player_item_levels
         WHERE user_id = $1
         AND item_id = $2
       )`,
      [userId, itemId],
    );
  }
}

async function getItemLevelsByKey(db, userId, itemKeys) {
  const result = await db.query(
    `SELECT d.item_key, pil.level
     FROM player_item_levels pil
     INNER JOIN items_dictionary d
       ON d.id = pil.item_id
     WHERE pil.user_id = $1
     AND d.item_key = ANY($2::varchar[])`,
    [userId, itemKeys],
  );

  return new Map(
    result.rows.map((row) => [row.item_key, Number(row.level) || 1]),
  );
}

async function updateInventoryQuantity(db, userId, itemId, nextQuantity) {
  const existingInventory = await db.query(
    `SELECT id
     FROM player_inventories
     WHERE user_id = $1
     AND item_id = $2
     ORDER BY id
     LIMIT 1
     FOR UPDATE`,
    [userId, itemId],
  );

  if (existingInventory.rows[0]) {
    await db.query(
      `UPDATE player_inventories
       SET quantity = $2
       WHERE id = $1`,
      [existingInventory.rows[0].id, nextQuantity],
    );
    return;
  }

  await db.query(
    `INSERT INTO player_inventories (user_id, item_id, quantity)
     VALUES ($1, $2, $3)`,
    [userId, itemId, nextQuantity],
  );
}

async function getShardInventoryQuantities(db, userId) {
  const result = await db.query(
    `SELECT d.item_key, COALESCE(SUM(pi.quantity), 0)::int AS quantity
     FROM items_dictionary d
     LEFT JOIN player_inventories pi
       ON pi.item_id = d.id
       AND pi.user_id = $1
     WHERE d.item_key = ANY($2::varchar[])
     GROUP BY d.item_key`,
    [userId, SHARD_CATEGORIES.map((category) => category.key)],
  );

  return toQuantityMap(result.rows);
}

async function spendShardCosts(db, userId, inventoryQuantities, costs) {
  const shardItemIds = await getShardDefinitionIds(db);

  for (const [shardKey, cost] of costs.entries()) {
    if (cost <= 0) {
      continue;
    }

    const itemId = shardItemIds.get(shardKey);

    if (!itemId) {
      throw new Error(`Missing shard item definition for ${shardKey}`);
    }

    const currentQuantity = getShardQuantity(inventoryQuantities, shardKey);
    await updateInventoryQuantity(
      db,
      userId,
      itemId,
      Math.max(0, currentQuantity - cost),
    );
  }
}

async function setItemLevel(db, userId, itemId, level) {
  const existingLevel = await db.query(
    `SELECT id
     FROM player_item_levels
     WHERE user_id = $1
     AND item_id = $2
     ORDER BY id
     LIMIT 1
     FOR UPDATE`,
    [userId, itemId],
  );

  if (existingLevel.rows[0]) {
    await db.query(
      `UPDATE player_item_levels
       SET level = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [existingLevel.rows[0].id, level],
    );
    return;
  }

  await db.query(
    `INSERT INTO player_item_levels (user_id, item_id, level)
     VALUES ($1, $2, $3)`,
    [userId, itemId, level],
  );
}

async function getLockedItemLevel(db, userId, itemId) {
  const existingLevel = await db.query(
    `SELECT id, level
     FROM player_item_levels
     WHERE user_id = $1
     AND item_id = $2
     ORDER BY id
     LIMIT 1
     FOR UPDATE`,
    [userId, itemId],
  );

  if (existingLevel.rows[0]) {
    return {
      id: existingLevel.rows[0].id,
      level: Number(existingLevel.rows[0].level) || 1,
    };
  }

  const insertedLevel = await db.query(
    `INSERT INTO player_item_levels (user_id, item_id, level)
     VALUES ($1, $2, 1)
     RETURNING id, level`,
    [userId, itemId],
  );

  return {
    id: insertedLevel.rows[0].id,
    level: Number(insertedLevel.rows[0].level) || 1,
  };
}

export async function craftItem(db, userId, itemName, selectedShardKeys = []) {
  const item = getItemByName(itemName);

  if (!item) {
    const error = new Error("Craftable item not found");
    error.status = 404;
    throw error;
  }

  const client = await db.connect();

  try {
    await client.query("BEGIN");
    await ensureShardCategoryItems(client);
    await ensurePlayerItemLevelTable(client);
    const craftedItemIds = await ensureCraftedItemDefinitions(client);

    const { items } = await getCraftingState(client, userId);
    const selectedItem = items.find((candidate) => candidate.name === item.name);

    if (selectedItem?.isOwned) {
      const error = new Error("Item is already crafted. Upgrade it instead.");
      error.status = 400;
      error.details = selectedItem;
      throw error;
    }

    const inventoryQuantities = await getShardInventoryQuantities(client, userId);
    const craftPlan = getCostPlan(item.recipe, inventoryQuantities, selectedShardKeys);

    if (!craftPlan.canUse) {
      createShardSelectionError(
        "Select the required shards and make sure you have enough to craft this item",
        selectedItem,
        craftPlan,
      );
    }

    await spendShardCosts(client, userId, inventoryQuantities, craftPlan.costs);

    const craftedItemId = craftedItemIds.get(toItemKey(item.name));
    const craftedInventory = await client.query(
      `SELECT id, quantity
       FROM player_inventories
       WHERE user_id = $1
       AND item_id = $2
       ORDER BY id
       LIMIT 1
       FOR UPDATE`,
      [userId, craftedItemId],
    );

    if (craftedInventory.rows[0]) {
      await client.query(
        `UPDATE player_inventories
         SET quantity = 1
         WHERE id = $1`,
        [craftedInventory.rows[0].id],
      );
    } else {
      await client.query(
        `INSERT INTO player_inventories (user_id, item_id, quantity)
         VALUES ($1, $2, 1)`,
        [userId, craftedItemId],
      );
    }

    await setItemLevel(client, userId, craftedItemId, 1);
    await client.query("COMMIT");

    return getCraftingState(db, userId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function upgradeItem(db, userId, itemName, selectedShardKeys = []) {
  const item = getItemByName(itemName);

  if (!item) {
    const error = new Error("Craftable item not found");
    error.status = 404;
    throw error;
  }

  const client = await db.connect();

  try {
    await client.query("BEGIN");
    await ensureShardCategoryItems(client);
    await ensurePlayerItemLevelTable(client);
    const craftedItemIds = await ensureCraftedItemDefinitions(client);
    const craftedItemId = craftedItemIds.get(toItemKey(item.name));
    const craftedInventory = await client.query(
      `SELECT id, quantity
       FROM player_inventories
       WHERE user_id = $1
       AND item_id = $2
       ORDER BY id
       LIMIT 1
       FOR UPDATE`,
      [userId, craftedItemId],
    );

    if (!craftedInventory.rows[0] || Number(craftedInventory.rows[0].quantity) <= 0) {
      const error = new Error("Craft this item before upgrading it");
      error.status = 400;
      throw error;
    }

    const currentItemLevel = await getLockedItemLevel(client, userId, craftedItemId);

    if (currentItemLevel.level >= MAX_ITEM_LEVEL) {
      const error = new Error("Item is already at max level");
      error.status = 400;
      throw error;
    }

    const inventoryQuantities = await getShardInventoryQuantities(client, userId);
    const upgradePlan = getCostPlan(
      getUpgradeRecipe(item, currentItemLevel.level),
      inventoryQuantities,
      selectedShardKeys,
    );

    if (!upgradePlan.canUse) {
      createShardSelectionError(
        "Select the required shards and make sure you have enough to upgrade this item",
        null,
        upgradePlan,
      );
    }

    await spendShardCosts(client, userId, inventoryQuantities, upgradePlan.costs);
    await setItemLevel(client, userId, craftedItemId, currentItemLevel.level + 1);
    await client.query("COMMIT");

    return getCraftingState(db, userId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getShardDefinitionIds(db) {
  const result = await db.query(
    `SELECT id, item_key
     FROM items_dictionary
     WHERE item_key = ANY($1::varchar[])`,
    [SHARD_CATEGORIES.map((category) => category.key)],
  );

  return new Map(result.rows.map((row) => [row.item_key, row.id]));
}
