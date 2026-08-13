import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import { randomUUID } from 'crypto';
import { calculate } from './engine.js';

const app = express();
const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});
const secret = process.env.JWT_SECRET || 'dev-secret-change-me';

app.use(cors({
  origin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(','),
  credentials: true
}));
app.use(express.json());

const auth = (req, res, next) => {
  try {
    req.user = jwt.verify(req.headers.authorization?.replace('Bearer ', ''), secret);
    next();
  } catch {
    res.status(401).json({ error: 'Please sign in again.' });
  }
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const safeArray = (v) => Array.isArray(v) ? v : [];
const safeNumber = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const sortByDate = (items) => [...safeArray(items)].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
const last = (items) => safeArray(items).at(-1) || null;
const avg = (items, getter = (x) => x) => {
  const values = safeArray(items).map(getter).filter((x) => Number.isFinite(x));
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
};
const recent = (items, count = 7) => safeArray(items).slice(-count);
const upsertByDate = (items, entry, merge = false) => {
  const next = safeArray(items).filter((x) => x.date !== entry.date);
  const existing = safeArray(items).find((x) => x.date === entry.date);
  const finalEntry = merge && existing ? { ...existing, ...entry } : entry;
  return [...next, finalEntry].sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(-30);
};

async function initSchema() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      profile JSONB,
      steps JSONB DEFAULT '[]',
      goals JSONB DEFAULT '[]',
      water JSONB DEFAULT '[]',
      sleep JSONB DEFAULT '[]',
      alarms JSONB DEFAULT '[]',
      recipes JSONB DEFAULT '[]',
      achievements JSONB DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  for (const [column, defaultValue] of [
    ['profile', 'NULL'],
    ['steps', "'[]'"],
    ['goals', "'[]'"],
    ['water', "'[]'"],
    ['sleep', "'[]'"],
    ['alarms', "'[]'"],
    ['recipes', "'[]'"],
    ['achievements', "'[]'"]
  ]) {
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${column} JSONB DEFAULT ${defaultValue}`);
  }
}

function deriveAchievements(user, plan) {
  const steps = sortByDate(user.steps);
  const water = sortByDate(user.water);
  const sleep = sortByDate(user.sleep);
  const goals = safeArray(user.goals);
  const recipes = safeArray(user.recipes);
  const completedGoals = goals.filter((g) => g.status === 'done' || g.completed).length;
  const stepAvg7 = avg(recent(steps, 7), (x) => safeNumber(x.steps));
  const waterAvg7 = avg(recent(water, 7), (x) => safeNumber(x.ml));
  const sleepAvg7 = avg(recent(sleep, 7), (x) => safeNumber(x.hours));

  const achievementList = [
    {
      id: 'profile_complete',
      title: 'Profile locked in',
      description: 'Your baseline profile is complete and driving the plan.',
      unlocked: !!user.profile,
      progress: user.profile ? 100 : 0
    },
    {
      id: 'movement_start',
      title: 'First movement log',
      description: 'You have at least one step entry in the system.',
      unlocked: steps.length > 0,
      progress: Math.min(100, Math.round((steps.length / 1) * 100))
    },
    {
      id: 'movement_consistency',
      title: 'Movement consistency',
      description: 'Keep movement logs flowing for the week.',
      unlocked: stepAvg7 >= plan.steps * 0.8,
      progress: Math.min(100, Math.round((stepAvg7 / Math.max(plan.steps, 1)) * 100))
    },
    {
      id: 'hydration_flow',
      title: 'Hydration flow',
      description: 'Daily hydration is close to your calculated target.',
      unlocked: waterAvg7 >= plan.water * 1000 * 0.9,
      progress: Math.min(100, Math.round((waterAvg7 / Math.max(plan.water * 1000, 1)) * 100))
    },
    {
      id: 'sleep_rhythm',
      title: 'Sleep rhythm',
      description: 'Your recent sleep logs are landing in the healthy range.',
      unlocked: sleepAvg7 >= 7,
      progress: Math.min(100, Math.round((sleepAvg7 / 8) * 100))
    },
    {
      id: 'goal_getter',
      title: 'Goal getter',
      description: 'At least one goal has been completed.',
      unlocked: completedGoals > 0,
      progress: Math.min(100, Math.round((completedGoals / Math.max(goals.length, 1)) * 100))
    },
    {
      id: 'recipe_builder',
      title: 'Recipe builder',
      description: 'You have generated AI recipes tailored to your plan.',
      unlocked: recipes.length > 0,
      progress: Math.min(100, recipes.length * 25)
    }
  ];

  return achievementList;
}

function summarizeAnalytics(user, plan) {
  const steps = sortByDate(user.steps);
  const water = sortByDate(user.water);
  const sleep = sortByDate(user.sleep);
  const goals = safeArray(user.goals);
  const achievements = deriveAchievements(user, plan);

  const step7 = recent(steps, 7).map((x) => safeNumber(x.steps));
  const water7 = recent(water, 7).map((x) => safeNumber(x.ml));
  const sleep7 = recent(sleep, 7).map((x) => safeNumber(x.hours));
  const stepAvg = step7.length ? Math.round(step7.reduce((sum, value) => sum + value, 0) / step7.length) : 0;
  const waterAvg = water7.length ? Math.round(water7.reduce((sum, value) => sum + value, 0) / water7.length) : 0;
  const sleepAvg = sleep7.length ? +(sleep7.reduce((sum, value) => sum + value, 0) / sleep7.length).toFixed(1) : 0;
  const movementScore = Math.min(100, Math.round((stepAvg / Math.max(plan.steps, 1)) * 70 + Math.min(steps.length, 7) / 7 * 30));
  const hydrationScore = Math.min(100, Math.round((waterAvg / Math.max(plan.water * 1000, 1)) * 100));
  const sleepScore = Math.min(100, Math.round((sleepAvg / 8) * 100));
  const goalCompletion = goals.length ? Math.round((goals.filter((g) => g.status === 'done' || g.completed).length / goals.length) * 100) : 0;
  const readiness = Math.round((movementScore + hydrationScore + sleepScore + goalCompletion) / 4);
  const activeGoals = goals.filter((g) => !(g.status === 'done' || g.completed)).length;
  const todaySteps = last(steps)?.steps || 0;
  const todayWater = last(water)?.ml || 0;
  const todaySleep = last(sleep)?.hours || 0;

  return {
    movementScore,
    hydrationScore,
    sleepScore,
    goalCompletion,
    readiness,
    stepAvg,
    waterAvg,
    sleepAvg,
    activeGoals,
    completedGoals: goals.length - activeGoals,
    totalGoals: goals.length,
    totalWaterLogs: water.length,
    totalSleepLogs: sleep.length,
    totalStepLogs: steps.length,
    todaySteps,
    todayWater,
    todaySleep,
    streaks: {
      steps: steps.length ? steps.filter((x) => safeNumber(x.steps) > 0).length : 0,
      water: water.length ? water.filter((x) => safeNumber(x.ml) > 0).length : 0,
      sleep: sleep.length ? sleep.filter((x) => safeNumber(x.hours) >= 6).length : 0
    },
    highlights: [
      movementScore >= 80 ? 'Movement is strong this week.' : 'Movement needs a little more consistency.',
      hydrationScore >= 80 ? 'Hydration is near your target.' : 'Hydration can still improve.',
      sleepScore >= 80 ? 'Sleep is in a solid range.' : 'Sleep needs a steadier rhythm.'
    ],
    achievements
  };
}

function fallbackRecipes(profile, plan) {
  const leanProtein = profile.goal === 'gain' ? 'salmon' : 'chicken breast';
  const carbBase = profile.goal === 'lose' ? 'cauliflower rice' : 'jasmine rice';
  const recipes = [
    {
      id: randomUUID(),
      mealType: 'breakfast',
      title: 'High-Protein Ember Oats',
      ingredients: ['rolled oats', 'Greek yogurt', 'berries', 'chia seeds', 'honey'],
      instructions: ['Cook oats', 'fold in yogurt', 'top with berries and chia', 'finish with honey'],
      macros: { calories: Math.round(plan.calories * 0.22), protein: Math.round(plan.protein * 0.24), carbs: Math.round(plan.carbs * 0.24), fat: Math.round(plan.fat * 0.2) }
    },
    {
      id: randomUUID(),
      mealType: 'lunch',
      title: 'Fire Bowl Power Lunch',
      ingredients: [leanProtein, carbBase, 'greens', 'olive oil', 'lemon', 'sesame'],
      instructions: ['Sear protein', 'build the bowl', 'add greens and grain', 'finish with lemon and sesame'],
      macros: { calories: Math.round(plan.calories * 0.32), protein: Math.round(plan.protein * 0.33), carbs: Math.round(plan.carbs * 0.3), fat: Math.round(plan.fat * 0.28) }
    },
    {
      id: randomUUID(),
      mealType: 'dinner',
      title: 'Recovery Plate',
      ingredients: ['lean protein', 'roasted vegetables', 'sweet potato', 'olive oil', 'herbs'],
      instructions: ['Roast vegetables', 'cook protein', 'plate with starch', 'drizzle and season'],
      macros: { calories: Math.round(plan.calories * 0.34), protein: Math.round(plan.protein * 0.33), carbs: Math.round(plan.carbs * 0.32), fat: Math.round(plan.fat * 0.32) }
    }
  ];
  return recipes;
}

function extractJson(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const payload = fenced?.[1] || trimmed;
  return JSON.parse(payload);
}

async function generateRecipes(profile, plan, prompt) {
  if (!process.env.OPENROUTER_API_KEY) return fallbackRecipes(profile, plan);
  const body = {
    model: process.env.OPENROUTER_MODEL || 'openrouter/free',
    max_tokens: 700,
    messages: [
      {
        role: 'system',
        content: `You are a precise sports nutrition chef. Return valid JSON only. Profile: ${JSON.stringify(profile)}. Calculated plan: ${JSON.stringify(plan)}. Create 3 recipes that match the user's calories, protein target, activity and goal. Each recipe must include mealType, title, ingredients array, instructions array, and macros object with calories, protein, carbs, fat.`
      },
      {
        role: 'user',
        content: prompt
      }
    ]
  };
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.CORS_ORIGIN?.split(',')[0] || 'http://localhost:5173',
      'X-Title': 'VitaTrack'
    },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error?.message || 'OpenRouter did not return a response.');
  const content = data.choices?.[0]?.message?.content || '[]';
  const parsed = extractJson(content);
  return Array.isArray(parsed) ? parsed : parsed.recipes || [];
}

