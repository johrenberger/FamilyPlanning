import express from 'express';
import * as recipeService from '../services/recipeService.js';

const router = express.Router();

// GET /api/recipes — list all recipes (with optional filter)
router.get('/', async (req, res) => {
  try {
    const { chef, type, limit } = req.query;
    const recipes = await recipeService.getAllRecipes({ chef, type, limit: limit ? parseInt(limit) : 100 });
    res.json({ success: true, count: recipes.length, recipes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/recipes/latest — get recently updated recipes
router.get('/latest', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || 10);
    const recipes = await recipeService.getLatestRecipes(limit);
    res.json({ success: true, recipes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/recipes/:id — get single recipe
router.get('/:id', async (req, res) => {
  try {
    const recipe = await recipeService.getRecipeById(req.params.id);
    if (!recipe) {
      return res.status(404).json({ success: false, error: 'Recipe not found' });
    }
    res.json({ success: true, recipe });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/recipes — store a recipe
router.post('/', async (req, res) => {
  try {
    const recipe = await recipeService.storeRecipe(req.body);
    res.json({ success: true, recipe });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/recipes/:id
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await recipeService.deleteRecipe(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Recipe not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/recipes/ingest — re-ingest all default recipes (fresh deploy)
router.post('/ingest', async (req, res) => {
  try {
    const recipes = await recipeService.reIngestRecipes();
    res.json({ success: true, count: recipes.length, recipes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/recipes/chefs — list available chefs
router.get('/meta/chefs', async (req, res) => {
  try {
    const chefs = await recipeService.getChefs();
    res.json({ success: true, chefs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;