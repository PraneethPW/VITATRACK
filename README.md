# VitaTrack

VitaTrack is a personalised fitness companion: users create a protected account, complete a health profile, and receive calculated calorie, macro, micronutrient, steps, training, and meal recommendations.

## Stack

- **Frontend:** React, Vite, Tailwind CSS, Framer Motion, Recharts, React Three Fiber
- **Backend:** Node.js, Express, PostgreSQL (Neon-ready), JWT authentication
- **Optional intelligence:** OpenRouter, for profile-aware coaching answers

## Run locally

1. Create a Neon database and copy its connection string.
2. In `backend`, copy `.env.example` to `.env`, then set `DATABASE_URL` and `JWT_SECRET`.
3. In `frontend`, copy `.env.example` to `.env` for local web development, and copy `.env.android.example` to `.env.android` for the Android build.
4. Install and run each project:

```bash
cd backend && npm install && npm run dev
cd frontend && npm install && npm run dev
```

The backend creates its tables automatically on startup. Nutrition calculations use Mifflin–St Jeor BMR, activity multipliers and goal adjustments. They are educational estimates, not medical advice.

## Deploy

- **Vercel:** import `frontend`; set `VITE_API_URL` to `https://your-railway-service.up.railway.app/api`. The `base: './'` Vite setting keeps the Capacitor build happy without changing the web deployment.
- **Railway:** import `backend`; set `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, and `OPENROUTER_API_KEY`. `OPENROUTER_MODEL` defaults to `openrouter/free`, which routes each request to an available free text model. To pin a model, use its OpenRouter ID with a `:free` suffix.

## Pages

Landing, sign in, sign up, onboarding, overview, nutrition, weekly training, meal planner, steps, progress, and AI coach are separate protected routes.

## Android env

Capacitor uses the Vite `android` mode, so the Android bundle reads `frontend/.env.android` during build.

Use these commands from `frontend`:

```bash
npm run build:android
npx cap sync android
npx cap run android
```

`frontend/.env.android` should point at your Railway backend, while `frontend/.env` can stay on localhost for regular web development.

## Android wrapper

The frontend is set up for Capacitor, so you can build and run Android from the same React app.

If you want Android Studio access, open `frontend/android` after the first sync.

Keep `VITE_API_URL` pointed at the deployed Railway backend before you build the Android bundle.

Recommended values:

- `DATABASE_URL` - your Neon Postgres connection string
- `JWT_SECRET` - a long random secret
- `CORS_ORIGIN` - include both your Vercel site and Capacitor origins, for example:

```bash
https://your-vercel-app.vercel.app,capacitor://localhost,http://localhost:5173
```

- `OPENROUTER_API_KEY` - your OpenRouter key
- `OPENROUTER_MODEL` - keep `openrouter/free` unless you want to pin a specific free model
- `PORT` - Railway usually injects this automatically, so you normally leave it alone

For the frontend build, set:

```bash
VITE_API_URL=https://your-railway-service.up.railway.app/api
```
