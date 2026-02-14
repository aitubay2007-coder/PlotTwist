# PlotTwist - The Stock Market for Fans

A social prediction platform where fans bet virtual coins on plot twists in their favorite shows, anime, movies, and more.

## Tech Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS v4
- **Backend:** Express + TypeScript
- **Database:** Supabase (PostgreSQL + Auth + Realtime)
- **State:** Zustand
- **i18n:** react-i18next (English + Russian)

## Getting Started

### 1. Setup Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run the SQL migration from `supabase/migrations/001_initial_schema.sql` in the SQL Editor
3. Copy your project URL and keys

### 2. Environment Variables

**Client** (`client/.env`):
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Server** (`server/.env`):
```
PORT=3001
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CLIENT_URL=http://localhost:5173
```

### 3. Install & Run

```bash
# Client
cd client
npm install
npm run dev

# Server (separate terminal)
cd server
npm install
npm run dev
```

Client runs on `http://localhost:5173`, server on `http://localhost:3001`.

## Project Structure

```
PlotTwist/
├── client/                # React frontend
│   ├── src/
│   │   ├── components/    # Navbar, PredictionCard, BetModal, etc.
│   │   ├── pages/         # Home, Dashboard, Clans, Challenges, etc.
│   │   ├── store/         # Zustand auth store
│   │   ├── lib/           # Supabase client, API client, i18n
│   │   ├── locales/       # EN + RU translations
│   │   └── types/         # TypeScript interfaces
├── server/                # Express API
│   ├── src/
│   │   ├── routes/        # predictions, clans, challenges, auth, users
│   │   ├── middleware/     # JWT auth
│   │   └── index.ts
├── supabase/
│   └── migrations/        # Database schema + seed data
└── README.md
```

## Features

- Prediction marketplace with YES/NO betting
- Virtual currency (PlotCoins) - no real money
- Clans with invite links and internal leaderboards
- Friend challenges (1v1 bets)
- Global and country leaderboards
- Daily login bonus
- Bilingual (EN/RU)
