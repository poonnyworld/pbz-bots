# ⚔️ Phantom Blade Zero Community Bots

![Project Status](https://img.shields.io/badge/Status-Production%20Ready-success)
![Docker](https://img.shields.io/badge/Docker-Enabled-blue?logo=docker)
![Node.js](https://img.shields.io/badge/Node.js-v20-green?logo=node.js)
![Prisma](https://img.shields.io/badge/ORM-Prisma-white?logo=prisma)

A comprehensive Discord bot system designed for the **Phantom Blade Zero** community. This project includes a point tracking system (Honor), an item redemption shop, and a full-stack web dashboard for administration.

---

## ✨ Features

### 🤖 Honor Bot (Discord App)
* **Activity Tracking:** Automatically awards "Souls" (points) to active users in chat.
* **Economy System:**
    * `!start` - Register a new account with starting souls.
    * `!honor` - Check current accumulated souls.
    * `!shop` - View available rewards in a rich embed interface.
    * `!buy <ID>` - Redeem rewards (cuts points & stock automatically).
* **Data Persistence:** SQLite database managed via Prisma ORM.

### 💻 Admin Console (Web Dashboard)
* **Real-time Leaderboard:** View top warriors and their honor points.
* **Item Management:** Add, edit, hide, or delete shop items via a web interface.
* **User Management:** Manually adjust user points (for events or corrections).
* **Secure Access:** Runs on a dedicated port restricted by Docker network.

---

## 🛠️ Tech Stack

* **Runtime:** Node.js (v20 Alpine)
* **Framework:** Discord.js v14, Express.js
* **Database:** SQLite + Prisma ORM
* **Deployment:** Docker Compose (Microservices Architecture)
* **Frontend:** Vanilla HTML/CSS (Custom Phantom Blade Theme)

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
Create a .env file in the root directory:
```.env
HONOR_BOT_TOKEN=your_discord_bot_token_here
WATCH_PARTY_TOKEN=your_second_bot_token_here
```

### 3. Run with Docker
Launch the entire system with a single command:
```bash
docker compose up -d --build
```

### 4. Verification
* **Discord Bot:** Type !start in your server.
* **Admin Console:** Visit http://localhost:3000 (or your VPS IP).

---

### 📝 License
This project is open-source and available under the MIT License.
