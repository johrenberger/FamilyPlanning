#!/usr/bin/env node
/**
 * Crawdad - Weekly Meal Planning System
 * Weather-aware scheduling, smart shopping lists, recipe management
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CONFIG_DIR = path.join(__dirname, '..', 'config');

// Ensure directories exist
['data', 'lib', 'config'].forEach(dir => {
  const fullPath = path.join(__dirname, '..', dir);
  if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
});

// ─── Config ───────────────────────────────────────────────────────────────────
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const STATE_FILE = path.join(DATA_DIR, 'state.json');

function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  }
  return {
    location: { city: 'St. Louis', state: 'MO', zip: '63101' },
    stores: [
      { name: 'Schnucks', aisles: ['Produce', 'Deli', 'Dairy', 'Meat', 'Bakery', 'Frozen', 'Pantry', 'Beverages', 'Snacks', 'Cleaning'] },
      { name: 'Costco', aisles: ['Produce', 'Deli', 'Dairy', 'Meat', 'Bakery', 'Frozen', 'Pantry', 'Electronics', 'Home'] },
      { name: "Aldi", aisles: ['Produce', 'Deli', 'Dairy', 'Wine', 'Frozen', 'Pantry', 'Snacks'] }
    ],
    cooks: ['You', 'Wife'],
    rotationWeeks: 2,
    weatherApiKey: process.env.WEATHER_API_KEY || '',
    openweathermapApiKey: process.env.OPENWEATHERMAP_API_KEY || '',
    notionToken: process.env.NOTION_TOKEN || '',
    notionMealPlanDatabase: process.env.NOTION_MEAL_PLAN_DB || '',
    notionRecipeDatabase: process.env.NOTION_RECIPE_DB || '',
    notionShoppingListDatabase: process.env.NOTION_SHOPPING_LIST_DB || ''
  };
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  }
  return {
    mealPlan: {},
    recipes: [],
    shoppingLists: {},
    lastDigest: null,
    lastWeatherUpdate: null
  };
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ─── Weather ──────────────────────────────────────────────────────────────────
async function fetchWeather(city, apiKey) {
  if (!apiKey) {
    // Fallback to wttr.in (no API key needed)
    return new Promise((resolve) => {
      const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1`;
      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            const current = json.current_condition[0];
            resolve({
              temp: current.temp_F + '°F',
              condition: current.weatherDesc[0].value,
              humidity: current.humidity + '%',
              rain: parseFloat(current.precipMM) > 0,
              chanceOfRain: parseFloat(current.precipMM) > 0 || current.humidity > 80
            });
          } catch (e) {
            resolve({ temp: '72°F', condition: 'Clear', humidity: '50%', rain: false, chanceOfRain: false });
          }
        });
      }).on('error', () => {
        resolve({ temp: '72°F', condition: 'Clear', humidity: '50%', rain: false, chanceOfRain: false });
      });
    });
  }
  
  return new Promise((resolve) => {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=imperial`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({
            temp: Math.round(json.main.temp) + '°F',
            condition: json.weather[0].main,
            humidity: json.main.humidity + '%',
            rain: json.weather[0].main.toLowerCase().includes('rain'),
            chanceOfRain: json.pop > 0.3
          });
        } catch (e) {
          resolve({ temp: '72°F', condition: 'Clear', humidity: '50%', rain: false, chanceOfRain: false });
        }
      });
    }).on('error', () => {
      resolve({ temp: '72°F', condition: 'Clear', humidity: '50%', rain: false, chanceOfRain: false });
    });
  });
}

async function fetchForecast(city, apiKey, days = 7) {
  if (!apiKey) {
    return new Promise((resolve) => {
      const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1`;
      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            const forecast = json.weather.slice(0, days).map(day => {
              const hourlySummary = day.hourly && day.hourly[4] ? day.hourly[4].weatherDesc[0].value : day.avgtempC + '°C';
              return {
                date: day.date,
                high: day.maxtempF + '°F',
                low: day.mintempF + '°F',
                condition: hourlySummary,
                goodForGrilling: !hourlySummary.toLowerCase().includes('rain') && parseInt(day.maxtempF) > 60 && parseInt(day.maxtempF) < 95,
                goodForSoup: parseInt(day.mintempF) < 55
              };
            });
            resolve(forecast);
          } catch (e) {
            console.error('Forecast parse error:', e.message);
            resolve(generateMockForecast(days));
          }
        });
      }).on('error', () => resolve(generateMockForecast(days)));
    });
  }
  
  return generateMockForecast(days);
}

function generateMockForecast(days) {
  const conditions = ['Sunny', 'Partly Cloudy', 'Cloudy', 'Rain', 'Clear'];
  const forecasts = [];
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const tempHigh = 65 + Math.floor(Math.random() * 25);
    const tempLow = tempHigh - 15 - Math.floor(Math.random() * 10);
    const condition = conditions[Math.floor(Math.random() * conditions.length)];
    forecasts.push({
      date: date.toISOString().split('T')[0],
      high: tempHigh + '°F',
      low: tempLow + '°F',
      condition,
      goodForGrilling: !condition.includes('Rain') && tempHigh > 60 && tempHigh < 95,
      goodForSoup: tempLow < 55
    });
  }
  return forecasts;
}

// ─── Meal Planner ─────────────────────────────────────────────────────────────
function generateYearMealPlan(year = 2026) {
  const plan = {};
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);
  
  const defaultMeals = [
    { name: 'Grilled Chicken', type: 'grill', chef: 'You', ingredients: ['chicken breast', 'olive oil', 'garlic', 'rosemary', 'lemon'] },
    { name: 'Beef Stir Fry', type: 'stir-fry', chef: 'Wife', ingredients: ['beef sirloin', 'broccoli', 'bell pepper', 'soy sauce', 'ginger'] },
    { name: 'Slow Cooker Pulled Pork', type: 'slow-cooker', chef: 'You', ingredients: ['pork shoulder', 'bbq sauce', 'apple cider vinegar', 'onion'] },
    { name: 'Pasta Primavera', type: 'vegetarian', chef: 'Wife', ingredients: ['penne pasta', 'zucchini', 'bell pepper', 'parmesan', 'olive oil'] },
    { name: 'Fish Tacos', type: 'grill', chef: 'You', ingredients: ['white fish', 'corn tortillas', 'cabbage', 'lime', 'cilantro'] },
    { name: 'Homemade Pizza Night', type: 'oven', chef: 'Wife', ingredients: ['pizza dough', 'marinara', 'mozzarella', 'pepperoni', 'mushrooms'] },
    { name: 'Grilled Burgers', type: 'grill', chef: 'You', ingredients: ['ground beef', 'buns', 'lettuce', 'tomato', 'cheese'] },
    { name: 'Chicken Tortilla Soup', type: 'soup', chef: 'Wife', ingredients: ['chicken breast', 'tortilla chips', 'black beans', 'tomatoes', 'avocado'] },
    { name: 'Grilled Salmon', type: 'grill', chef: 'You', ingredients: ['salmon fillet', 'lemon', 'dill', 'olive oil', 'garlic'] },
    { name: 'Beef Tacos', type: 'oven', chef: 'Wife', ingredients: ['ground beef', 'taco seasoning', 'tortillas', 'cheese', 'lettuce'] },
    { name: 'BBQ Baby Back Ribs', type: 'grill', chef: 'You', ingredients: ['pork ribs', 'bbq rub', 'bbq sauce', 'apple juice'] },
    { name: 'Shrimp Scampi', type: 'stovetop', chef: 'Wife', ingredients: ['shrimp', 'linguine', 'garlic', 'white wine', 'butter'] },
    { name: 'Grilled Steaks', type: 'grill', chef: 'You', ingredients: ['ribeye steaks', 'butter', 'thyme', 'garlic'] },
    { name: 'Vegetable Curry', type: 'stovetop', chef: 'Wife', ingredients: ['coconut milk', 'curry paste', 'chickpeas', 'potato', 'spinach'] }
  ];
  
  let mealIndex = 0;
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const dayOfWeek = d.getDay();
    
    // Weekend gets premium grilling
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      const grillMeals = defaultMeals.filter(m => m.type === 'grill');
      const meal = grillMeals[mealIndex % grillMeals.length];
      plan[dateStr] = {
        date: dateStr,
        dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek],
        meal: meal.name,
        type: meal.type,
        chef: meal.chef,
        ingredients: meal.ingredients,
        weather: null,
        notes: ''
      };
      mealIndex++;
    } else {
      const regularMeals = defaultMeals.filter(m => m.type !== 'grill');
      const meal = regularMeals[mealIndex % regularMeals.length];
      plan[dateStr] = {
        date: dateStr,
        dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek],
        meal: meal.name,
        type: meal.type,
        chef: meal.chef,
        ingredients: meal.ingredients,
        weather: null,
        notes: ''
      };
      mealIndex++;
    }
  }
  
  return plan;
}

// ─── Shopping List Generator ──────────────────────────────────────────────────
function generateShoppingList(mealPlan, startDate, endDate, stores) {
  const ingredients = {};
  
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const day = mealPlan[dateStr];
    if (day && day.ingredients) {
      day.ingredients.forEach(ing => {
        if (!ingredients[ing]) ingredients[ing] = { items: [], stores: [] };
        ingredients[ing].items.push({ date: dateStr, meal: day.meal });
        // Assign to appropriate store based on category
        const store = getStoreForIngredient(ing, stores);
        if (!ingredients[ing].stores.includes(store)) {
          ingredients[ing].stores.push(store);
        }
      });
    }
  }
  
  // Sort by store then aisle
  const byStore = {};
  stores.forEach(store => {
    byStore[store.name] = { store: store.name, aisles: {} };
    store.aisles.forEach(aisle => {
      byStore[store.name].aisles[aisle] = [];
    });
  });
  
  // Categorize ingredients into aisles
  Object.entries(ingredients).forEach(([ing, data]) => {
    const aisle = getAisleForIngredient(ing);
    data.stores.forEach(storeName => {
      if (byStore[storeName]) {
        if (!byStore[storeName].aisles[aisle]) {
          byStore[storeName].aisles[aisle] = [];
        }
        byStore[storeName].aisles[aisle].push({
          ingredient: ing,
          quantity: data.items.length,
          meals: data.items.map(i => i.meal).join(', ')
        });
      }
    });
  });
  
  return byStore;
}

function getStoreForIngredient(ingredient, stores) {
  const highCost = ['ribeye', 'salmon', 'shrimp', 'pork ribs'];
  const bulk = ['pasta', 'rice', 'beans', 'sauce', 'tortilla'];
  const organic = ['spinach', 'avocado', 'berries'];
  
  const ing = ingredient.toLowerCase();
  
  if (highCost.some(i => ing.includes(i))) return stores[1]?.name || 'Costco';
  if (bulk.some(i => ing.includes(i))) return stores[1]?.name || 'Costco';
  if (organic.some(i => ing.includes(i))) return stores[2]?.name || "Aldi";
  return stores[0]?.name || 'Schnucks';
}

function getAisleForIngredient(ingredient) {
  const categories = {
    'Produce': ['lettuce', 'tomato', 'onion', 'pepper', 'broccoli', 'zucchini', 'cabbage', 'avocado', 'lemon', 'lime', 'garlic', 'ginger', 'cilantro', 'dill', 'rosemary', 'thyme', 'potato', 'spinach'],
    'Deli': ['deli', 'cheese', 'bacon'],
    'Dairy': ['milk', 'butter', 'cream', 'yogurt', 'parmesan', 'mozzarella'],
    'Meat': ['chicken', 'beef', 'pork', 'fish', 'shrimp', 'ribs', 'ground'],
    'Bakery': ['buns', 'bread', 'tortilla chips', 'pizza dough'],
    'Frozen': ['frozen'],
    'Pantry': ['pasta', 'rice', 'beans', 'oil', 'sauce', 'seasoning', 'bbq', 'vinegar', 'coconut', 'curry', 'wine', 'juice'],
    'Beverages': ['wine', 'juice'],
    'Snacks': ['chips', 'crackers'],
    'Cleaning': []
  };
  
  const ing = ingredient.toLowerCase();
  for (const [aisle, items] of Object.entries(categories)) {
    if (items.some(i => ing.includes(i))) return aisle;
  }
  return 'Pantry';
}

// ─── Recipe Catalog ───────────────────────────────────────────────────────────
function getDefaultRecipes() {
  return [
    {
      id: '1',
      name: 'Grilled Chicken with Rosemary',
      chef: 'You',
      type: 'grill',
      prepTime: '15 min',
      cookTime: '20 min',
      servings: 4,
      ingredients: ['4 chicken breasts', '3 tbsp olive oil', '4 cloves garlic, minced', '2 tbsp fresh rosemary', '1 lemon, juiced', 'Salt and pepper'],
      instructions: 'Mix olive oil, garlic, rosemary, and lemon juice. Marinate chicken for 30 min. Grill over medium-high heat 6-8 min per side until internal temp reaches 165°F.',
      tags: ['quick', 'healthy', 'grilling'],
      servingsHistory: []
    },
    {
      id: '2',
      name: 'Beef Stir Fry',
      chef: 'Wife',
      type: 'stir-fry',
      prepTime: '20 min',
      cookTime: '15 min',
      servings: 4,
      ingredients: ['1 lb beef sirloin, sliced thin', '2 cups broccoli florets', '1 bell pepper, sliced', '3 tbsp soy sauce', '1 tbsp fresh ginger, minced', '2 cloves garlic', '2 tbsp vegetable oil'],
      instructions: 'Heat oil in wok over high heat. Sear beef quickly, remove. Add vegetables, stir fry 3-4 min. Return beef, add soy sauce and ginger. Serve over rice.',
      tags: ['quick', 'asian', 'healthy'],
      servingsHistory: []
    },
    {
      id: '3',
      name: 'Slow Cooker Pulled Pork',
      chef: 'You',
      type: 'slow-cooker',
      prepTime: '10 min',
      cookTime: '8 hours',
      servings: 8,
      ingredients: ['4 lb pork shoulder', '1 cup bbq sauce', '1/2 cup apple cider vinegar', '1 large onion, diced', '2 tbsp brown sugar', '1 tbsp paprika', 'Salt and pepper'],
      instructions: 'Season pork with paprika, salt, pepper. Place in slow cooker with onion, vinegar, and 1/2 cup water. Cook on low 8 hours. Shred with forks, mix with bbq sauce.',
      tags: ['easy', 'batch-cooking', 'bbq'],
      servingsHistory: []
    },
    {
      id: '4',
      name: 'Pasta Primavera',
      chef: 'Wife',
      type: 'vegetarian',
      prepTime: '15 min',
      cookTime: '20 min',
      servings: 4,
      ingredients: ['1 lb penne pasta', '2 medium zucchini, diced', '1 red bell pepper, diced', '1/2 cup parmesan cheese, grated', '1/4 cup olive oil', '3 cloves garlic', 'Fresh basil'],
      instructions: 'Cook pasta al dente. Sauté garlic in olive oil, add vegetables, cook 5-7 min. Toss with pasta, parmesan, and basil. Season to taste.',
      tags: ['vegetarian', 'pasta', 'summer'],
      servingsHistory: []
    },
    {
      id: '5',
      name: 'Fish Tacos',
      chef: 'You',
      type: 'grill',
      prepTime: '20 min',
      cookTime: '10 min',
      servings: 4,
      ingredients: ['1 lb white fish (tilapia or cod)', '8 corn tortillas', '2 cups cabbage, shredded', '1 avocado, sliced', '2 limes', '1/4 cup cilantro', '1 tsp cumin', 'Sour cream'],
      instructions: 'Season fish with cumin, salt, pepper. Grill 3-4 min per side. flake into chunks. Warm tortillas, fill with fish, cabbage, avocado, cilantro, lime juice, and sour cream.',
      tags: ['grilling', 'seafood', 'mexican'],
      servingsHistory: []
    },
    {
      id: '6',
      name: 'Homemade Pizza',
      chef: 'Wife',
      type: 'oven',
      prepTime: '30 min',
      cookTime: '15 min',
      servings: 4,
      ingredients: ['1 lb pizza dough', '1/2 cup marinara sauce', '8 oz mozzarella, shredded', '4 oz pepperoni', '8 oz mushrooms, sliced', '1 tsp Italian seasoning'],
      instructions: 'Preheat oven to 475°F. Stretch dough into 12" circle. Spread sauce, top with cheese, pepperoni, mushrooms. Bake 12-15 min until crust is golden and cheese is bubbly.',
      tags: ['family-favorite', 'pizza-night'],
      servingsHistory: []
    }
  ];
}

// ─── Digest Generator ─────────────────────────────────────────────────────────
function generateDigest(state, config) {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const todayStr = today.toISOString().split('T')[0];
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  
  const todayMeal = state.mealPlan[todayStr];
  const tomorrowMeal = state.mealPlan[tomorrowStr];
  
  let digest = `🍽️ **Meal Plan Digest - ${today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}**\n\n`;
  
  digest += `**TODAY - ${todayMeal?.dayOfWeek || 'Today'}**\n`;
  if (todayMeal) {
    digest += `• ${todayMeal.meal} (${todayMeal.chef})\n`;
    if (todayMeal.weather) {
      digest += `  Weather: ${todayMeal.weather.temp}, ${todayMeal.weather.condition}\n`;
    }
  } else {
    digest += `• No meal planned\n`;
  }
  
  digest += `\n**TOMORROW - ${tomorrowMeal?.dayOfWeek || 'Tomorrow'}**\n`;
  if (tomorrowMeal) {
    digest += `• ${tomorrowMeal.meal} (${tomorrowMeal.chef})\n`;
    if (tomorrowMeal.weather) {
      digest += `  Weather: ${tomorrowMeal.weather.temp}, ${tomorrowMeal.weather.condition}\n`;
    }
    if (tomorrowMeal.type === 'grill' && tomorrowMeal.weather?.goodForGrilling) {
      digest += `  🌡️ Great grilling weather!\n`;
    }
    if (tomorrowMeal.type === 'soup' && tomorrowMeal.weather?.goodForSoup) {
      digest += `  🍜 Perfect soup weather!\n`;
    }
  } else {
    digest += `• No meal planned\n`;
  }
  
  // Check if shopping needed
  const needsShopping = Object.values(state.shoppingLists).some(list => {
    return list.weekOf === getWeekOf(todayStr);
  });
  
  if (!needsShopping) {
    digest += `\n🛒 **Shopping Reminder**: You may want to plan this week's shopping list!\n`;
  }
  
  return digest;
}

function getWeekOf(dateStr) {
  const d = new Date(dateStr);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((d - yearStart) / 86400000 + yearStart.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
}

// ─── Notion Integration (if token provided) ───────────────────────────────────
async function syncToNotion(state, config) {
  if (!config.notionToken || !config.notionMealPlanDatabase) {
    return { success: false, reason: 'Notion not configured' };
  }
  
  // Notion API integration would go here
  // For now, return placeholder
  return { success: true, synced: 0 };
}

// ─── CLI Modes ────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const mode = args.find(a => a.startsWith('--mode='))?.split('=')[1] || 'start';
  
  const config = loadConfig();
  const state = loadState();
  
  switch (mode) {
    case 'init': {
      console.log('🛠️ Initializing Crawdad Meal Planner...\n');
      
      // Generate meal plan
      state.mealPlan = generateYearMealPlan(new Date().getFullYear());
      
      // Initialize recipes
      state.recipes = getDefaultRecipes();
      
      // Generate shopping lists for current week
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      state.shoppingLists[getWeekOf(today.toISOString().split('T')[0])] = {
        weekOf: getWeekOf(today.toISOString().split('T')[0]),
        generated: today.toISOString(),
        lists: generateShoppingList(state.mealPlan, weekStart, weekEnd, config.stores)
      };
      
      saveState(state);
      console.log(`✅ Generated meal plan for ${Object.keys(state.mealPlan).length} days`);
      console.log(`✅ Loaded ${state.recipes.length} recipes`);
      console.log(`✅ Created shopping list for week of ${weekStart.toLocaleDateString()}`);
      console.log(`\n📁 Config: ${CONFIG_FILE}`);
      console.log(`💾 State: ${STATE_FILE}`);
      break;
    }
    
    case 'weather': {
      console.log('🌤️  Fetching weather forecast...\n');
      const forecast = await fetchForecast(config.location.city, config.openweathermapApiKey);
      
      // Update meal plan with weather
      forecast.forEach(day => {
        if (state.mealPlan[day.date]) {
          state.mealPlan[day.date].weather = day;
        }
      });
      
      state.lastWeatherUpdate = new Date().toISOString();
      saveState(state);
      
      console.log('7-Day Forecast:\n');
      forecast.forEach(day => {
        const meal = state.mealPlan[day.date]?.meal || 'TBD';
        const icons = day.goodForGrilling ? '🔥' : day.goodForSoup ? '🍜' : '📅';
        console.log(`${icons} ${day.date}: ${day.high}/${day.low} ${day.condition} | ${meal}`);
      });
      break;
    }
    
    case 'shopping': {
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      const list = generateShoppingList(state.mealPlan, weekStart, weekEnd, config.stores);
      const weekKey = getWeekOf(today.toISOString().split('T')[0]);
      
      state.shoppingLists[weekKey] = {
        weekOf: weekKey,
        generated: today.toISOString(),
        lists: list
      };
      saveState(state);
      
      console.log(`🛒 Shopping List - Week of ${weekStart.toLocaleDateString()}\n`);
      
      Object.entries(list).forEach(([storeName, storeData]) => {
        console.log(`\n📍 **${storeName}**`);
        console.log('─'.repeat(30));
        Object.entries(storeData.aisles).forEach(([aisle, items]) => {
          if (items.length > 0) {
            console.log(`\n  ${aisle}:`);
            items.forEach(item => {
              console.log(`    ✓ ${item.ingredient} (×${item.quantity}) - ${item.meals}`);
            });
          }
        });
      });
      break;
    }
    
    case 'plan': {
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      
      console.log(`📅 Meal Plan - Week of ${weekStart.toLocaleDateString()}\n`);
      
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        const meal = state.mealPlan[dateStr];
        
        if (meal) {
          const weatherInfo = meal.weather ? `${meal.weather.temp}, ${meal.weather.condition}` : 'Weather TBD';
          const grillNote = meal.type === 'grill' && meal.weather?.goodForGrilling ? ' 🌡️🔥' : 
                           meal.type === 'soup' && meal.weather?.goodForSoup ? ' 🍜' : '';
          console.log(`${meal.dayOfWeek.padEnd(10)} | ${meal.meal.padEnd(25)} | ${meal.chef.padEnd(6)} | ${weatherInfo}${grillNote}`);
        } else {
          console.log(`${d.toLocaleDateString('en-US', { weekday: 'short' }).padEnd(10)} | TBD`);
        }
      }
      break;
    }
    
    case 'digest': {
      const digest = generateDigest(state, config);
      console.log(digest);
      
      // Also save to file for external access
      const digestFile = path.join(DATA_DIR, 'digest.txt');
      fs.writeFileSync(digestFile, digest);
      console.log(`\n💾 Digest saved to ${digestFile}`);
      break;
    }
    
    case 'daily': {
      // Run daily routine: weather + digest
      await main(); // Recursively call with weather mode first
      process.argv[2] = '--mode=digest';
      await main(); // Then digest
      break;
    }
    
    default: {
      console.log(`
🐊 **Crawdad - Meal Planning System**

Usage: crawdad <command>

Commands:
  init      Initialize meal plan for the year
  weather   Fetch weather forecast and update meal plan
  shopping  Generate shopping list for the week
  plan      Show this week's meal plan
  digest    Generate morning/evening digest
  daily     Run daily routine (weather + digest)

Environment Variables:
  WEATHER_API_KEY          wttr.in fallback (no key needed for wttr.in)
  OPENWEATHERMAP_API_KEY   OpenWeatherMap API key (optional)
  NOTION_TOKEN             Notion integration token
  NOTION_MEAL_PLAN_DB      Notion database ID for meal plan
  NOTION_RECIPE_DB         Notion database ID for recipes
  NOTION_SHOPPING_LIST_DB  Notion database ID for shopping lists

Get started: npm run init
      `);
    }
  }
}

// Export functions for use as module
module.exports = {
  fetchWeather,
  fetchForecast,
  generateYearMealPlan,
  generateShoppingList,
  getDefaultRecipes,
  generateDigest,
  loadConfig,
  loadState,
  saveState
};

// Only run CLI if executed directly
if (require.main === module) {
  main().catch(console.error);
}