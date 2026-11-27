# GenPrep — website

React 19 + Vite + Tailwind 4. See the main README one folder up for the project layout, setup and deploy steps.

```
npm install
npm run dev     # http://localhost:5173
npm run build   # must pass before pushing
```

API calls go to `/api` — in development Vite forwards them to the server, on Vercel `vercel.json` forwards them to the API.
