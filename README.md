<div align="center">
  <img src="https://raw.githubusercontent.com/rohitwadettiwar123/Kopargaon-Biodiversity-conservation-portal/main/Frontend/assets/logo.png" alt="Logo" width="120" onerror="this.src='https://img.icons8.com/color/120/000000/leaf.png'">

  # 🌿 Kopargaon Biodiversity Information & Conservation Portal

  ### Explore • Monitor • Conserve

  <p align="center">
    A full-stack platform for biodiversity monitoring and citizen science in Kopargaon Taluka, Maharashtra — built to help communities, forest officers, and researchers protect local ecosystems with real data.
  </p>

  [![Node.js](https://img.shields.io/badge/Node.js-18.x-339933.svg?style=for-the-badge&logo=node.js)](https://nodejs.org)
  [![Express](https://img.shields.io/badge/Express-5.x-000000.svg?style=for-the-badge&logo=express)](https://expressjs.com)
  [![SQLite](https://img.shields.io/badge/SQLite-3-003B57.svg?style=for-the-badge&logo=sqlite)](https://sqlite.org/)
  [![Status](https://img.shields.io/badge/Status-Active-22c55e.svg?style=for-the-badge)](https://github.com/rohitwadettiwar123/Kopargaon-Biodiversity-conservation-portal)

</div>

<br/>

## 🌟 What This Project Does

Kopargaon is home to rich, under-documented biodiversity — and most of that knowledge lives in scattered spreadsheets and field notebooks. This portal changes that.

It turns raw ecological data into a **live, interactive dashboard**: citizens can report sightings from the field, researchers get a real-time view of species and habitat health, and administrators can verify community data — all through a secure, fast, and visually polished web app.

**In short:** it makes local biodiversity data visible, trustworthy, and actionable.

---

## 🚀 Quick Start (Under 1 Minute)

### Requirements
- Node.js v18 or higher
- npm v9 or higher

### Setup
```bash
# 1. Clone the repository
git clone https://github.com/rohitwadettiwar123/Kopargaon-Biodiversity-conservation-portal.git

# 2. Move into the project folder
cd Kopargaon-Biodiversity-conservation-portal

# 3. Install dependencies
npm install
```

### Run
```bash
npm start
```
> Windows users can also just double-click **`START.bat`**.

The server automatically sets up the SQLite database, starts the API, and serves the frontend at:

**➡️ http://localhost:3000**

---

## 🔐 Try It Instantly — Demo Accounts

No sign-up needed. Log in and explore both sides of the platform right away:

| Role | Email | Password | What You Can Do |
|------|-------|----------|------------------|
| 🛡️ **Admin** | `admin@kbic.in` | `admin123` | Verify or reject citizen reports, view full analytics |
| 👤 **Citizen** | `citizen@kbic.in` | `pass123` | Submit field reports, earn points, view profile |

---

## ✨ Key Features

### 🌍 Interactive GIS Mapping
Multi-layer Leaflet maps display **20,000+ species observations**, with toggles for biodiversity hotspots, water bodies, and environmental threats — all rendered live from real data.

### 📝 Citizen Science & Gamification
Anyone can submit a field sighting with geo-coordinates and a photo. Admins verify or reject submissions, and contributors climb a **gamified leaderboard**, earning badges like 🌱 *Green Guardian* along the way.

### 📊 Advanced Analytics
A live **Biodiversity Health Score** summarizes ecosystem status at a glance, backed by dynamic Chart.js visualizations covering species distribution, IUCN conservation status, and monthly observation trends — plus **NDVI vegetation health monitoring**.

### 🔐 Secure, Production-Grade Backend
The API is fully authenticated with **JWT** and **bcrypt**, protected with rate limiting and Helmet security headers, and runs on **SQLite in WAL mode** for reliable, high-concurrency access.

---

## 🏗️ Project Architecture

```plaintext
Kopargaon-Biodiversity-Portal/
├── backend/
│   ├── server.js               # Express API core (40+ endpoints)
│   ├── database.sqlite         # Auto-generated SQLite database
│   ├── import-csv.js           # CSV → SQLite migration script
│   └── uploads/                # Citizen report image uploads
├── Frontend/
│   ├── index.html              # Main application dashboard
│   ├── css/
│   │   ├── style.css           # Global design system (dark / glassmorphism)
│   │   └── responsive.css      # Mobile breakpoints
│   ├── js/
│   │   ├── app.js              # Routing, sidebar, globals
│   │   ├── auth.js             # JWT session management
│   │   ├── data-loader.js      # API fetch abstraction
│   │   └── ...                 # 13+ modular JS controllers
│   └── pages/                  # 14 application views (profile, map, etc.)
├── data/
│   └── *.csv                   # 17 raw biodiversity datasets
├── START.bat                   # One-click Windows start script
└── package.json                # Project metadata & scripts
```

---

## 🔌 API at a Glance

The backend exposes **40+ REST API endpoints**. A few highlights:

| Method | Endpoint | Auth Required | Description |
|--------|----------|:---:|--------------|
| `POST` | `/api/auth/login` | No | Log in and receive a JWT |
| `GET`  | `/api/species` | No | Get all species with pagination & filters |
| `GET`  | `/api/reports` | ✅ | Get the logged-in user's citizen reports |
| `PATCH`| `/api/reports/:id/verify` | 🛡️ Admin | Verify a citizen-submitted report |
| `GET`  | `/api/dashboard/stats` | No | Get global system KPIs |
| `GET`  | `/api/gis/hotspots` | No | Get GeoJSON data for map rendering |

---

## 🌍 Alignment with UN Sustainable Development Goals

This platform was designed with real-world impact in mind, directly supporting:

- 🌿 **SDG 15 — Life on Land:** comprehensive species and habitat monitoring
- 💧 **SDG 6 — Clean Water:** water body health and pollution tracking
- 🌡️ **SDG 13 — Climate Action:** environmental threat logging and NDVI trends
- 📚 **SDG 4 — Quality Education:** a 460-species digital education hub

---

## 💚 Why It Matters

Biodiversity data usually stays locked away in reports few people read. This project puts it in the hands of the people who can act on it — turning everyday citizens into contributors, and raw numbers into a clear, living picture of Kopargaon's natural world.

<div align="center">
  <br/>
  <p><b>🌿 Explore • Monitor • Conserve 🌿</b></p>
</div>