async function getUserRow(userId) {
  const result = await db.query('SELECT * FROM users WHERE id=$1', [userId]);
  return result.rows[0];
}

async function updateUserField(userId, field, value) {
  await db.query(`UPDATE users SET ${field}=$1 WHERE id=$2`, [value, userId]);
}

await initSchema();

const token = (user) => jwt.sign({ id: user.id, email: user.email }, secret, { expiresIn: '7d' });

app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || password?.length < 6) return res.status(400).json({ error: 'Enter a name, valid email, and a 6+ character password.' });
  try {
    const result = await db.query(
      'INSERT INTO users(name,email,password) VALUES($1,$2,$3) RETURNING id,name,email',
      [name, email.toLowerCase(), await bcrypt.hash(password, 12)]
    );
    res.status(201).json({ token: token(result.rows[0]), user: result.rows[0] });
  } catch {
    res.status(409).json({ error: 'That email is already registered.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const result = await db.query('SELECT * FROM users WHERE email=$1', [req.body.email?.toLowerCase()]);
  const user = result.rows[0];
  if (!user || !await bcrypt.compare(req.body.password || '', user.password)) return res.status(401).json({ error: 'Incorrect email or password.' });
  res.json({ token: token(user), user: { id: user.id, name: user.name, email: user.email } });
});

app.get('/api/me', auth, async (req, res) => {
  const user = await getUserRow(req.user.id);
  const plan = user.profile ? calculate(user.profile) : null;
  const analytics = user.profile ? summarizeAnalytics(user, plan) : null;
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    profile: user.profile,
    steps: safeArray(user.steps),
    goals: safeArray(user.goals),
    water: safeArray(user.water),
    sleep: safeArray(user.sleep),
    alarms: safeArray(user.alarms),
    recipes: safeArray(user.recipes),
    achievements: safeArray(user.achievements),
    plan,
    analytics
  });
});

