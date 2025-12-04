# ⚔️ Phantom Blade Zero Community Bots

![Project Status](https://img.shields.io/badge/Status-Production%20Ready-success)
![Docker](https://img.shields.io/badge/Docker-Enabled-blue?logo=docker)
![Node.js](https://img.shields.io/badge/Node.js-v20-green?logo=node.js)
![Prisma](https://img.shields.io/badge/ORM-Prisma-white?logo=prisma)

A comprehensive Discord bot system designed for the **Phantom Blade Zero** community. This project includes a point tracking system (Honor), an item redemption shop, and a full-stack web dashboard for administration.

---

## ✨ Features

### 🤖 Discord Commands (Economy & Honor)
* **Honor System:** Automatically tracks user engagement and awards "Souls" (points).
* **Economy Commands:**
  * `!start` - Register a new warrior profile/wallet.
  * `!honor` - Check your current accumulated Souls.
  * `!shop` - Open the reward redemption interface (Rich Embed).
  * `!buy <ID>` - Redeem items (Automatically handles stock & deductions).

### 💻 Admin Dashboard (Web Interface)
* **Item Management:** Add, edit, hide, or delete shop items in real-time.
* **Leaderboard:** View the top-ranking warriors in the community.
* **User Management:** Manually adjust user points/souls for event rewards.
* **Access:** Accessible via web browser on port `3000` (default).

---

## 🛠️ Tech Stack

* **Runtime:** Node.js (v20 Alpine)
* **Framework:** Discord.js v14, Express.js
* **Database:** SQLite + Prisma ORM
* **Deployment:** Docker Compose (V2)
* **Infrastructure:** Cloud VPS (Linux/Ubuntu)

---

## 📂 Project Structure

```bash
pbz-bots/
├── docker-compose.yml       # Orchestrates Bot + DB + Network
├── .env                     # Secrets (Token, DB URL)
├── honor-bot/               # 🛡️ Service 1: Honor System
│   ├── Dockerfile
│   ├── index.js             # Bot Client + API Server
│   ├── prisma/              # Database Schema & Migrations
│   └── public/              # Web Dashboard (Frontend)
└── watch-party-bot/         # 🎬 Service 2: Event Coordinator (Coming Soon)

```

## 🚀 Deployment Guide

### Prerequisites
* Docker & Docker Compose installed
* Git installed

### 1. Installation
Clone the repository to your server or local machine:
```bash
git clone [https://github.com/YourUsername/pbz-bots.git](https://github.com/YourUsername/pbz-bots.git)
cd pbz-bots
```

### 2. Configuration
You must manually create a .env file to store your secrets (it is not included in the repo for security)
```bash
# Create .env file
nano .env
```
Add the following variables to the .env file:
```.env
DISCORD_TOKEN=your_pbz_bot_token_here
DATABASE_URL="file:./dev.db"
# Add other credentials if used (e.g. Dashboard Admin Password)
```

### 3. Run with Docker
Launch the entire system with a single command:
```bash
docker compose up -d --build
```

### 4. Database Setup
If running for the first time, ensure the database schema is pushed:
```bash
docker compose exec honor-bot npx prisma migrate deploy
```

### 5. Verification
* **Discord Bot:** Type !start in your server.
* **Admin Console:** Visit http://localhost:3000 (or your VPS IP).

---

## 🔍 Troubleshooting & Common Issues

**🔴 Error:**  env file .env not found
* **Cause:** Docker cannot find the configuration file.
* **Fix:** You skipped Step 2. Please run nano .env and paste your configuration variables inside.

**🟡 Warning:** attribute version is obsolete
* **Cause:** The docker-compose.yml file contained a legacy version number (e.g., version: '3.8').
* **Fix:** We have updated the file to Docker Compose V2 standards by removing the version line. If you see this warning, it means your file might still have the old line, or you can simply ignore it as it doesn't affect functionality.

---

### 📝 License
This project is open-source and available under the MIT License.
