# Crawdad 🐊 — Family Meal Planning System

Weather-aware weekly meal planning with smart shopping lists and recipe management for couples who take turns cooking.

## Live Demo

🌐 **https://meal.clawdexter.tech**

## Features

- **365-Day Meal Plan** — Full year of dinner planning with chef rotation
- **Weather Integration** — Auto-updates meal plan with forecasts (good nights for grilling, soup weather detection)
- **Smart Shopping Lists** — Organized by store (Schnucks/Costco/Aldi) and aisle
- **Recipe Catalog** — Track your go-to recipes by chef
- **Web UI** — Express + Handlebars frontend at `/`, `/calendar`, `/shopping`, `/recipes`, `/weather`
- **Docker-ready** — Deploys via Docker Compose with Traefik auto-discovery

## Quick Start

```bash
npm install
npm run init        # Generate 365-day meal plan
npm run weather     # Fetch weather forecast
npm run plan        # View this week's plan
npm run shopping    # Generate shopping list
npm run digest      # Morning/evening digest
npm run serve       # Start web UI on port 8080
```

## Configuration

Edit `config/config.json` or set environment variables:

```bash
# Location (defaults to St. Louis, MO)
export CITY_NAME="St. Louis"
export ZIP_CODE="63101"

# Weather APIs (wttr.in works without a key)
export WEATHER_API_KEY=       # Optional, for OpenWeatherMap

# Notion Integration (optional)
export NOTION_TOKEN=
export NOTION_MEAL_PLAN_DB=
export NOTION_RECIPE_DB=
export NOTION_SHOPPING_LIST_DB=
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run init` | Generate meal plan + shopping list for the current week |
| `npm run weather` | Fetch 7-day weather and update meal plan |
| `npm run plan` | Show this week's meal plan with chef assignments |
| `npm run shopping` | Generate shopping list sorted by store + aisle |
| `npm run digest` | Generate morning/evening digest |
| `npm run serve` | Start web UI (http://localhost:8080) |

## Deployment (Docker + Traefik)

This app is designed to run in Docker, auto-discovered by Traefik reverse proxy.

### 1. Docker Manager (Hostinger)
In Hostinger VPS → Docker Manager → Compose → New Project:
- Connect GitHub: `https://github.com/johrenberger/FamilyPlanning`
- Branch: `master`
- Docker Compose file auto-detected

### 2. Manual Deploy
```bash
git clone https://github.com/johrenberger/FamilyPlanning.git
cd FamilyPlanning
docker compose up -d
```

### 3. Traefik Configuration
The `docker-compose.yml` includes Traefik labels for auto-discovery:
- Route: `meal.clawdexter.tech` → crawdad container
- Network: `traefik-jsq2_default`
- TLS: automatic via Traefik letsencrypt

After deploying, restart Traefik to pick up new route:
```bash
docker exec traefik-jsq2 traefik reload
```

## Web Endpoints

| Route | Description |
|-------|-------------|
| `/` | This week's meal plan with weather |
| `/calendar` | Full year calendar view |
| `/shopping` | Shopping list by store + aisle |
| `/recipes` | Recipe catalog (filter by chef) |
| `/recipes/:id` | Single recipe detail |
| `/weather` | 7-day weather forecast |

## Project Structure

```
FamilyPlanning/
├── config/              # Configuration (stores, location, etc.)
├── data/                # Meal plan, recipes, shopping lists
├── lib/
│   ├── crawdad.js      # Core CLI logic
│   └── server.js       # Express web server
├── public/css/          # Stylesheets
├── views/               # Handlebars templates
├── Dockerfile
├── docker-compose.yml   # Traefik-enabled deployment
└── README.md
```

## License

MIT — Happy meal planning! 🍽️