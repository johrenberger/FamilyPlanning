import express from 'express';
import recipeRoutes from './routes/recipeRoutes.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.PORT || '3001') || 3001;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'crawdad-backend', timestamp: new Date().toISOString() });
});

// ─── DB Health ─────────────────────────────────────────────────────────────────
app.get('/health/db', async (req, res) => {
  try {
    const pgPool = new pg.Pool({
      host: process.env.DB_HOST || 'postgres',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'crawdad',
      user: process.env.DB_USER || 'crawdad',
      password: process.env.DB_PASSWORD || 'crawdad_secret',
    });
    const client = await pgPool.connect();
    await client.query('SELECT 1');
    client.release();
    await pgPool.end();
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', database: 'disconnected', error: err.message });
  }
});

// ─── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/recipes', recipeRoutes);

// ─── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🍽️  Crawdad API server running on http://0.0.0.0:${PORT}`);
  console.log(`    PostgreSQL: ${process.env.DB_HOST || 'postgres'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'crawdad'}`);
});

export default app;