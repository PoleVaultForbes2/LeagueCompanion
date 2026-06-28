# 🏆 League Companion

VISIT HERE: [https://league-companion-d5l3fonra-forbes-birds.vercel.app/](https://league-companion-smoky.vercel.app/)

A gamified, full-stack player progression dashboard that interfaces with live match telemetry to turn your real-world League of Legends games into an immersive item-crafting and champion-collecting loop. 

> **Note:** This project is designed strictly as a non-commercial, private application for personal use and friend group testing to showcase scalable full-stack software architecture.

---

## 🚀 Core Features

- **Automated Match Syncing:** Connects seamlessly via Riot Games APIs to query, ingest, and process recent match history data moments after your nexus explodes.
- **Dynamic Shard Aggregation:** Analyzes item recipes built during active play, converting them into 10 distinct, color-coded item shard categories (AD, Crit, AP, Armor, etc.) based on tier and configuration mapping.
- **Advanced Leveling Loop:** Earn global App XP and account levels calculated instantly via base matches played, victory modifiers, and exceptional high-tier KDA thresholds.
- **The Crafting Circle:** Spend gathered raw material shards using precise stat-to-shard translation formulas to materialize permanent, fully forged legendary gear assets.
- **Multi-View Carousel Interface:** Features a clean, responsive web presentation incorporating horizontal map progression layout stubs, locked/unlocked champion roster matrices, and automated wizard-style reward summary modals.

---

## 🛠️ Stack & Tools Used

### Frontend & UI
- **React (Vite):** Powering a lightning-fast, state-driven single-page modular dashboard.
- **Tailwind CSS v4:** Providing utility-first, dark-themed gaming aesthetic layouts, custom color accents, and responsive layout constraints without bloating stylesheets.

### Backend & Storage
- **Node.js & Express:** Architected to handle modular routing, middleware verification, CORS management, and secure, high-speed upstream proxy connections.
- **Supabase :** Relational database storage managing user configurations, transactional token states, inventory counters, and composite key match-history checkpoints.

### APIs & Developer Tools
- **Riot Games Developer API (`match-v5`, `account-v1`):** Upstream telemetry gateway providing deep player performance metrics.
- **Gemini & Codex:** Utilized as intelligent AI pairing collaborators to refine backend mathematical logic, architecture edge cases, and design specifications.
- **VS Code & Git/GitHub:** Core local integrated development environment and remote source control management.
- **Postman:** Dedicated testing harness used for constructing headers, isolating endpoint payloads, and auditing upstream JSON query responses.

---

## 📁 Project Architecture Overview

```text
LeagueCompanion/
├── Frontend/          # React + Vite Client SPA
│   ├── src/
│   │   ├── assets/    # Static asset matrices (Item PNGs, placeholders)
│   │   ├── components/# Modals, Layout blocks, Page views
│   │   └── App.jsx    # Stateful navigation & core carousel container
└── Backend/           # Express Server & DB Pool
    ├── config/        # Stat ratios & crafting recipes configurations
    ├── routes/        # Modular API route controllers
    ├── db.js          # PostgreSQL pg pool lifecycle configuration
    └── server.js      # Backend server configuration & initialization
```

Hosted on Vercel and Render. [Public URL: [https://putlinkhere.com](https://league-companion-d5l3fonra-forbes-birds.vercel.app/)](https://league-companion-smoky.vercel.app/)


📝 License
Distributed strictly for educational, portfolio demonstration, and private recreational testing. All underlying League of Legends assets, champion names, and specific item properties are copyright © Riot Games, Inc.
