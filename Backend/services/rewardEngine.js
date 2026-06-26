// Calculates match XP, shard drops, reward payloads, and shard category metadata.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const itemMap = JSON.parse(
  readFileSync(join(__dirname, "..", "item_map.json"), "utf8"),
);

export const SHARD_CATEGORIES = [
  {
    key: "ad_shard",
    slug: "ad",
    category: "AD",
    displayName: "AD Shards",
    assetPath: "/assets/shards/ad.png",
    theme: { accent: "#ef4444", glow: "rgba(239,68,68,0.24)" },
  },
  {
    key: "crit_shard",
    slug: "crit",
    category: "Crit",
    displayName: "Crit Shards",
    assetPath: "/assets/shards/crit.png",
    theme: { accent: "#a855f7", glow: "rgba(168,85,247,0.24)" },
  },
  {
    key: "as_shard",
    slug: "as",
    category: "AS",
    displayName: "AS Shards",
    assetPath: "/assets/shards/as.png",
    theme: { accent: "#eab308", glow: "rgba(234,179,8,0.24)" },
  },
  {
    key: "ap_shard",
    slug: "ap",
    category: "AP",
    displayName: "AP Shards",
    assetPath: "/assets/shards/ap.png",
    theme: { accent: "#f97316", glow: "rgba(249,115,22,0.24)" },
  },
  {
    key: "mana_shard",
    slug: "mana",
    category: "Mana",
    displayName: "Mana Shards",
    assetPath: "/assets/shards/mana.png",
    theme: { accent: "#3b82f6", glow: "rgba(59,130,246,0.24)" },
  },
  {
    key: "health_shard",
    slug: "health",
    category: "Health",
    displayName: "Health Shards",
    assetPath: "/assets/shards/health.png",
    theme: { accent: "#22c55e", glow: "rgba(34,197,94,0.22)" },
  },
  {
    key: "armor_shard",
    slug: "armor",
    category: "Armor",
    displayName: "Armor Shards",
    assetPath: "/assets/shards/armor.png",
    theme: { accent: "#92400e", glow: "rgba(146,64,14,0.26)" },
  },
  {
    key: "mr_shard",
    slug: "mr",
    category: "MR",
    displayName: "MR Shards",
    assetPath: "/assets/shards/mr.png",
    theme: { accent: "#ec4899", glow: "rgba(236,72,153,0.24)" },
  },
  {
    key: "movement_shard",
    slug: "movement",
    category: "Movement",
    displayName: "Movement Shards",
    assetPath: "/assets/shards/movement.png",
    theme: { accent: "#f8fafc", glow: "rgba(248,250,252,0.2)" },
  },
  {
    key: "common_shard",
    slug: "common",
    category: "Common",
    displayName: "Common Shards",
    assetPath: "/assets/shards/common.png",
    theme: { accent: "#94a3b8", glow: "rgba(148,163,184,0.2)" },
  },
];

const CATEGORY_BY_KEY = new Map(
  SHARD_CATEGORIES.map((category) => [category.key, category]),
);

const TIER_DROP_RANGES = {
  1: [1, 2],
  2: [3, 5],
  3: [8, 12],
};

function toSafeInteger(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : fallback;
}

function normalizeItemName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function buildItemRewardLookup(rawItemMap) {
  const lookup = new Map();

  for (const [categoryKey, itemTiers] of Object.entries(rawItemMap)) {
    const category = CATEGORY_BY_KEY.get(categoryKey);

    if (!category) {
      continue;
    }

    for (const [itemName, tier] of Object.entries(itemTiers)) {
      const normalizedTier = toSafeInteger(tier);

      if (!TIER_DROP_RANGES[normalizedTier]) {
        continue;
      }

      lookup.set(normalizeItemName(itemName), {
        categoryKey,
        category: category.category,
        displayName: category.displayName,
        itemName,
        tier: normalizedTier,
      });
    }
  }

  return lookup;
}

const ITEM_REWARD_LOOKUP = buildItemRewardLookup(itemMap);

