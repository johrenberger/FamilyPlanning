# Crawdad 🐊 — Family Meal Planning System

Weather-aware weekly meal planning with smart shopping lists and recipe management for couples who take turns cooking.

## Features

- **365-Day Meal Plan** — Full year of dinner planning with chef rotation
- **Weather Integration** — Auto-updates meal plan with forecasts (good nights for grilling, soup weather detection)
- **Smart Shopping Lists** — Organized by store (Kroger/Costco/Trader Joe's) and aisle
- **Recipe Catalog** — Track your go-to recipes by chef
- **Morning/Evening Digests** — Automated reminders for dinner planning and grocery runs
- **Notion Sync** (optional) — Keep your meal plan in Notion for the family

## Quick Start

```bash
npm install
npm run init        # Generate 365-day meal plan
npm run weather     # Fetch weather forecast
npm run plan        # View this week's plan
npm run shopping    # Generate shopping list
npm run digest      # Morning/evening digest
```

## Configuration

Edit `config/config.json` or set environment variables:

```bash
# Location (defaults to Atlanta, GA)
export CITY_NAME="Atlanta"
export ZIP_CODE="30301"

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
| `npm run daily` | Run weather update + digest together |

## Workflow

1. **Sunday**: Run `npm run init` to generate the week's shopping list
2. **Daily (optional)**: Run `npm run weather` to get updated forecasts
3. **Morning/Evening**: Run `npm run digest` for a quick status check

### Automating with Cron

```bash
# Weather update every morning at 6 AM
0 6 * * * cd /path/to/FamilyPlanning && npm run weather >> /var/log/crawdad.log 2>&1

# Digest every evening at 5 PM
0 17 * * * cd /path/to/FamilyPlanning && npm run digest >> /var/log/crawdad.log 2>&1
```

## Project Structure

```
FamilyPlanning/
├── config/
│   └── config.json       # Your configuration
├── data/
│   ├── state.json        # Meal plan, recipes, shopping lists
│   └── digest.txt        # Latest digest output
├── lib/
│   └── crawdad.js        # Main application
├── package.json
└── README.md
```

## License

MIT — Happy meal planning! 🍽️