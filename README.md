# VerifEye

Detects AI-generated and manipulated images, videos and audio. React web app + Node API.

## Structure

```
verifeye-app/
├── src/                 # React 18 + Vite + Tailwind web app
│   ├── components/
│   ├── pages/
│   ├── context/         # AuthContext (token + user)
│   └── utils/
├── public/locales/      # i18n translation files
├── backend/             # Express API
│   ├── server.js        # entry point
│   ├── app.js           # express app (routes, middleware)
│   ├── config.js        # env validation
│   ├── routes/          # auth, oauth, user/admin, scan
│   ├── services/        # scanner (jobs), analysis (image), videoAnalysis, audioAnalysis,
│   │                    # media (ffmpeg), verdict, sightengine, deepseek, oauth, auth
│   ├── lib/             # job worker, upload storage, errors
│   ├── db/              # drizzle schema, migrations, repositories
│   ├── scripts/         # migrate-json.js (legacy data import)
│   └── tests/           # vitest + supertest
└── .github/workflows/   # CI: lint, test, build
```

## Running locally

Frontend:

```bash
npm install
npm run dev          # http://localhost:5173
```

Backend:

```bash
cd backend
cp .env.example .env # fill in SIGHTENGINE_USER / SIGHTENGINE_SECRET at minimum
npm install
npm run dev          # http://localhost:3001
```

Without `DATABASE_URL` the backend uses an embedded Postgres (PGlite) stored in
`backend/data/`, so no database setup is needed for development.

## Scripts

| Command (root)   | What it does                |
| ---------------- | --------------------------- |
| `npm run dev`    | Vite dev server             |
| `npm run build`  | Production build to `dist/` |
| `npm run lint`   | ESLint (frontend + backend) |
| `npm run format` | Prettier                    |
| `npm test`       | Frontend unit tests         |

| Command (`backend/`)     | What it does                              |
| ------------------------ | ----------------------------------------- |
| `npm run dev`            | API with auto-reload                      |
| `npm test`               | API tests (in-memory database)            |
| `npm run db:generate`    | Generate a migration after editing schema |
| `npm run db:import-json` | Import a legacy `verifeye-data.json`      |

## Deployment

- **Frontend:** Vercel. Set `VITE_API_URL` to the API URL.
- **Backend:** Render (or any Node host). Required env vars: `JWT_SECRET`,
  `DATABASE_URL` (Postgres; Neon/Supabase/Render Postgres), `FRONTEND_URL`,
  `API_BASE`, `SIGHTENGINE_USER`, `SIGHTENGINE_SECRET`. See
  `backend/.env.example` for the full list. The server refuses to start in
  production without `JWT_SECRET` and `DATABASE_URL`.
- Migrations run automatically on start.

### Migrating from the old JSON database

```bash
cd backend
DATABASE_URL=postgres://... ADMIN_EMAILS=andrei@test.test,inta@test.test npm run db:import-json -- path/to/verifeye-data.json
```

## API overview

| Method | Path                         | Auth  | Description                                    |
| ------ | ---------------------------- | ----- | ---------------------------------------------- |
| GET    | `/api/health`                | –     | Liveness                                       |
| POST   | `/api/auth/register`         | –     | `{ email, password }` (min 8 chars)            |
| POST   | `/api/auth/login`            | –     | `{ email, password }` → `{ token, user }`      |
| POST   | `/api/auth/change-password`  | user  |                                                |
| DELETE | `/api/auth/delete-account`   | user  |                                                |
| GET    | `/api/auth/google`, `/apple` | –     | OAuth redirects                                |
| GET    | `/api/me`                    | user  | Current user                                   |
| GET    | `/api/history`               | user  | Scan history                                   |
| POST   | `/api/analyze`               | user  | multipart `file` (image), `models`, `language` |
| POST   | `/api/admin/credits`         | admin | `{ email, credits }`                           |
| POST   | `/api/admin/tier`            | admin | `{ email, tier }`                              |

### How a scan works

1. `POST /api/scans` validates the file (type is detected from the bytes), charges
   one credit per model and queues a job. The upload is kept on disk only while
   the job runs.
2. An in-process worker picks the job up (`lib/jobs.js`, Postgres row locking):
   - **image** → Sightengine image models (`genai`, `deepfake`, `type`, `quality`)
   - **video** → ffmpeg samples up to 10 frames across the clip → image models per
     frame (score = mean of the strongest quarter of frames); optional `ai_speech`
     on the audio track (first 60 s)
   - **audio** → converted to 16 kHz WAV → Sightengine `ai_speech`
3. The result is a three-band verdict (`likely_real` / `inconclusive` /
   `likely_ai`) with a confidence that drops for screenshots, few or
   disagreeing frames and beta models. Results are cached per file hash.
4. `GET /api/scans/:id` returns progress (`stage`, `progress`) and the result.

Limits: images 25 MB, audio 50 MB / 10 min, video 100 MB / 10 min.
`ai_speech` is a Sightengine beta model that must be enabled on the account;
when it is not, the audio part is skipped and its credit refunded.

Admins are the accounts listed in `ADMIN_EMAILS` (the two existing admin accounts are the default in `.env.example`; set the same value on the server). Each scan costs one credit per
model; admins and `elite` accounts are not charged.
