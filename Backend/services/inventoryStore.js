// Persists shard item definitions and player shard inventory quantities.
import {
  getShardCategory,
  SHARD_CATEGORIES,
  toShardInventoryItems,
} from "./rewardEngine.js";

export const CS_COST_PER_SHARD = 10;

function createInventoryError(message, status = 400, details = null) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

function toShardEntries(shardTotals) {
  if (shardTotals instanceof Map) {
    return Array.from(shardTotals.entries());
  }

  return Object.entries(shardTotals || {});
}

export async function ensureShardCategoryItems(db) {
  const itemIds = new Map();

  for (const category of SHARD_CATEGORIES) {
    const existingItem = await db.query(
      `SELECT id, item_key
       FROM items_dictionary
       WHERE item_key = $1
       ORDER BY id
       LIMIT 1`,
      [category.key],
    );

    const result = existingItem.rows[0]
      ? await db.query(
          `UPDATE items_dictionary
           SET name = $2,
               description = $3,
               image_url = $4
           WHERE id = $1
           RETURNING id, item_key`,
          [
            existingItem.rows[0].id,
            category.displayName,
            `${category.category} shard currency`,
            category.assetPath,
          ],
        )
      : await db.query(
          `INSERT INTO items_dictionary
           (item_key, name, description, tier, image_url)
           VALUES ($1, $2, $3, 'Common', $4)
           RETURNING id, item_key`,
          [
            category.key,
            category.displayName,
            `${category.category} shard currency`,
            category.assetPath,
          ],
        );

    itemIds.set(result.rows[0].item_key, result.rows[0].id);
  }

  return itemIds;
}

export async function incrementShardInventory(db, userId, shardTotals) {
  const categoryItemIds = await ensureShardCategoryItems(db);

  for (const [categoryKey, rawQuantity] of toShardEntries(shardTotals)) {
    const itemId = categoryItemIds.get(categoryKey);
    const quantity = Number(rawQuantity);

    if (!itemId || !Number.isFinite(quantity) || quantity <= 0) {
      continue;
    }

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
         SET quantity = quantity + $2
         WHERE id = $1`,
        [existingInventory.rows[0].id, Math.floor(quantity)],
      );
      continue;
    }

    await db.query(
      `INSERT INTO player_inventories (user_id, item_id, quantity)
       VALUES ($1, $2, $3)`,
      [userId, itemId, Math.floor(quantity)],
    );
  }
}

export async function getShardInventoryForUser(db, userId) {
  await ensureShardCategoryItems(db);

  const result = await db.query(
    `SELECT d.item_key, COALESCE(SUM(pi.quantity), 0)::int AS quantity
     FROM items_dictionary d
     LEFT JOIN player_inventories pi
       ON pi.item_id = d.id
       AND pi.user_id = $1
     WHERE d.item_key = ANY($2::varchar[])
     GROUP BY d.item_key`,
      [
        userId,
        SHARD_CATEGORIES.map((category) => category.key),
      ],
    );

  const quantityByKey = new Map(
    result.rows.map((row) => [row.item_key, row.quantity]),
  );

  return toShardInventoryItems(quantityByKey);
}

export async function buyShardWithCs(db, userId, shardKey, quantity = 1) {
  const normalizedShardKey = String(shardKey || "").trim();
  const shardCategory = getShardCategory(normalizedShardKey);
  const purchaseQuantity = Math.floor(Number(quantity) || 0);

  if (!shardCategory) {
    throw createInventoryError("Valid shard category is required");
  }

  if (purchaseQuantity <= 0) {
    throw createInventoryError("Purchase quantity must be greater than zero");
  }

  const cost = purchaseQuantity * CS_COST_PER_SHARD;

  await db.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS cs_currency INT NOT NULL DEFAULT 0
  `);

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const userResult = await client.query(
      `SELECT id, cs_currency
       FROM users
       WHERE id = $1
       FOR UPDATE`,
      [userId],
    );
    const user = userResult.rows[0];

    if (!user) {
      throw createInventoryError("User not found", 404);
    }

    const currentCs = Number(user.cs_currency) || 0;

    if (currentCs < cost) {
      throw createInventoryError("Not enough CS to buy that shard", 400, {
        currentCs,
        cost,
      });
    }

    await client.query(
      `UPDATE users
       SET cs_currency = cs_currency - $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [userId, cost],
    );

    await incrementShardInventory(client, userId, {
      [normalizedShardKey]: purchaseQuantity,
    });

    const shards = await getShardInventoryForUser(client, userId);
    const totalShards = shards.reduce(
      (total, shard) => total + shard.quantity,
      0,
    );
    const csCurrency = currentCs - cost;

    await client.query("COMMIT");

    return {
      shards,
      totalShards,
      csCurrency,
      purchase: {
        shardKey: normalizedShardKey,
        quantity: purchaseQuantity,
        cost,
      },
      shop: {
        costPerShard: CS_COST_PER_SHARD,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
