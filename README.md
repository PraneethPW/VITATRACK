# VitaTrack

VitaTrack is a personalised fitness companion: users create a protected account, complete a health profile, and receive calculated calorie, macro, micronutrient, steps, training, and meal recommendations.

## Stack

- **Frontend:** React, Vite, Tailwind CSS, Framer Motion, Recharts, React Three Fiber
- **Backend:** Node.js, Express, PostgreSQL (Neon-ready), JWT authentication
- **Optional intelligence:** OpenRouter, for profile-aware coaching answers

## Run locally

1. Create a Neon database and copy its connection string.
2. In `backend`, copy `.env.example` to `.env`, then set `DATABASE_URL` and `JWT_SECRET`.
3. In `frontend`, copy `.env.example` to `.env` and set `VITE_API_URL=http://localhost:4000/api`.
4. Install and run each project:

```bash
cd backend && npm install && npm run dev
cd frontend && npm install && npm run dev
```

The backend creates its tables automatically on startup. Nutrition calculations use Mifflin–St Jeor BMR, activity multipliers and goal adjustments. They are educational estimates, not medical advice.

## Deploy

- **Vercel:** import `frontend`; set `VITE_API_URL` to `https://your-railway-service.up.railway.app/api`.
- **Railway:** import `backend`; set `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, and `OPENROUTER_API_KEY`. `OPENROUTER_MODEL` defaults to `openrouter/free`, which routes each request to an available free text model. To pin a model, use its OpenRouter ID with a `:free` suffix.

## Pages

Landing, sign in, sign up, onboarding, overview, nutrition, weekly training, meal planner, steps, progress, and AI coach are separate protected routes.
