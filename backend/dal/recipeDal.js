import pg from 'pg';
import { loadConfig } from '../services/config.js';

const { Pool } = pg;
let pool;

function getPool() {
  if (!pool) {
    const config = loadConfig();
    pool = new Pool({
      host: process.env.DB_HOST || config.database?.host || 'postgres',
      port: parseInt(process.env.DB_PORT || config.database?.port || '5432'),
      database: process.env.DB_NAME || config.database?.name || 'crawdad',
      user: process.env.DB_USER || config.database?.user || 'crawdad',
      password: process.env.DB_PASSWORD || config.database?.password || 'crawdad_secret',
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  return pool;
}

export async function getAllRecipes({ chef, type, limit = 100 } = {}) {
  const client = await getPool().connect();
  try {
    let query = 'SELECT * FROM recipes WHERE 1=1';
    const params = [];

    if (chef) {
      params.push(chef);
      query += ` AND chef = $${params.length}`;
    }
    if (type) {
      params.push(type);
      query += ` AND type = $${params.length}`;
    }
    params.push(limit);
    query += ` ORDER BY created_at DESC LIMIT $${params.length}`;

    const { rows } = await client.query(query, params);
    return rows;
  } finally {
    client.release();
  }
}

export async function getRecipeById(id) {
  const { rows } = await getPool().query(
    'SELECT * FROM recipes WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

export async function upsertRecipe(recipe) {
  const {
    id = null,
    name,
    chef,
    type,
    prepTime,
    cookTime,
    servings,
    ingredients,
    instructions,
    tags,
  } = recipe;

  const { rows } = await getPool().query(
    `INSERT INTO recipes (id, name, chef, type, prep_time, cook_time, servings, ingredients, instructions, tags, updated_at)
     VALUES (COALESCE($1, gen_random_uuid()), $2,$3,$4,$5,$6,$7,$8,$9,$10, NOW())
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name, chef = EXCLUDED.chef, type = EXCLUDED.type,
       prep_time = EXCLUDED.prep_time, cook_time = EXCLUDED.cook_time,
       servings = EXCLUDED.servings, ingredients = EXCLUDED.ingredients,
       instructions = EXCLUDED.instructions, tags = EXCLUDED.tags,
       updated_at = NOW()
     RETURNING *`,
    [id, name, chef, type, prepTime, cookTime, servings, ingredients, instructions, tags]
  );
  return rows[0];
}

export async function deleteRecipe(id) {
  const { rowCount } = await getPool().query(
    'DELETE FROM recipes WHERE id = $1',
    [id]
  );
  return rowCount > 0;
}

export async function getLatestRecipes(limit = 10) {
  const { rows } = await getPool().query(
    'SELECT * FROM recipes ORDER BY updated_at DESC LIMIT $1',
    [limit]
  );
  return rows;
}

export async function getChefs() {
  const { rows } = await getPool().query(
    'SELECT DISTINCT chef FROM recipes WHERE chef IS NOT NULL ORDER BY chef'
  );
  return rows.map(r => r.chef);
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}