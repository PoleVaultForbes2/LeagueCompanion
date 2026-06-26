# System Context

This document details the architectural boundaries, tech stack, and deployment environment of the League Gamified Companion app. Reference this file alongside `project_purpose.md` before executing modifications altering data structures, backend routing, Riot API data pipelines, or frontend views.

## Application Architecture

### Project Structure
The application is organized as a clean, decoupled monorepo split into dedicated `Backend` and `Frontend` environments:

```text
LeagueGame/
├── project_purpose.md & system_context.md
├── Backend/
│   ├── db/                 # Database initialization and connection pool configuration
│   ├── routes/             # Express API router endpoints (e.g., users, matches, rewards)
│   ├── services/           # Business logic & Riot API integration handlers
│   ├── .env                # Backend local secrets (RIOT_API_KEY, DB_URI)
│   ├── db.js               # Core database client instance
│   ├── index.js            # Express application bootstrap entry point
└── Frontend/
    ├── src/
    │   ├── assets/         # Images, game icons, global styles
    │   ├── components/     # Reusable React components (cards, loaders, modals)
    │   ├── router/         # Client-side route declarations (React Router)
    │   ├── services/       # Client-side API fetch abstraction layers
    │   ├── stores/         # Centralized React state / Context providers
    │   ├── views/          # Page-level route views (Dashboard, Collection View)
    │   ├── App.jsx         # Root React application component
    │   └── main.jsx        # React DOM bootstrapping entry point
    ├── .env                # Frontend public environmental constants
    ├── Dockerfile          # Frontend container distribution configuration
    ├── tailwind.config.js  # Tailwind styling guidelines and custom themes
    └── vite.config.js      # Vite build pipeline setup
```


# Frontend (Web Client)
## Core Framework: React (Vite-driven Single Page Application) targeting a mobile-first responsive design layout.

## Styling Strategy: Tailwind CSS focusing on deep dark mode palettes, vibrant item tiers, glowing borders, and modern gaming client aesthetics.

## State Management: Centralized React Context/State management handling client-side inventory arrays, active player profiles, and loader toggle triggers during match synchronization requests.

# Backend (Server)
## Core Runtime: Node.js using the Express framework.

## Responsibilities:

* Serves as a secure proxy to the Riot Games API (match-v5, summoner-v4).

* Processes incoming match telemetry data to compute metric performance vectors (KDA weights, item thresholds, win bonuses).

* Validates and signs off on reward drops (shards, crafting components).

# Database & Storage
## Core Engine: PostgreSQL.

## Access Layer: Managed within Backend/db/ using native pooling queries via the pg client driver to ensure performant, scalable query execution.

## Database Schema (PostgreSQL)
Run the following DDL statements inside your PostgreSQL instance to initialize the baseline collection and progression tables:

~~~ sql

~~~


# Data Structures & Progression System
## The Reward Pipeline Loop
* The React client handles a user interaction and dispatches a POST request to /api/rewards/claim.

* The server pulls down the player's last 5 recent match IDs via Riot API match-v5.

* The server queries match_checkpoints to filter out IDs already processed.

* For each new match ID:

* The server extracts stats belonging to the user's riot_puuid.

* Reward Math Vector: It parses kills, deaths, assists, win, and total gold.

* Shards are allocated based on specific performance modifiers (e.g., high assists reward supportive component shards; wins grant bonus legendary chests).

* The transaction writes history entries to match_checkpoints, upserts items to player_inventories, and increments app_xp.

* The compiled payload of brand-new drops is delivered securely right back to the client interface.