app.put('/api/profile', auth, async (req, res) => {
  const profile = req.body;
  for (const key of ['age', 'height', 'weight', 'activity', 'goal', 'sex']) if (!profile[key]) return res.status(400).json({ error: 'Complete every profile field.' });
  await updateUserField(req.user.id, 'profile', profile);
  const plan = calculate(profile);
  const user = await getUserRow(req.user.id);
  const analytics = summarizeAnalytics({ ...user, profile }, plan);
  res.json({ profile, plan, analytics });
});

app.post('/api/steps', auth, async (req, res) => {
  const user = await getUserRow(req.user.id);
  const history = upsertByDate(user.steps, { date: req.body.date || todayISO(), steps: safeNumber(req.body.steps) }, true);
  await updateUserField(req.user.id, 'steps', history);
  res.json({ steps: history, analytics: user.profile ? summarizeAnalytics({ ...user, steps: history }, calculate(user.profile)) : null });
});

app.get('/api/analytics', auth, async (req, res) => {
  const user = await getUserRow(req.user.id);
  if (!user.profile) return res.json({ analytics: null });
  const plan = calculate(user.profile);
  res.json({ analytics: summarizeAnalytics(user, plan) });
});

app.get('/api/goals', auth, async (req, res) => {
  const user = await getUserRow(req.user.id);
  res.json({ goals: safeArray(user.goals) });
});

