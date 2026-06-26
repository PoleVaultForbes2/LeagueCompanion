# Project Purpose

This is a personal gamified companion web application based on League of Legends, built for myself and my friends. The primary goal is a fun, non-commercial progression and collector game where real-world match performance directly rewards players with in-game shards, items, and loot. This project serves as a premier portfolio piece to showcase full-stack development capability, clean system design, backend-to-frontend synchronization, and robust third-party API integration to prospective employers.

## Design Principles

### Immersive & Gamified Experience (Clean, Not Sloppy)
While the application does not require heavy 3D graphics or complex game engines like Unity, it must invoke a clean, modern gaming dashboard aesthetic. 
* **Visual Appeal:** Use modern component framing, dark mode defaults, rich borders, and elegant hover animations (using Tailwind CSS) to mimic premium client UI experiences.
* **Frictionless Rewards:** Ensure that checking for recent matches, opening reward shards, and inspecting the inventory feels smooth, responsive, and visually rewarding.
* **Simplistic and Ease of Use:** One of the main goals is to keep this project easy to use for users. Let them enjoy collecting without getting frustrated. 

### Scalable Full-Stack Architecture
The application must explicitly decouple its core concerns to reflect professional software engineering standards:
* **Strict Backend Isolation:** The frontend client never communicates directly with the Riot Games API. All match parsing, security checks, and reward validation are heavily locked behind a dedicated server.
* **Predictable Reward State:** Loot validation logic must be calculated and signed off completely by the backend server before persisting changes to the database and broadcasting state updates to the UI.
* **Multiple users:** This app is expecting multiple users that will sign in using their riot username. 

### Clean, Documented, and AI-Friendly Code
The code base must remain tightly organized, highly scannable, and expressive. AI-assisted changes must adhere to:
* High-readability, pragmatic patterns over unnecessarily dense, DRY abstractions.
* Highly semantic database naming conventions (`snake_case`) matching clear JavaScript/TypeScript application logic (`camelCase`).
* Strict separation of API routes, business logic services, and database persistence layers.

### Pragmatic Security & API Compliance
* **Secret Isolation:** Production or development Riot API keys must reside securely in backend environmental isolation, never leaking to the client browser.
* **Friendly Rate Management:** Architecture must safely handle and mitigate Riot’s developer rate limitations without crashing or corrupting pending user cycles.

## Guidance for Future AI Work
When modifying files, respect the boundary between the `Backend` and `Frontend` directories. Never attempt to combine backend logic inside the frontend views. Prioritize user tracking consistency, clear data flows, and fluid UI presentation. Avoid introducing extra third-party libraries unless explicitly required for data modeling or specific animations.

IMPORTANT FOR FUTURE ENGINE MIGRATION: To ensure a seamless transition to a game engine (like Unity or Godot) in the future, treat the frontend strictly as a "dumb" visual dashboard. Focus 100% of the game logic, reward math, region unlocking rules, and state progression entirely within the Node.js backend. The frontend should only display data handed to it by backend API responses.