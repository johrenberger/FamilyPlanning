#!/usr/bin/env node
/**
 * Crawdad Web Server
 * Express + Handlebars web UI for meal planning
 */

const express = require('express');
const { engine } = require('express-handlebars');
const path = require('path');
const fs = require('fs');
const https = require('https');

const crawdad = require('./crawdad');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, '..', 'data');
const CONFIG_DIR = path.join(__dirname, '..', 'config');

// ─── Handlebars Setup ─────────────────────────────────────────────────────────
app.engine('hbs', engine({
  extname: '.hbs',
  defaultLayout: 'main',
  layoutsDir: path.join(__dirname, '..', 'views', 'layouts'),
  helpers: {
    eq: (a, b) => a === b,
    gt: (a, b) => a > b,
    lt: (a, b) => a < b,
    formatDate: (date) => new Date(date).toLocaleDateString('en-US', { 
      weekday: 'long', month: 'long', day: 'numeric' 
    }),
    shortDate: (date) => new Date(date).toLocaleDateString('en-US', { 
      weekday: 'short', month: 'short', day: 'numeric' 
    }),
   天气: (condition) => {
      const icons = {
        'Sunny': '☀️', 'Clear': '🌙', 'Partly Cloudy': '⛅', 'Cloudy': '☁️',
        'Rain': '🌧️', 'Thunderstorm': '⛈️', 'Snow': '❄️', 'Fog': '🌫️'
      };
      return icons[condition] || '📅';
    },
    grillIcon: (weather) => weather?.goodForGrilling ? '🔥' : '',
    soupIcon: (weather) => weather?.goodForSoup ? '🍜' : '',
    storeIcon: (store) => {
      const icons = { 'Schnucks': '🏪', 'Costco': '🛒', 'Aldi': '🏬' };
      return icons[store] || '🛍️';
    }
  }
}));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, '..', 'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// ─── Data Loading Helpers ─────────────────────────────────────────────────────
function loadState() {
  const stateFile = path.join(DATA_DIR, 'state.json');
  if (fs.existsSync(stateFile)) {
    return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  }
  return { mealPlan: {}, recipes: [], shoppingLists: {} };
}

function loadConfig() {
  const configFile = path.join(CONFIG_DIR, 'config.json');
  if (fs.existsSync(configFile)) {
    return JSON.parse(fs.readFileSync(configFile, 'utf8'));
  }
  return { location: { city: 'St. Louis', state: 'MO' }, stores: [], cooks: ['You', 'Wife'] };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// Home - This week's meal plan
app.get('/', async (req, res) => {
  const state = loadState();
  const config = loadConfig();
  
  // Get current week
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    weekDays.push({
      date: dateStr,
      ...state.mealPlan[dateStr],
      isToday: dateStr === today.toISOString().split('T')[0]
    });
  }
  
  // Weather summary
  const weatherSummary = weekDays.filter(d => d.weather).map(d => ({
    date: d.date,
    temp: d.weather.temp,
    condition: d.weather.condition
  }));

  res.render('home', { 
    title: 'Meal Plan',
    weekDays,
    weatherSummary,
    location: config.location,
    cooks: config.cooks
  });
});

// Full year calendar view
app.get('/calendar', (req, res) => {
  const state = loadState();
  const config = loadConfig();
  const year = new Date().getFullYear();
  
  const months = [];
  for (let m = 0; m < 12; m++) {
    const monthStart = new Date(year, m, 1);
    const monthEnd = new Date(year, m + 1, 0);
    
    const days = [];
    for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      days.push({
        date: dateStr,
        ...state.mealPlan[dateStr]
      });
    }
    
    months.push({
      name: monthStart.toLocaleDateString('en-US', { month: 'long' }),
      days
    });
  }
  
  res.render('calendar', { 
    title: 'Year Calendar',
    year,
    months,
    location: config.location
  });
});

// Shopping list
app.get('/shopping', (req, res) => {
  const state = loadState();
  const config = loadConfig();
  
  // Get current week's shopping list
  const today = new Date();
  const weekKey = getWeekKey(today);
  const weekList = state.shoppingLists[weekKey]?.lists || generateEmptyLists(config.stores);
  
  res.render('shopping', { 
    title: 'Shopping List',
    weekOf: state.shoppingLists[weekKey]?.weekOf || weekKey,
    lists: weekList,
    stores: config.stores
  });
});

// Recipes
app.get('/recipes', (req, res) => {
  const state = loadState();
  
  const chefFilter = req.query.chef;
  let recipes = state.recipes || [];
  
  if (chefFilter) {
    recipes = recipes.filter(r => r.chef === chefFilter);
  }
  
  res.render('recipes', { 
    title: 'Recipe Book',
    recipes,
    chefs: [...new Set((state.recipes || []).map(r => r.chef))],
    activeChef: chefFilter
  });
});

// Single recipe
app.get('/recipes/:id', (req, res) => {
  const state = loadState();
  const recipe = (state.recipes || []).find(r => r.id === req.params.id);
  
  if (!recipe) {
    return res.status(404).render('error', { title: 'Not Found', message: 'Recipe not found' });
  }
  
  res.render('recipe', { title: recipe.name, recipe });
});

// Weather forecast
app.get('/weather', async (req, res) => {
  const config = loadConfig();
  const forecast = await crawdad.fetchForecast(config.location.city, config.openweathermapApiKey);
  
  res.render('weather', { 
    title: 'Weather Forecast',
    location: config.location,
    forecast
  });
});

// API endpoints (for AJAX)
app.get('/api/weather', async (req, res) => {
  try {
    const config = loadConfig();
    const forecast = await crawdad.fetchForecast(config.location.city, config.openweathermapApiKey);
    
    // Update state with new weather
    const state = loadState();
    forecast.forEach(day => {
      if (state.mealPlan[day.date]) {
        state.mealPlan[day.date].weather = day;
      }
    });
    state.lastWeatherUpdate = new Date().toISOString();
    fs.writeFileSync(path.join(DATA_DIR, 'state.json'), JSON.stringify(state, null, 2));
    
    res.json({ success: true, forecast });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/plan/week', (req, res) => {
  const state = loadState();
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    weekDays.push({
      date: dateStr,
      ...state.mealPlan[dateStr]
    });
  }
  
  res.json(weekDays);
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getWeekKey(date) {
  const d = new Date(date);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((d - yearStart) / 86400000 + yearStart.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
}

function generateEmptyLists(stores) {
  const lists = {};
  stores.forEach(store => {
    lists[store.name] = { store: store.name, aisles: {} };
    store.aisles.forEach(aisle => {
      lists[store.name].aisles[aisle] = [];
    });
  });
  return lists;
}

// ─── Start Server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🐊 Crawdad web server running at http://localhost:${PORT}`);
  console.log(`   Press Ctrl+C to stop`);
});