<div align="center">

<img src="https://raw.githubusercontent.com/rohitwadettiwar123/Kopargaon-Biodiversity-conservation-portal/main/Frontend/assets/logo.png" alt="Kopargaon Biodiversity Portal Logo" width="110" onerror="this.src='https://img.icons8.com/color/110/000000/leaf.png'">

# 🌿 Kopargaon Biodiversity Information & Conservation Portal

### Explore · Monitor · Conserve

<p align="center">
  A full-stack biodiversity monitoring platform for Kopargaon Taluka, Maharashtra —<br/>
  empowering citizens, forest officers, and researchers to protect local ecosystems with live, verified data.
</p>

[![Node.js](https://img.shields.io/badge/Node.js-18.x-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-5.x-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://sqlite.org)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES2022-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![License](https://img.shields.io/badge/License-ISC-22c55e?style=for-the-badge)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Active-22c55e?style=for-the-badge)](https://github.com/rohitwadettiwar123/Kopargaon-Biodiversity-conservation-portal)

</div>

---

## 🌟 What This Project Does

Kopargaon Taluka, Ahmednagar district, Maharashtra — home to rich but under-documented biodiversity. Most of that knowledge lives in scattered spreadsheets and field notebooks. This portal changes that.

It turns **raw ecological data into a live, interactive platform**: citizens report sightings from the field with GPS coordinates, researchers see a real-time view of species and habitat health, and administrators verify community data — all through a secure, fast, and beautifully designed web application.

**In short: it makes local biodiversity data visible, trustworthy, and actionable — at the community level.**

---

## 🚀 Quick Start

### Prerequisites
| Tool | Minimum Version |
|------|-----------------|
| [Node.js](https://nodejs.org) | `v18.0.0` |
| npm | `v9.0.0` |
| A modern web browser | Chrome / Firefox / Edge |

### Setup & Run

```bash
# 1. Clone the repository
git clone https://github.com/rohitwadettiwar123/Kopargaon-Biodiversity-conservation-portal.git

# 2. Enter the project folder
cd Kopargaon-Biodiversity-conservation-portal

# 3. Install all backend dependencies
npm install

# 4. Start the server
npm start
```

> **Windows shortcut:** Double-click **`START.bat`** — it installs dependencies and starts the server automatically.

The server auto-creates the SQLite database, imports all CSV datasets, and starts the API + frontend server at:

**➡️ [http://localhost:3000](http://localhost:3000)**

---

## 🔐 Demo Accounts — Try It Instantly

No sign-up needed. Use these credentials to explore both sides of the platform:

| Role | Email | Password | Access |
|------|-------|----------|--------|
| 🛡️ **Administrator** | `admin@kbic.in` | `admin123` | Full access: verify/reject reports, all analytics, user management |
| 👤 **Citizen** | `kalyani@kbic.in` | `kalyani123` | Submit field reports, leaderboard, profile, earn badges |

---

## ✨ Features at a Glance

| # | Feature | Description |
|---|---------|-------------|
| 🗺️ | **Interactive GIS Map** | Multi-layer Leaflet map with 20,000+ species observations, biodiversity hotspots, water bodies, threats, and protected areas |
| 📊 | **Live Dashboard** | Real-time KPI cards, Chart.js graphs, Biodiversity Health Score, species distribution donut chart |
| 📝 | **Citizen Science** | GPS-tagged field report submission with photo upload, AI species ID placeholder, gamified leaderboard with badges |
| 🛡️ | **Admin Verification** | Complete `Pending → Approved / Rejected` workflow with admin comments, timestamps, and reporter point awards |
| 🐦 | **Species Explorer** | 460+ species with search, IUCN filter, category chips, and a rich detail modal |
| 👁️ | **Observations** | 20,000+ field observations with date range, species, and location filters |
| 🌡️ | **NDVI Analytics** | Vegetation health monitoring with trend charts and map overlays |
| 💧 | **Water Monitoring** | Water body quality, biodiversity score, and pollution tracking |
| 🌲 | **Conservation Projects** | Project cards with status, budget, timelines, and priority map |
| 📚 | **Education Hub** | 460-entry searchable species education library |
| 🏆 | **Leaderboard** | Sortable, searchable, paginated community rankings with podium, role filters, and profile modals |
| 🌦️ | **Weather Integration** | Local weather and environmental context |
| 👤 | **User Profile** | Activity stats, badges earned, submitted reports, edit profile |
| 🔐 | **Secure Auth** | JWT + bcrypt, admin-only middleware, rate limiting, Helmet security headers |

---

## 🏗️ Project Architecture

```
Kopargaon-Biodiversity-Conservation-Portal/
│
├── backend/
│   ├── server.js               ← Express API — 45+ REST endpoints
│   ├── import-csv.js           ← CSV → SQLite data migration
│   ├── database.sqlite         ← Auto-generated SQLite DB (WAL mode)
│   └── uploads/                ← Citizen report image uploads
│
├── Frontend/
│   ├── index.html              ← Main dashboard (entry point)
│   ├── css/
│   │   ├── style.css           ← Global design system (dark, glassmorphism)
│   │   └── responsive.css      ← Mobile-first responsive breakpoints
│   ├── js/
│   │   ├── app.js              ← Routing, sidebar, global UI
│   │   ├── auth.js             ← JWT session management
│   │   ├── data-loader.js      ← API + CSV fetch abstraction
│   │   ├── analytics.js        ← Chart.js dashboard analytics
│   │   ├── gis-map.js          ← Leaflet GIS map controller
│   │   ├── citizen-reports.js  ← Full report submission & admin verification
│   │   ├── species.js          ← Species explorer & modal
│   │   ├── leaderboard.js      ← Interactive rankings & profile modals
│   │   ├── dashboard.js        ← KPI cards & live stats
│   │   ├── profile.js          ← User profile & badge display
│   │   ├── weather.js          ← Weather data integration
│   │   ├── ai-tracker.js       ← AI species ID module
│   │   ├── notifications.js    ← Toast notification system
│   │   └── ndvi.js             ← NDVI vegetation analytics
│   └── pages/                  ← 13 application views
│       ├── species.html
│       ├── observations.html
│       ├── citizen-reports.html
│       ├── gis-map.html
│       ├── threats.html
│       ├── water-bodies.html
│       ├── conservation.html
│       ├── education.html
│       ├── ndvi.html
│       ├── leaderboard.html
│       ├── profile.html
│       ├── analytics.html
│       └── weather.html
│
├── data/                       ← 17 raw biodiversity CSV datasets
│   ├── species_master.csv          (460 species)
│   ├── species_observations.csv   (20,000+ observations)
│   ├── citizen_reports.csv        (2,000+ field reports)
│   ├── conservation_projects.csv
│   ├── environmental_threats.csv
│   ├── water_bodies.csv
│   ├── educational_resources.csv
│   ├── ndvi_data.csv
│   ├── monthly_species_statistics.csv
│   ├── biodiversity_hotspots.csv
│   ├── habitats.csv
│   ├── villages.csv
│   ├── users.csv
│   └── ...
│
├── START.bat                   ← One-click Windows start script
├── package.json                ← Project metadata & npm scripts
└── requirements.txt            ← Dependency reference
```

---

## 🔌 API Reference

The backend exposes **45+ REST endpoints**. Key highlights:

### Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `POST` | `/api/auth/login` | ❌ | Login, receive JWT |
| `POST` | `/api/auth/register` | ❌ | Register new account |
| `GET`  | `/api/auth/me` | ✅ | Get current user info |

### Species & Observations
| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `GET`  | `/api/species` | ❌ | All species (pagination + filters) |
| `GET`  | `/api/species/:id` | ❌ | Single species detail |
| `GET`  | `/api/observations` | ❌ | Species observations |

### Citizen Reports (Verification Workflow)
| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `POST` | `/api/reports` | ✅ | Submit new report → auto `Pending` |
| `GET`  | `/api/reports/my` | ✅ | Logged-in user's own reports |
| `GET`  | `/api/reports/pending` | 🛡️ | All pending reports (admin only) |
| `PATCH`| `/api/reports/:id/verify` | 🛡️ | Approve report (+20 pts to reporter) |
| `PATCH`| `/api/reports/:id/reject` | 🛡️ | Reject with mandatory reason |
| `GET`  | `/api/admin/reports/stats` | 🛡️ | Total / pending / approved / rejected counts |
| `GET`  | `/api/admin/reports/:id` | 🛡️ | Full report detail for admin review |

### Dashboard & GIS
| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `GET`  | `/api/dashboard/stats` | ❌ | Global system KPIs |
| `GET`  | `/api/gis/hotspots` | ❌ | GeoJSON for map hotspots |
| `GET`  | `/api/gis/threats` | ❌ | GeoJSON for threat markers |

> **Legend:** ✅ = Authenticated user &nbsp;|&nbsp; 🛡️ = Admin only &nbsp;|&nbsp; ❌ = Public

---

## 🌍 UN Sustainable Development Goals Alignment

This platform was built with real-world impact in mind:

| SDG | Goal | How This Portal Helps |
|-----|------|-----------------------|
| 🌿 **SDG 15** | Life on Land | Comprehensive species, habitat, and biodiversity hotspot monitoring |
| 💧 **SDG 6** | Clean Water | Water body quality scores, biodiversity index, and pollution levels |
| 🌡️ **SDG 13** | Climate Action | Environmental threat logging, NDVI vegetation health trends |
| 📚 **SDG 4** | Quality Education | 460-species digital education hub with habitat and conservation data |
| 🤝 **SDG 17** | Partnerships | Citizen–scientist–admin collaboration through verified community reporting |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js 18+ |
| **API Framework** | Express 5.x |
| **Database** | SQLite 3 (WAL mode, no external server) |
| **Authentication** | JSON Web Tokens (JWT) + bcrypt |
| **Security** | Helmet, CORS, express-rate-limit |
| **File Uploads** | Multer |
| **Maps** | Leaflet.js (CDN) |
| **Charts** | Chart.js (CDN) |
| **Icons** | Font Awesome 6 (CDN) |
| **Fonts** | Google Fonts — Inter (CDN) |
| **Frontend** | Vanilla HTML + CSS + JavaScript (no framework, zero build step) |

---

## 💚 Why It Matters

Biodiversity data almost always stays locked away in reports that few people read. This project puts that data in the hands of the people who can act on it — turning everyday citizens into contributors, and turning raw observation counts into a clear, living picture of Kopargaon's natural world.

Every verified report on this platform is a data point that can inform a forest department decision, a conservation project proposal, or a school curriculum.

<div align="center">
  <br/>
  <b>🌿 Explore · Monitor · Conserve 🌿</b>
  <br/><br/>
  Made with ❤️ for the biodiversity of Kopargaon, Maharashtra
</div>