function rollInclusive(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function rollShardQuantity(tier) {
  const [min, max] = TIER_DROP_RANGES[tier] || TIER_DROP_RANGES[1];
  return rollInclusive(min, max);
}

function applyShardDropMultiplier(quantity, multiplier) {
  const baseQuantity = toSafeInteger(quantity);
  const safeMultiplier = Math.max(1, Number(multiplier) || 1);

  return Math.max(baseQuantity, Math.round(baseQuantity * safeMultiplier));
}

function rollRareShard(itemName) {
  // Rare Shard Placeholder: flat 5% Tier 3 hook for a future rare inventory.
  if (Math.random() < 0.05) {
    console.log(`[rewards] Rare shard placeholder rolled for ${itemName}`);
  }
}

export function getXpForNextLevel(level) {
  const safeLevel = Math.max(1, toSafeInteger(level, 1));
  const levelOffset = safeLevel - 1;

  return 250 + levelOffset * 150 + levelOffset * levelOffset * 25;
}

export function applyXpProgression(currentLevel, currentXp, earnedXp) {
  let appLevel = Math.max(1, toSafeInteger(currentLevel, 1));
  let appXp = toSafeInteger(currentXp) + toSafeInteger(earnedXp);
  let levelsGained = 0;

  while (appXp >= getXpForNextLevel(appLevel)) {
    appXp -= getXpForNextLevel(appLevel);
    appLevel += 1;
    levelsGained += 1;
  }

  return {
    appLevel,
    appXp,
    levelsGained,
    xpToNextLevel: getXpForNextLevel(appLevel),
  };
}

export function getParticipantItemIds(participant) {
  return [0, 1, 2, 3, 4, 5]
    .map((slot) => Number(participant?.[`item${slot}`] || 0))
    .filter((itemId) => Number.isInteger(itemId) && itemId > 0);
}

export function calculateMatchXp(participant) {
  const kills = toSafeInteger(participant?.kills);
  const deaths = toSafeInteger(participant?.deaths);
  const assists = toSafeInteger(participant?.assists);
  const kda = (kills + assists) / Math.max(1, deaths);
  const winBonus = participant?.win ? 50 : 0;
  const performanceBonus = kda >= 3 ? 50 : 0;

  return {
    total: 100 + winBonus + performanceBonus,
    base: 100,
    winBonus,
    performanceBonus,
    kda: Number(kda.toFixed(2)),
  };
}

export function calculateCreepScore(participant) {
  return (
    toSafeInteger(participant?.totalMinionsKilled) +
    toSafeInteger(participant?.neutralMinionsKilled)
  );
}

export function calculateMatchReward(
  participant,
  itemDictionary,
  championProgression = {},
) {
  const xp = calculateMatchXp(participant);
  const itemIds = getParticipantItemIds(participant);
  const shardDropMultiplier = Math.max(
    1,
    Number(championProgression.dropMultiplier) || 1,
  );
  const shardBonusPercent = Math.max(
    0,
    Number(championProgression.shardBonusPercent) || 0,
  );
  const shardDrops = itemIds
    .map((itemId) => resolveShardDropForItem(itemId, itemDictionary))
    .map((drop) => applyChampionShardBonus(drop, shardDropMultiplier))
    .filter(Boolean);

  return {
    xpAwarded: xp.total,
    csAwarded: calculateCreepScore(participant),
    xp,
    championProgression: {
      level: Math.max(0, Number(championProgression.level) || 0),
      maxLevel: Math.max(0, Number(championProgression.maxLevel) || 10),
      shardBonusPercent,
      dropMultiplier: shardDropMultiplier,
    },
    stats: {
      kills: toSafeInteger(participant?.kills),
      deaths: toSafeInteger(participant?.deaths),
      assists: toSafeInteger(participant?.assists),
      win: Boolean(participant?.win),
      kda: xp.kda,
      totalItemsBuilt: itemIds.length,
      creepScore: calculateCreepScore(participant),
    },
    shardDrops,
    shardTotals: summarizeShardDrops(shardDrops),
  };
}

function applyChampionShardBonus(drop, multiplier) {
  if (!drop) {
    return null;
  }

  const baseQuantity = drop.quantity;
  const quantity = applyShardDropMultiplier(baseQuantity, multiplier);

  return {
    ...drop,
    baseQuantity,
    bonusQuantity: Math.max(0, quantity - baseQuantity),
    quantity,
  };
}

export function resolveShardDropForItem(itemId, itemDictionary) {
  const item = itemDictionary.get(Number(itemId));

  if (!item) {
    return null;
  }

  const mappedItem = ITEM_REWARD_LOOKUP.get(normalizeItemName(item.name));

  if (!mappedItem) {
    return null;
  }

  if (mappedItem.tier === 3) {
    rollRareShard(item.name);
  }

  return {
    itemId: Number(itemId),
    itemName: item.name,
    categoryKey: mappedItem.categoryKey,
    category: mappedItem.category,
    displayName: mappedItem.displayName,
    tier: mappedItem.tier,
    quantity: rollShardQuantity(mappedItem.tier),
  };
}

export function summarizeShardDrops(shardDrops) {
  const totals = {};

  for (const drop of shardDrops) {
    totals[drop.categoryKey] = (totals[drop.categoryKey] || 0) + drop.quantity;
  }

  return totals;
}

export function mergeShardTotals(target, source) {
  for (const [categoryKey, quantity] of Object.entries(source || {})) {
    target[categoryKey] = (target[categoryKey] || 0) + toSafeInteger(quantity);
  }

  return target;
}

export function getShardCategory(categoryKey) {
  return CATEGORY_BY_KEY.get(categoryKey) || null;
}

export function toShardInventoryItems(quantityByKey = new Map()) {
  return SHARD_CATEGORIES.map((category) => ({
    ...category,
    quantity: toSafeInteger(quantityByKey.get(category.key)),
  }));
}

export function buildRewardClaimPayload(processedRewards, progression) {
  const totals = processedRewards.reduce(
    (summary, reward) => {
      summary.kills += reward.stats.kills;
      summary.deaths += reward.stats.deaths;
      summary.assists += reward.stats.assists;
      summary.totalVictories += reward.stats.win ? 1 : 0;
      summary.totalItemsBuilt += reward.stats.totalItemsBuilt;
      summary.totalXp += reward.xpAwarded;
      summary.totalCs += toSafeInteger(reward.csAwarded);
      mergeShardTotals(summary.shardTotals, reward.shardTotals);
      return summary;
    },
    {
      kills: 0,
      deaths: 0,
      assists: 0,
      totalVictories: 0,
      totalItemsBuilt: 0,
      totalXp: 0,
      totalCs: 0,
      shardTotals: {},
    },
  );

  const breakdown = buildRewardBreakdown(
    totals.totalXp,
    totals.shardTotals,
    totals.totalCs,
  );

  return {
    matchCount: processedRewards.length,
    stats: {
      overallKda: Number(
        ((totals.kills + totals.assists) / Math.max(1, totals.deaths)).toFixed(
          2,
        ),
      ),
      totalVictories: totals.totalVictories,
      totalItemsBuilt: totals.totalItemsBuilt,
      totalCreepScore: totals.totalCs,
    },
    progression,
    breakdown,
    shards: toShardRewardItems(totals.shardTotals),
  };
}

function buildRewardBreakdown(totalXp, shardTotals, totalCs) {
  const entries = [];

  if (totalXp > 0) {
    entries.push({
      type: "xp",
      label: "XP",
      quantity: totalXp,
      iconText: "XP",
      text: `+${totalXp} XP`,
    });
  }

  if (totalCs > 0) {
    entries.push({
      type: "cs",
      label: "CS",
      quantity: totalCs,
      iconText: "CS",
      text: `+${totalCs} CS`,
    });
  }

  for (const shard of toShardRewardItems(shardTotals)) {
    entries.push({
      type: "shard",
      categoryKey: shard.key,
      label: shard.displayName,
      quantity: shard.quantity,
      assetPath: shard.assetPath,
      theme: shard.theme,
      text: `+${shard.quantity} ${shard.displayName}`,
    });
  }

  return entries;
}

function toShardRewardItems(shardTotals) {
  return SHARD_CATEGORIES.map((category) => ({
    ...category,
    quantity: toSafeInteger(shardTotals?.[category.key]),
  })).filter((category) => category.quantity > 0);
}