app.post('/api/goals', auth, async (req, res) => {
  const user = await getUserRow(req.user.id);
  const goal = {
    id: randomUUID(),
    title: req.body.title?.trim(),
    target: safeNumber(req.body.target),
    unit: req.body.unit || 'days',
    category: req.body.category || 'general',
    dueDate: req.body.dueDate || '',
    notes: req.body.notes || '',
    current: 0,
    status: 'active',
    createdAt: new Date().toISOString()
  };
  if (!goal.title || !goal.target) return res.status(400).json({ error: 'Add a goal title and target.' });
  const goals = [...safeArray(user.goals), goal];
  await updateUserField(req.user.id, 'goals', goals);
  res.status(201).json({ goals });
});

app.patch('/api/goals/:id', auth, async (req, res) => {
  const user = await getUserRow(req.user.id);
  const goals = safeArray(user.goals).map((goal) => {
    if (goal.id !== req.params.id) return goal;
    const current = req.body.current !== undefined ? safeNumber(req.body.current) : goal.current;
    const completed = req.body.completed !== undefined ? !!req.body.completed : current >= safeNumber(goal.target);
    return {
      ...goal,
      ...req.body,
      current,
      completed,
      status: completed ? 'done' : goal.status || 'active',
      completedAt: completed && !goal.completedAt ? new Date().toISOString() : goal.completedAt || null
    };
  });
  await updateUserField(req.user.id, 'goals', goals);
  res.json({ goals });
});

app.delete('/api/goals/:id', auth, async (req, res) => {
  const user = await getUserRow(req.user.id);
  const goals = safeArray(user.goals).filter((goal) => goal.id !== req.params.id);
  await updateUserField(req.user.id, 'goals', goals);
  res.json({ goals });
});

app.get('/api/water', auth, async (req, res) => {
  const user = await getUserRow(req.user.id);
  res.json({ water: safeArray(user.water) });
});

app.post('/api/water', auth, async (req, res) => {
  const user = await getUserRow(req.user.id);
  const entry = {
    date: req.body.date || todayISO(),
    ml: safeNumber(req.body.ml),
    createdAt: new Date().toISOString()
  };
  if (!entry.ml) return res.status(400).json({ error: 'Log a water amount in ml.' });
  const current = safeArray(user.water);
  const merged = current.find((item) => item.date === entry.date)
    ? current.map((item) => item.date === entry.date ? { ...item, ml: safeNumber(item.ml) + entry.ml, updatedAt: new Date().toISOString() } : item)
    : [...current, entry];
  const water = merged.sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(-30);
  await updateUserField(req.user.id, 'water', water);
  const plan = user.profile ? calculate(user.profile) : null;
  res.json({ water, analytics: plan ? summarizeAnalytics({ ...user, water }, plan) : null });
});

app.get('/api/sleep', auth, async (req, res) => {
  const user = await getUserRow(req.user.id);
  res.json({ sleep: safeArray(user.sleep) });
});

app.post('/api/sleep', auth, async (req, res) => {
  const user = await getUserRow(req.user.id);
  const entry = {
    date: req.body.date || todayISO(),
    hours: safeNumber(req.body.hours),
    quality: safeNumber(req.body.quality, 3),
    createdAt: new Date().toISOString()
  };
  if (!entry.hours) return res.status(400).json({ error: 'Log your sleep hours.' });
  const sleep = upsertByDate(user.sleep, entry, true);
  await updateUserField(req.user.id, 'sleep', sleep);
  const plan = user.profile ? calculate(user.profile) : null;
  res.json({ sleep, analytics: plan ? summarizeAnalytics({ ...user, sleep }, plan) : null });
});

