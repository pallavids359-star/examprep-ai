# GenPrep

Exam preparation for **NEET, JEE and KCET** — practice, mock tests, live tests and lecturer assignments, with
admin, lecturer and student portals. Live at **https://www.genprep.online**.

## Folders

```
genprep/
├── client/                 React 19 + Vite + Tailwind 4 (the website)
│   ├── public/             logo and icons (sw.js only removes the old app worker from browsers)
│   └── src/
│       ├── api/            axios instance (all calls go to /api)
│       ├── components/     shared pieces (layouts, question cards, dialogs, wizard steps)
│       ├── content/        text: site details, user guides
│       ├── context/        login state (AuthContext), chosen exam (ExamContext)
│       ├── hooks/          test timer / session, anti-cheat
│       ├── pages/
│       │   ├── admin/      head lecturer: questions, tests, live tests, results, people
│       │   ├── lecturer/   assignments, picking live-test questions
│       │   ├── student/    dashboard, tests, results, analytics, revision
│       │   └── auth/       login, register, forgot password
│       └── utils/          small helpers (error reports, ripple, sheets)
├── server/                 Node + Express 5 + Mongoose (the API)
│   ├── config/             MongoDB, Cloudinary, Supabase sources
│   ├── controllers/        what each API route does
│   ├── middleware/         login check, roles, security headers, rate limits, uploads
│   ├── models/             MongoDB collections
│   ├── routes/             URL → controller
│   ├── utils/              scoring, live-test rules, Supabase sync, email
│   ├── scripts/            backup / restore, manual test scripts
│   ├── seed/               one-off admin scripts (create admin, load syllabus, fixes)
│   └── test/               automated tests (npm test)
├── api/index.js            runs the server as a Vercel function
├── supabase/setup.sql      Question Bank Portal setup
└── .github/workflows/      nightly Supabase sync, daily backup
```

## Run on your computer

```
cd server
copy .env.example .env      # then fill in the values
npm install
npm run dev                 # API on http://localhost:5000

cd ../client
npm install
npm run dev                 # website on http://localhost:5173 (calls the API through /api)
```

## Checks before pushing

```
cd server && npm test       # automated tests
cd client && npm run build  # the site must build without errors
```

## Deploy

| Part | Where | From |
|---|---|---|
| Website | Vercel project **genprep** → www.genprep.online | `manchestertechnologies-com/genprep`, folder `client` |
| API | Render `examprep-ai-1.onrender.com` (the site forwards `/api` there, see `client/vercel.json`) | `pallavids359-star/examprep-ai`, folder `server` |

Push both: `git push mt main` and `git push origin main`.
Secrets live only in `server/.env` (local) and the Render / Vercel environment settings — never in git.
See `server/.env.example` for the list.

## Roles

- **Admin (head lecturer)** — everything: questions, syllabus, mock and live tests, results, lecturers, students, app errors.
- **Lecturer** — assignments for their sections, picking questions for live-test subjects given to them.
- **Student** — practice, mock tests, live tests, assignments, results, analytics. Students never see other students' marks.

## Question Bank Portal sync

Questions come from the Supabase Question Bank Portal. The nightly GitHub Action (`.github/workflows/sync.yml`)
calls the API to copy new and changed questions; edits made in GenPrep are written back. Details: `SUPABASE_SYNC.md`.
GitHub secrets needed: `MONGO_URI`, `CRON_SECRET`, `SITE_URL`.
