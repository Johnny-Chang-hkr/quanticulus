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

## Troubleshooting

- `FRED is not configured` / `Finnhub is not configured`: confirm the corresponding variable is non-empty in the root `.env`, then restart the backend.
- A provider returns an error or empty panel: verify the key, network access, ticker support, and account plan entitlements. Keep the full provider key out of logs and bug reports.
- Port already in use: stop the existing process or change `PORT` (backend) and update the Vite proxy target.
