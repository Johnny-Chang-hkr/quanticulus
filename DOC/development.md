# Development guide

## Prerequisites

- Node.js 18+ and npm.
- Python 3.10+ only for the planned analytics code.
- A FRED API key and Finnhub API key for live provider data.
- PostgreSQL is not required by the current app; it is reserved for a future persistence phase.

## Environment

Use the root `.env` file for local secrets and configuration. `.env.example` lists the variable names and safe placeholders. The backend loads the root file itself. Do not prefix provider keys with `VITE_`.

## Install

From the project root, install each JavaScript application and the Python analytics requirements:

```powershell
cd backend
npm install
cd ../frontend
npm install
cd ..
python -m pip install -r analytics/requirements.txt
```

## Run locally

For an in-memory/no-database local run, leave `DATABASE_URL` unset. To persist local observations, run PostgreSQL and set `DATABASE_URL` to its connection string.

Start the backend in one terminal:

```powershell
cd backend
npm run dev
```

Start the frontend in another terminal:

```powershell
cd frontend
npm run dev
```

Open the Vite URL printed in the frontend terminal (normally `http://localhost:5173`). Vite proxies `/api` requests to `http://localhost:5000`.

## Build

```powershell
cd backend
npm run build
cd ../frontend
npm run build
```

## Smoke checks

Install the frontend dependencies, including the Playwright test runner, and install its Chromium browser once:

```powershell
cd frontend
npm install
npx playwright install chromium
npm test
```

The smoke suite starts the backend and frontend development servers, checks the API health and invalid-ticker responses, and verifies the dashboard and company lookup with provider data mocked in the browser.

## Local Docker deployment

1. Copy `.env.example` to `.env`, set FRED/Finnhub keys and replace the example PostgreSQL password with a strong local secret.
2. Start the stack with `docker compose up --build`.
3. Open `http://localhost:8080`. Compose binds the service to loopback only; do not publish it to a shared or public network.
4. Stop it with `docker compose down`. The named PostgreSQL volume is retained.

The backend runs the idempotent schema migration at startup and retains at most five years of daily candle/economic observations. Compose passes PostgreSQL connection settings as container environment variables; local Node development can instead use a local `DATABASE_URL`. API health reports provider configuration and PostgreSQL reachability. Docker health checks gate service startup.

The included deployment is for a single authorized personal user only. See [provider terms and deployment boundary](./provider-terms.md) before changing the network exposure or audience.

Before a Finnhub subscription ends, stop the stack and delete its database volume with `docker compose down -v`. This irreversibly deletes all saved market and FRED history; the project does not configure database backups.

## Troubleshooting

- `FRED is not configured` / `Finnhub is not configured`: confirm the corresponding variable is non-empty in the root `.env`, then restart the backend.
- A provider returns an error or empty panel: verify the key, network access, ticker support, and account plan entitlements. Keep the full provider key out of logs and bug reports.
- Port already in use: stop the existing process or change `PORT` (backend) and update the Vite proxy target.
