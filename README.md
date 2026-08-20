# Filament Tracker

A self-hosted web application for managing 3D printing filament inventory, with live Bambu Lab printer integration via MQTT.

## Features

- **Inventory management** — track filament types, brands, colors, materials, and print settings
- **Spool tracking** — log individual spools with remaining weight, purchase price, NFC tag UID, and location
- **Bambu Lab integration** — connect to Bambu Lab printers over MQTT/TLS; live status updates pushed to the browser via WebSocket
- **AMS slot sync** — automatically reads AMS tray data (material, color, remain %, humidity, temperature) from the printer and matches spools by NFC tag UID
- **Print job log** — auto-records jobs when a print starts and updates them on completion, failure, or cancellation; remaining spool weight is updated from AMS data in real time
- **Usage calculator** — estimate filament cost and weight for a print job using material density, hourly rate, and VAT settings
- **Brands management** — pre-seeded list of popular brands, fully editable
- **CSV import** — bulk-import filaments from a CSV file
- **MQTT relay** — optional built-in MQTT broker that re-publishes printer status to local clients (e.g. Home Assistant)
- **Multi-user auth** — JWT-based login with admin/user roles
- **Settings page** — configure currency, low-stock threshold, hourly print rate, VAT, and MQTT relay

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router v6, Vite |
| Backend | Node.js 20, Express, WebSocket (`ws`) |
| Database | SQLite via Node.js built-in `node:sqlite` (no native addon) |
| Printer comms | MQTT over TLS (`mqtts://`, port 8883) using the `mqtt` package |
| MQTT relay | `aedes` embedded broker |
| Auth | `jsonwebtoken` + `bcryptjs`, HTTP-only cookie session |
| Container | Docker / Docker Compose |

## Requirements

- **Docker** (recommended) — Docker Engine 24+ and Docker Compose v2  
  OR  
- **Node.js 22.5+** (the built-in `node:sqlite` module requires Node 22.5 or later)
- A Bambu Lab printer reachable on the local network (optional — app works without a printer)
- Network access from the host to the printer on **port 8883** (MQTT/TLS)

## Quick start with Docker

```bash
git clone https://github.com/FuzzyBootsDK/Filament-Tracker-React.git
cd Filament-Tracker-React
```

Edit `docker-compose.yml` and set a strong `JWT_SECRET`:

```yaml
environment:
  JWT_SECRET: "your-random-secret-here"
```

Then start:

```bash
docker compose up -d
```

Open [http://localhost:3001](http://localhost:3001) in a browser.

On first launch, create an account via the login page — the first registered user becomes admin.

> **Network note:** `docker-compose.yml` defaults to `network_mode: host` so the backend can reach Bambu printers on your LAN. If your Docker host is Linux this works out of the box. On macOS/Windows host-networking is not supported by Docker Desktop; see the inline comment in `docker-compose.yml` for the `extra_hosts` alternative.

## Manual (dev) setup

### 1. Install dependencies

```bash
# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 2. Start both servers

```bash
# From the project root
./start-dev.sh
```

Or start them separately:

```bash
# Terminal 1 — backend (port 3001)
cd backend && node src/index.js

# Terminal 2 — frontend dev server (port 5173)
cd frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### 3. Build for production (without Docker)

```bash
cd frontend && npm run build
# Built files land in frontend/dist/

# Copy to backend public folder
cp -r frontend/dist ../backend/public
```

Then run `node src/index.js` in the `backend` directory with `NODE_ENV=production`.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | HTTP port for the backend |
| `DATA_DIR` | `./data` | Directory where `filament.db` is stored |
| `JWT_SECRET` | *(required)* | Secret used to sign JWT tokens |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed CORS origin (set to your domain in production) |
| `NODE_ENV` | `development` | Set to `production` to serve the built frontend |

## Adding a Bambu Lab printer

1. Open **Settings** in the app.
2. Enter the printer's **IP address**, **Access Code** (shown in the printer's LAN mode settings), and **Serial Number**.
3. Save — the backend connects immediately over MQTT/TLS and begins streaming status.

The serial number and access code can be found in the printer's touchscreen under **Settings → Network → LAN Only Mode** or in Bambu Studio.

## MQTT relay

When enabled in **Settings → MQTT Relay**, the app starts an embedded MQTT broker on port `1883`. It re-publishes all printer status messages on topics:

```
tracker/printer/<serial_number>
```

This lets other local services (e.g. Home Assistant, Node-RED) subscribe to live printer data without connecting directly to the printer.

## Data persistence

All data is stored in a single SQLite file at `DATA_DIR/filament.db`. In the Docker setup this is bind-mounted from `./data/` on the host — back it up by copying that file.

## Project structure

```
.
├── backend/
│   └── src/
│       ├── db/           # SQLite schema, migrations, seed data
│       ├── middleware/    # JWT auth middleware
│       ├── routes/        # REST API endpoints
│       └── services/      # MQTT client, AMS sync, MQTT relay broker
├── frontend/
│   └── src/
│       ├── components/    # Shared UI components and layout
│       ├── context/       # Auth and printer React contexts
│       └── pages/         # Inventory, Spools, Calculator, Printer, AMS, Log, Settings
├── data/                  # SQLite database (git-ignored)
├── Dockerfile
├── docker-compose.yml
└── start-dev.sh
```

## License

MIT