app.get('/api/alarms', auth, async (req, res) => {
  const user = await getUserRow(req.user.id);
  res.json({ alarms: safeArray(user.alarms) });
});

app.post('/api/alarms', auth, async (req, res) => {
  const user = await getUserRow(req.user.id);
  const alarm = {
    id: randomUUID(),
    label: req.body.label?.trim() || 'Reminder',
    time: req.body.time,
    repeat: req.body.repeat || 'daily',
    enabled: req.body.enabled !== false,
    createdAt: new Date().toISOString()
  };
  if (!alarm.time) return res.status(400).json({ error: 'Choose a time for the alarm.' });
  const alarms = [...safeArray(user.alarms), alarm];
  await updateUserField(req.user.id, 'alarms', alarms);
  res.status(201).json({ alarms });
});

app.patch('/api/alarms/:id', auth, async (req, res) => {
  const user = await getUserRow(req.user.id);
  const alarms = safeArray(user.alarms).map((alarm) => alarm.id === req.params.id ? { ...alarm, ...req.body } : alarm);
  await updateUserField(req.user.id, 'alarms', alarms);
  res.json({ alarms });
});

app.delete('/api/alarms/:id', auth, async (req, res) => {
  const user = await getUserRow(req.user.id);
  const alarms = safeArray(user.alarms).filter((alarm) => alarm.id !== req.params.id);
  await updateUserField(req.user.id, 'alarms', alarms);
  res.json({ alarms });
});

app.get('/api/recipes', auth, async (req, res) => {
  const user = await getUserRow(req.user.id);
  res.json({ recipes: safeArray(user.recipes) });
});

app.post('/api/recipes/generate', auth, async (req, res) => {
  const user = await getUserRow(req.user.id);
  if (!user.profile) return res.status(400).json({ error: 'Create your profile first.' });
  const plan = calculate(user.profile);
  const prompt = req.body.prompt || `Generate 3 high-protein recipes for a ${user.profile.goal} goal. Match ${plan.calories} calories, ${plan.protein}g protein, and ${plan.carbs}g carbs.`;
  const generated = await generateRecipes(user.profile, plan, prompt);
  const recipes = [...safeArray(user.recipes), ...generated.map((recipe) => ({
    id: recipe.id || randomUUID(),
    mealType: recipe.mealType || 'snack',
    title: recipe.title || 'AI Recipe',
    ingredients: safeArray(recipe.ingredients),
    instructions: safeArray(recipe.instructions),
    macros: recipe.macros || {},
    createdAt: new Date().toISOString()
  }))].slice(-20);
  await updateUserField(req.user.id, 'recipes', recipes);
  res.json({ recipes });
});

app.post('/api/coach', auth, async (req, res) => {
  const user = await getUserRow(req.user.id);
  const plan = calculate(user.profile);
  if (!process.env.OPENROUTER_API_KEY) {
    return res.json({
      message: `Your ${plan.calories} kcal target includes ${plan.protein}g protein. Keep your next meal balanced, aim for ${plan.steps.toLocaleString()} steps today, and use your goal page to keep the week on track.`
    });
  }
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.CORS_ORIGIN?.split(',')[0] || 'http://localhost:5173',
        'X-Title': 'VitaTrack'
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'openrouter/free',
        max_tokens: 350,
        messages: [
          {
            role: 'system',
            content: `You are a concise, supportive fitness coach. Profile: ${JSON.stringify(user.profile)}. Calculated plan: ${JSON.stringify(plan)}. Give practical, non-medical guidance. Never diagnose, prescribe, or claim certainty.`
          },
          { role: 'user', content: req.body.message }
        ]
      })
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.error?.message || 'OpenRouter did not return a response.');
    res.json({ message: data.choices?.[0]?.message?.content || 'Coach is momentarily unavailable.' });
  } catch (error) {
    res.status(502).json({ error: `Coach is unavailable right now: ${error.message}` });
  }
});

app.get('/health', (_, res) => res.json({ ok: true }));

app.listen(process.env.PORT || 4000, () => console.log('VitaTrack API ready'));
