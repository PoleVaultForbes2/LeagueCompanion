-- Schema-only Supabase setup for League Companion.
-- Paste this into the Supabase SQL editor for a clean project.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  summoner_name VARCHAR(100) NOT NULL,
  tagline VARCHAR(10) NOT NULL,
  riot_puuid VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT,
  summoner_level INT NOT NULL DEFAULT 1,
  app_level INT NOT NULL DEFAULT 1,
  app_xp INT NOT NULL DEFAULT 0,
  cs_currency INT NOT NULL DEFAULT 0,
  checkpoint_game_id VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (summoner_name, tagline)
);

CREATE TABLE IF NOT EXISTS match_checkpoints (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_id VARCHAR(50) NOT NULL,
  champion_played VARCHAR(50) NOT NULL,
  champion_played_slug VARCHAR(80),
  champion_kill_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  kills INT NOT NULL DEFAULT 0,
  deaths INT NOT NULL DEFAULT 0,
  assists INT NOT NULL DEFAULT 0,
  creep_score INT NOT NULL DEFAULT 0,
  win BOOLEAN NOT NULL,
  item_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  queue_id INT,
  game_mode VARCHAR(40),
  game_duration_seconds INT,
  game_ended_at TIMESTAMP WITH TIME ZONE,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_user_match UNIQUE (user_id, match_id)
);

CREATE TABLE IF NOT EXISTS items_dictionary (
  id SERIAL PRIMARY KEY,
  item_key VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  tier VARCHAR(20) CHECK (tier IN ('Common', 'Rare', 'Epic', 'Legendary', 'Mythic')),
  image_url VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS player_inventories (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id INT NOT NULL REFERENCES items_dictionary(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, item_id)
);

CREATE TABLE IF NOT EXISTS player_item_levels (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id INT NOT NULL REFERENCES items_dictionary(id) ON DELETE CASCADE,
  level INT NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 5),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, item_id)
);

CREATE TABLE IF NOT EXISTS player_champions (
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
);

CREATE TABLE IF NOT EXISTS player_region_points (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  region_key VARCHAR(80) NOT NULL,
  region_name VARCHAR(80) NOT NULL,
  points INT NOT NULL DEFAULT 0 CHECK (points >= 0),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, region_key)
);

CREATE TABLE IF NOT EXISTS player_missions (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mission_key VARCHAR(80) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'active', 'completed')),
  accepted_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, mission_key)
);

CREATE TABLE IF NOT EXISTS player_loadouts (
  user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  active_champion_slug VARCHAR(80),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS player_backpack_slots (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot_index INT NOT NULL CHECK (slot_index >= 0 AND slot_index < 6),
  item_id INT NOT NULL REFERENCES items_dictionary(id) ON DELETE CASCADE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, slot_index)
);

CREATE TABLE IF NOT EXISTS groups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS group_members (
  id SERIAL PRIMARY KEY,
  group_id INT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_user_id
  ON match_checkpoints(user_id);

CREATE INDEX IF NOT EXISTS idx_checkpoints_match_id
  ON match_checkpoints(match_id);

CREATE INDEX IF NOT EXISTS idx_checkpoints_user_champion_slug
  ON match_checkpoints(user_id, champion_played_slug);

CREATE INDEX IF NOT EXISTS idx_inventory_user_id
  ON player_inventories(user_id);

CREATE INDEX IF NOT EXISTS idx_player_item_levels_user_id
  ON player_item_levels(user_id);

CREATE INDEX IF NOT EXISTS idx_player_champions_user_id
  ON player_champions(user_id);

CREATE INDEX IF NOT EXISTS idx_player_region_points_user_id
  ON player_region_points(user_id);

CREATE INDEX IF NOT EXISTS idx_player_missions_user_status
  ON player_missions(user_id, status);

CREATE INDEX IF NOT EXISTS idx_player_backpack_slots_user_id
  ON player_backpack_slots(user_id);

CREATE INDEX IF NOT EXISTS idx_group_members_user_id
  ON group_members(user_id);
