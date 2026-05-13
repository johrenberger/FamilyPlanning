-- Recipes table
CREATE TABLE IF NOT EXISTS recipes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  chef          VARCHAR(100),
  type          VARCHAR(50),
  prep_time     VARCHAR(50),
  cook_time     VARCHAR(50),
  servings      INTEGER DEFAULT 4,
  ingredients   TEXT[],
  instructions  TEXT,
  tags          TEXT[],
  servings_history INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- Meal plan entries
CREATE TABLE IF NOT EXISTS meal_plan (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date          DATE UNIQUE NOT NULL,
  day_of_week   VARCHAR(20),
  meal          VARCHAR(255),
  type          VARCHAR(50),
  chef          VARCHAR(100),
  ingredients   TEXT[],
  weather_temp  VARCHAR(20),
  weather_condition VARCHAR(100),
  good_for_grilling BOOLEAN,
  good_for_soup BOOLEAN,
  notes         TEXT,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- Shopping lists
CREATE TABLE IF NOT EXISTS shopping_lists (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_of       VARCHAR(20) UNIQUE NOT NULL,
  generated     TIMESTAMP DEFAULT NOW(),
  lists_json    JSONB
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_recipes_chef ON recipes(chef);
CREATE INDEX IF NOT EXISTS idx_recipes_type ON recipes(type);
CREATE INDEX IF NOT EXISTS idx_recipes_name ON recipes(name);
CREATE INDEX IF NOT EXISTS idx_meal_plan_date ON meal_plan(date);