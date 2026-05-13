#!/usr/bin/env node
/**
 * Crawdad Web Server
 * Express + Handlebars web UI for meal planning
 * Proxies API calls to crawdad-backend
 */

const express = require('express');
const { engine } = require('express-handlebars');
const path = require('path');
const fs = require('fs');
const http = require('http');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const crawdad = require('./crawdad');

const app = express();
const PORT = process.env.PORT || 3000;
const API_BASE = process.env.API_BASE_URL || 'http://crawdad-backend:3001';
const DATA_DIR = path.join(__dirname, '..', 'data');
const CONFIG_DIR = path.join(__dirname, '..', 'config');

// ─── API Proxy ─────────────────────────────────────────────────────────────────
function createProxy(target) {
  return (req, res) => {
    const url = `${target}${req.originalUrl}`;
    const options = {
      method: req.method,
      headers: { 'Content-Type': 'application/json', ...req.headers },
    };

    const proxyReq = http.request(url, options, (proxyRes) => {
      let body = '';
      proxyRes.on('data', (chunk) => (body += chunk));
      proxyRes.on('end', () => {
        try {
          res.status(proxyRes.statusCode).json(JSON.parse(body));
        } catch {
          res.status(proxyRes.statusCode).send(body);
        }
      });
    });

    proxyReq.on('error', (err) => {
      res.status(502).json({ success: false, error: `Backend unavailable: ${err.message}` });
    });

    if (req.body && Object.keys(req.body).length > 0) {
      proxyReq.write(JSON.stringify(req.body));
    }
    proxyReq.end();
  };
}

// ─── Handlebars Setup ─────────────────────────────────────────────────────────
app.engine('hbs', engine({
  extname: '.hbs',
  defaultLayout: 'main',
  layoutsDir: path.join(__dirname, '..', 'views', 'layouts'),
  helpers: {
    eq: (a, b) => a === b,
    gt: (a, b) => a > b,
    lt: (a, b) => a < b,
    substring: (str, start, end) => str ? str.substring(start, end) : '',
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

// JSON body parser
app.use(express.json({ limit: '1mb' }));

// ─── Security Middleware ────────────────────────────────────────────────────────
app.use(helmet());

// API rate limiting: 100 requests per 15 minutes per IP
if (process.env.DISABLE_RATE_LIMIT !== 'true') {
  app.use('/api', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests, please try again later.' }
  }));
}

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

// ─── API Proxy Routes ─────────────────────────────────────────────────────────
app.get('/api/recipes',          createProxy(API_BASE));
app.get('/api/recipes/latest',   createProxy(API_BASE));
app.get('/api/recipes/meta/chefs', createProxy(API_BASE));
app.get('/api/recipes/:id',      createProxy(API_BASE));
app.post('/api/recipes',         createProxy(API_BASE));
app.post('/api/recipes/ingest',  createProxy(API_BASE));
app.delete('/api/recipes/:id',   createProxy(API_BASE));

// ─── Routes ───────────────────────────────────────────────────────────────────

// Home - This week's meal plan
app.get('/', async (req, res) => {
  const state = loadState();
  const config = loadConfig();
  
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
        day: d.getDate(),
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

app.get('/shopping', (req, res) => {
  const state = loadState();
  const config = loadConfig();
  
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
    activeChef: chefFilter,
    encodedChef: chefFilter ? encodeURIComponent(chefFilter) : ''
  });
});

app.get('/recipes/:id', (req, res) => {
  const state = loadState();
  const recipe = (state.recipes || []).find(r => r.id === req.params.id);
  
  if (!recipe) {
    return res.status(404).render('error', { title: 'Not Found', message: 'Recipe not found' });
  }
  
  res.render('recipe', { title: recipe.name, recipe });
});

app.get('/weather', async (req, res) => {
  const config = loadConfig();
  const forecast = await crawdad.fetchForecast(config.location.city, config.openweathermapApiKey);
  
  res.render('weather', { 
    title: 'Weather Forecast',
    location: config.location,
    forecast
  });
});

// ─── API endpoints (for AJAX) ──────────────────────────────────────────────────
app.get('/api/weather', async (req, res) => {
  try {
    const config = loadConfig();
    const forecast = await crawdad.fetchForecast(config.location.city, config.openweathermapApiKey);
    
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

app.post('/api/init', async (req, res) => {
  try {
    const config = loadConfig();
    const state = loadState();
    
    state.mealPlan = crawdad.generateYearMealPlan(new Date().getFullYear());
    state.recipes = crawdad.getDefaultRecipes();
    
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const weekKey = getWeekKey(today);
    state.shoppingLists[weekKey] = {
      weekOf: weekKey,
      generated: today.toISOString(),
      lists: crawdad.generateShoppingList(state.mealPlan, weekStart, weekEnd, config.stores)
    };
    
    fs.writeFileSync(path.join(DATA_DIR, 'state.json'), JSON.stringify(state, null, 2));
    
    res.json({ success: true, message: 'Initialized', mealPlanDays: Object.keys(state.mealPlan).length, recipes: state.recipes.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/daily', async (req, res) => {
  try {
    const state = loadState();
    const config = loadConfig();
    
    const today = new Date().toISOString().split('T')[0];
    state.mealPlan[today] = {
      date: today,
      meal: crawdad.selectMealByWeather({ condition: 'Clear', temp: '72°F' }),
      chef: config.cooks[Math.floor(Math.random() * config.cooks.length)]
    };
    
    fs.writeFileSync(path.join(DATA_DIR, 'state.json'), JSON.stringify(state, null, 2));
    
    res.json({ success: true, today: state.mealPlan[today] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/shopping', async (req, res) => {
  try {
    const state = loadState();
    const config = loadConfig();
    
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const weekKey = getWeekKey(today);
    state.shoppingLists[weekKey] = {
      weekOf: weekKey,
      generated: today.toISOString(),
      lists: crawdad.generateShoppingList(state.mealPlan, weekStart, weekEnd, config.stores)
    };
    
    fs.writeFileSync(path.join(DATA_DIR, 'state.json'), JSON.stringify(state, null, 2));
    
    res.json({ success: true, weekOf: weekKey });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/plan/week', async (req, res) => {
  try {
    const config = loadConfig();
    const state = loadState();
    const forecast = await crawdad.fetchForecast(config.location.city, config.openweathermapApiKey);
    
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    
    forecast.forEach(day => {
      const d = new Date(day.date);
      if (d >= weekStart && d <= new Date(weekStart.getTime() + 6 * 86400000)) {
        if (state.mealPlan[day.date]) {
          state.mealPlan[day.date].weather = day;
        }
      }
    });
    
    state.lastWeatherUpdate = new Date().toISOString();
    fs.writeFileSync(path.join(DATA_DIR, 'state.json'), JSON.stringify(state, null, 2));
    
    res.json({ success: true });
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
module.exports = app;

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🐊 Crawdad web server running at http://0.0.0.0:${PORT}`);
    console.log(`   API backend: ${API_BASE}`);
  });
}