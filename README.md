<div align="center">
  <img src="https://raw.githubusercontent.com/rohitwadettiwar123/Kopargaon-Biodiversity-conservation-portal/main/Frontend/assets/logo.png" alt="Logo" width="120" onerror="this.src='https://img.icons8.com/color/120/000000/leaf.png'">
  
  # 🌿 Kopargaon Biodiversity Information & Conservation Portal
  
  **Explore • Monitor • Conserve**

  <p align="center">
    A comprehensive, production-ready full-stack platform for biodiversity monitoring and citizen science in Kopargaon Taluka, Maharashtra.
  </p>

  [![Hackathon](https://img.shields.io/badge/Hackathon-2026-22c55e.svg?style=for-the-badge)](https://github.com/rohitwadettiwar123/Kopargaon-Biodiversity-conservation-portal)
  [![Node.js](https://img.shields.io/badge/Node.js-18.x-339933.svg?style=for-the-badge&logo=node.js)](https://nodejs.org)
  [![Express](https://img.shields.io/badge/Express-5.x-000000.svg?style=for-the-badge&logo=express)](https://expressjs.com)
  [![SQLite](https://img.shields.io/badge/SQLite-3-003B57.svg?style=for-the-badge&logo=sqlite)](https://sqlite.org/)
  [![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)
</div>

<br/>

## 🌟 Overview

The **Kopargaon Biodiversity Portal** is a scalable, API-driven web application designed to empower citizens, forest officers, and researchers to track, protect, and study the local wildlife of Kopargaon. 

It transforms raw CSV datasets into a rich, interactive, and visually stunning dashboard featuring real-time GIS mapping, citizen science reporting, gamified leaderboards, and AI-assisted data visualization.

## 🚀 Quick Start

Get the project running locally in under a minute!

### 1. Requirements
- Node.js (v18 or higher)
- npm (v9 or higher)

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/rohitwadettiwar123/Kopargaon-Biodiversity-conservation-portal.git

# Navigate to the project directory
cd Kopargaon-Biodiversity-conservation-portal

# Install backend dependencies
npm install
```

### 3. Start the Server
For Windows users, simply double click the `START.bat` file, or run:
```bash
npm start
```
> The server will automatically initialize the SQLite database, serve the REST API, and host the frontend on **http://localhost:3000**

---

## 🔐 Demo Accounts

Experience the platform from different access levels:

| Role | Email | Password | Permissions |
|------|-------|----------|-------------|
| 🛡️ **Admin** | `admin@kbic.in` | `admin123` | Verify/Reject reports, view full analytics |
| 👤 **Citizen** | `citizen@kbic.in` | `pass123` | Submit reports, earn points, view profile |

---

## ✨ Key Features

### 🌍 Interactive GIS Mapping
- Multi-layer Leaflet maps displaying 20,000+ species observations.
- Toggles for Biodiversity Hotspots, Water Bodies, and Environmental Threats.

### 📝 Citizen Science & Gamification
- Users can submit field reports with geo-coordinates.
- Admin dashboard to Verify or Reject community submissions.
- Gamified Leaderboard with points and automated Badges (e.g., 🌱 Green Guardian).

### 📊 Advanced Analytics
- Real-time **Biodiversity Health Score**.
- Dynamic Chart.js visualizations for Species Distribution, IUCN Status, and Monthly Trends.
- NDVI (Normalized Difference Vegetation Index) health monitoring.

### 🔐 Secure Backend API
- Fully authenticated REST API using **JWT** and **bcrypt**.
- Rate limiting and Helmet security configurations.
- SQLite WAL mode for high-concurrency read/write operations.

---

## 🏗️ Project Architecture

```plaintext
Kopargaon-Biodiversity-Portal/
├── backend/
│   ├── server.js               # Express API Core (40+ endpoints)
│   ├── database.sqlite         # Auto-generated SQLite Database
│   ├── import-csv.js           # CSV to SQLite Migration script
│   └── uploads/                # Citizen report image uploads
├── Frontend/
│   ├── index.html              # Main Application Dashboard
│   ├── css/
│   │   ├── style.css           # Global Design System (Dark/Glassmorphism)
│   │   └── responsive.css      # Mobile breakpoints
│   ├── js/
│   │   ├── app.js              # Routing, Sidebar, Globals
│   │   ├── auth.js             # JWT Session Management
│   │   ├── data-loader.js      # API Fetch Abstraction
│   │   └── ...                 # 13+ Modular JS Controllers
│   └── pages/                  # 14 Application Views (Profile, Map, etc.)
├── data/
│   └── *.csv                   # 17 Raw Biodiversity Datasets
├── START.bat                   # Windows 1-Click Start Script
└── package.json                # Project Metadata & Scripts
```

---

## 🔌 API Documentation Snapshot

The backend provides over 40 robust REST API endpoints.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/login` | No | Login and receive JWT |
| `GET`  | `/api/species` | No | Get all species with pagination & filters |
| `GET`  | `/api/reports` | ✅ | Get my citizen reports |
| `PATCH`| `/api/reports/:id/verify`| 🛡️ | Admin: Verify a citizen report |
| `GET`  | `/api/dashboard/stats`| No | Get global system KPIs |
| `GET`  | `/api/gis/hotspots` | No | Get GeoJSON data for map rendering |

---

## 🌍 UN Sustainable Development Goals (SDGs)

This platform directly aligns with the United Nations SDGs:
- 🌿 **SDG 15 (Life on Land):** Comprehensive species and habitat monitoring.
- 💧 **SDG 6 (Clean Water):** Water body health and pollution tracking.
- 🌡️ **SDG 13 (Climate Action):** Environmental threat logging and NDVI trends.
- 📚 **SDG 4 (Quality Education):** Extensive 460-species digital education hub.

---

<div align="center">
  <p>Built with Environment love for the 2026 Hackathon</p>
  <p><b>Explore • Monitor • Conserve</b></p>
</div>
