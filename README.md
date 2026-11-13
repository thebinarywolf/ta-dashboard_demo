# TA Dashboard — Showcase

A Talent Acquisition analytics dashboard: hiring pipeline, recruiter performance,
sources, funnel, attrition and people-cost views, with role-based access.

This copy runs on **made-up data** (generated on start-up, nothing real), so it can be
shown publicly. It opens straight into the dashboard as a demo admin — there is no
sign-in — and every tab works as it does in the full product.

**Stack:** Next.js 14 (App Router) · TypeScript · React 18 · Tailwind CSS · Recharts.
The full product also uses Supabase (Postgres, Auth, row-level security) and reads
Google Sheets and an HR system on a schedule; those connectors are in the code but are
switched off here.

## Tabs

| Tab | What it shows |
|---|---|
| Positions | Created / closed / open positions, pipeline, time against target, hot positions |
| Attrition | Who left, how soon, why, by department and place; employees, interns and consultants separately |
| Attrition Insights | The same analysis drawn as infographics |
| Recruiters / Recruiters Insights | Positions closed, interviews and selections per recruiter |
| Sources | Where candidates come from and which sources convert |
| Dropouts · Funnel · Report | Offer drop-outs, the hiring funnel, a printable hiring report |
| Financials | People cost and headcount by month, other costs, forecast, project planner, Excel export |
| Admin | User approval, roles, per-role tab access, hot positions |

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000 (or `npm run showcase` for port 3300).

## Host it on Vercel

1. Put this folder in a GitHub repo.
2. In Vercel: **Add New → Project**, import the repo, click **Deploy**.
   No environment variables are needed.
3. If the build complains about `node:sqlite`, set **Settings → General → Node.js Version**
   to 22.x or 24.x and redeploy.

## Where the demo data comes from

`lib/showcase/generate.ts` builds about 170 positions, 2,300 interview rounds, 600 people
with exit reasons and two years of finance figures into an in-memory database when the
server starts. It uses a fixed seed (the same data every time) and dates counted back from
today (it always looks current). Edit the counts, names and lists at the top of that file
to change it; restart to see the result.

`lib/showcase/flag.ts` holds the switch and the demo admin. Sync is disabled, and the
Supabase / Google / HR-system settings are ignored.
