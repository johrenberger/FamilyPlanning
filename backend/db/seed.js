import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'crawdad',
  user: process.env.DB_USER || 'crawdad',
  password: process.env.DB_PASSWORD || 'crawdad_secret',
});

const DEFAULT_RECIPES = [
  {
    name: 'Grilled Chicken with Rosemary',
    chef: 'You',
    type: 'grill',
    prepTime: '15 min',
    cookTime: '20 min',
    servings: 4,
    ingredients: ['4 chicken breasts', '3 tbsp olive oil', '4 cloves garlic, minced', '2 tbsp fresh rosemary', '1 lemon, juiced', 'Salt and pepper'],
    instructions: 'Mix olive oil, garlic, rosemary, and lemon juice. Marinate chicken for 30 min. Grill over medium-high heat 6-8 min per side until internal temp reaches 165°F.',
    tags: ['quick', 'healthy', 'grilling'],
  },
  {
    name: 'Beef Stir Fry',
    chef: 'Wife',
    type: 'stir-fry',
    prepTime: '20 min',
    cookTime: '15 min',
    servings: 4,
    ingredients: ['1 lb beef sirloin, sliced thin', '2 cups broccoli florets', '1 bell pepper, sliced', '3 tbsp soy sauce', '1 tbsp fresh ginger, minced', '2 cloves garlic', '2 tbsp vegetable oil'],
    instructions: 'Heat oil in wok over high heat. Sear beef quickly, remove. Add vegetables, stir fry 3-4 min. Return beef, add soy sauce and ginger. Serve over rice.',
    tags: ['quick', 'asian', 'healthy'],
  },
  {
    name: 'Slow Cooker Pulled Pork',
    chef: 'You',
    type: 'slow-cooker',
    prepTime: '10 min',
    cookTime: '8 hours',
    servings: 8,
    ingredients: ['4 lb pork shoulder', '1 cup bbq sauce', '1/2 cup apple cider vinegar', '1 large onion, diced', '2 tbsp brown sugar', '1 tbsp paprika', 'Salt and pepper'],
    instructions: 'Season pork with paprika, salt, pepper. Place in slow cooker with onion, vinegar, and 1/2 cup water. Cook on low 8 hours. Shred with forks, mix with bbq sauce.',
    tags: ['easy', 'batch-cooking', 'bbq'],
  },
  {
    name: 'Pasta Primavera',
    chef: 'Wife',
    type: 'vegetarian',
    prepTime: '15 min',
    cookTime: '20 min',
    servings: 4,
    ingredients: ['1 lb penne pasta', '2 medium zucchini, diced', '1 red bell pepper, diced', '1/2 cup parmesan cheese, grated', '1/4 cup olive oil', '3 cloves garlic', 'Fresh basil'],
    instructions: 'Cook pasta al dente. Sauté garlic in olive oil, add vegetables, cook 5-7 min. Toss with pasta, parmesan, and basil. Season to taste.',
    tags: ['vegetarian', 'pasta', 'summer'],
  },
  {
    name: 'Fish Tacos',
    chef: 'You',
    type: 'grill',
    prepTime: '20 min',
    cookTime: '10 min',
    servings: 4,
    ingredients: ['1 lb white fish (tilapia or cod)', '8 corn tortillas', '2 cups cabbage, shredded', '1 avocado, sliced', '2 limes', '1/4 cup cilantro', '1 tsp cumin', 'Sour cream'],
    instructions: 'Season fish with cumin, salt, pepper. Grill 3-4 min per side. flake into chunks. Warm tortillas, fill with fish, cabbage, avocado, cilantro, lime juice, and sour cream.',
    tags: ['grilling', 'seafood', 'mexican'],
  },
  {
    name: 'Homemade Pizza',
    chef: 'Wife',
    type: 'oven',
    prepTime: '30 min',
    cookTime: '15 min',
    servings: 4,
    ingredients: ['1 lb pizza dough', '1/2 cup marinara sauce', '8 oz mozzarella, shredded', '4 oz pepperoni', '8 oz mushrooms, sliced', '1 tsp Italian seasoning'],
    instructions: 'Preheat oven to 475°F. Stretch dough into 12" circle. Spread sauce, top with cheese, pepperoni, mushrooms. Bake 12-15 min until crust is golden and cheese is bubbly.',
    tags: ['family-favorite', 'pizza-night'],
  },
  {
    name: 'Grilled Burgers',
    chef: 'You',
    type: 'grill',
    prepTime: '10 min',
    cookTime: '12 min',
    servings: 4,
    ingredients: ['1 lb ground beef', '4 buns', 'Lettuce', 'Tomato', 'Cheese slices', 'Ketchup', 'Mustard'],
    instructions: 'Form beef into 4 patties, season with salt and pepper. Grill over medium-high heat 5-6 min per side for medium doneness. Toast buns, add toppings.',
    tags: ['grilling', 'family-favorite', 'bbq'],
  },
  {
    name: 'Chicken Tortilla Soup',
    chef: 'Wife',
    type: 'soup',
    prepTime: '20 min',
    cookTime: '30 min',
    servings: 6,
    ingredients: ['1 lb chicken breast', '1 bag tortilla chips', '1 can black beans', '2 cans diced tomatoes', '1 avocado', '1 cup shredded cheese', 'Sour cream', 'Fresh cilantro'],
    instructions: 'Simmer chicken in broth until cooked, shred. Return to pot with tomatoes, beans, and seasonings. Serve over tortilla chips with avocado, cheese, and sour cream.',
    tags: ['soup', 'mexican', 'comfort-food'],
  },
  {
    name: 'Grilled Salmon',
    chef: 'You',
    type: 'grill',
    prepTime: '10 min',
    cookTime: '12 min',
    servings: 4,
    ingredients: ['4 salmon fillets', '1 lemon', '2 tbsp dill', '2 tbsp olive oil', '3 cloves garlic', 'Salt and pepper'],
    instructions: 'Brush salmon with olive oil, season with salt, pepper, and dill. Grill skin-side down 4-5 min, flip and cook 3-4 min more until flesh flakes easily.',
    tags: ['grilling', 'healthy', 'seafood'],
  },
  {
    name: 'Beef Tacos',
    chef: 'Wife',
    type: 'oven',
    prepTime: '10 min',
    cookTime: '15 min',
    servings: 6,
    ingredients: ['1 lb ground beef', '2 tbsp taco seasoning', '8 corn tortillas', '2 cups shredded cheese', '2 cups lettuce', '1 tomato', 'Sour cream'],
    instructions: 'Brown beef, add taco seasoning and 1/4 cup water, simmer 5 min. Warm tortillas, fill with beef, cheese, lettuce, tomato, and sour cream.',
    tags: ['mexican', 'family-favorite', 'oven'],
  },
  {
    name: 'BBQ Baby Back Ribs',
    chef: 'You',
    type: 'grill',
    prepTime: '15 min',
    cookTime: '4 hours',
    servings: 4,
    ingredients: ['2 racks baby back ribs', '3 tbsp bbq rub', '1 cup bbq sauce', '1/2 cup apple juice', 'Salt and pepper'],
    instructions: 'Remove membrane from ribs. Season generously with rub. Wrap in foil with apple juice, refrigerate 1 hour. Unwrap, grill 2 hours with sauce, low heat.',
    tags: ['grilling', 'bbq', 'weekend'],
  },
  {
    name: 'Shrimp Scampi',
    chef: 'Wife',
    type: 'stovetop',
    prepTime: '10 min',
    cookTime: '15 min',
    servings: 4,
    ingredients: ['1 lb shrimp', '12 oz linguine', '4 tbsp butter', '4 cloves garlic', '1/2 cup white wine', '1/4 cup parsley', 'Lemon juice'],
    instructions: 'Cook pasta. Sauté garlic in butter, add wine, reduce. Add shrimp, cook 3-4 min. Toss with pasta, parsley, and lemon juice.',
    tags: ['seafood', 'pasta', 'quick'],
  },
  {
    name: 'Grilled Steaks',
    chef: 'You',
    type: 'grill',
    prepTime: '10 min',
    cookTime: '15 min',
    servings: 2,
    ingredients: ['2 ribeye steaks', '3 tbsp butter', '4 sprigs thyme', '3 cloves garlic', 'Salt and pepper'],
    instructions: 'Season steaks generously. Grill over high heat 4-5 min per side for medium-rare. Rest 5 min. Top with butter, thyme, and garlic.',
    tags: ['grilling', 'steak', 'special-occasion'],
  },
  {
    name: 'Vegetable Curry',
    chef: 'Wife',
    type: 'stovetop',
    prepTime: '15 min',
    cookTime: '30 min',
    servings: 4,
    ingredients: ['1 can coconut milk', '2 tbsp curry paste', '1 can chickpeas', '2 potatoes', '2 cups spinach', '1 onion', 'Rice'],
    instructions: 'Sauté onion, add curry paste, stir 1 min. Add coconut milk, chickpeas, and potatoes. Simmer 20 min until potatoes tender. Stir in spinach. Serve over rice.',
    tags: ['vegetarian', 'curry', 'comfort-food'],
  },
];

async function seed() {
  console.log('🌱 Seeding default recipes...');

  const client = await pool.connect();
  try {
    // Clear existing recipes
    await client.query('DELETE FROM recipes');

    for (const r of DEFAULT_RECIPES) {
      await client.query(
        `INSERT INTO recipes (name, chef, type, prep_time, cook_time, servings, ingredients, instructions, tags)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [r.name, r.chef, r.type, r.prepTime, r.cookTime, r.servings, r.ingredients, r.instructions, r.tags]
      );
    }

    const { rows } = await client.query('SELECT COUNT(*) FROM recipes');
    console.log(`✅ Seeded ${rows[0].count} recipes`);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  } finally {
    await client.release();
    await pool.end();
  }
}

seed();