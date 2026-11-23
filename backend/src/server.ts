import express from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { config } from './config/env';
import { closeDatabase, databaseStatus, initializeDatabase, query } from './services/database';
import economyRoutes from './routes/economyRoutes';
import stockRoutes from './routes/stockRoutes';

const app = express();
app.use(cors({ origin: config.frontendUrl }));
app.use(express.json());
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 180,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
}));
app.use('/api', (req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    console.log(JSON.stringify({
      level: res.statusCode >= 500 ? 'error' : 'info',
      event: 'http_request',
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
    }));
  });
  next();
});

app.get('/api/health', async (_req, res) => {
  let databaseReachable = false;
  const databaseConfigured = databaseStatus().configured;
  if (databaseConfigured) {
    try {
      await query('SELECT 1');
      databaseReachable = true;
    } catch (error) {
      console.error(JSON.stringify({
        level: 'error',
        event: 'database_health_check_failed',
        message: error instanceof Error ? error.message : 'Database query failed',
      }));
    }
  }
  const ready = !databaseConfigured || databaseReachable;
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ok' : 'degraded',
    name: 'Quanticulus API',
    providers: {
      fred: { configured: Boolean(config.fred.apiKey) },
      finnhub: { configured: Boolean(config.finnhub.apiKey) },
    },
    database: { configured: databaseConfigured, reachable: databaseReachable },
  });
});
app.use('/api/economy', economyRoutes);
app.use('/api/stocks', stockRoutes);

async function start() {
  await initializeDatabase();
  const server = app.listen(config.port, () => {
    console.log(JSON.stringify({
      level: 'info',
      event: 'server_started',
      port: config.port,
      environment: config.nodeEnv,
    }));
  });
  const shutdown = () => {
    server.close(() => {
      void closeDatabase().then(() => process.exit(0)).catch((error: unknown) => {
        console.error(JSON.stringify({
          level: 'error',
          event: 'database_shutdown_failed',
          message: error instanceof Error ? error.message : 'Database shutdown failed',
        }));
        process.exit(1);
      });
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

void start().catch((error: unknown) => {
  console.error(JSON.stringify({
    level: 'error',
    event: 'server_start_failed',
    message: error instanceof Error && error.message
      ? error.message
      : 'Server startup failed; verify DATABASE_URL and PostgreSQL availability.',
  }));
  void closeDatabase().finally(() => process.exit(1));
});
