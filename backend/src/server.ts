import express from 'express';
import cors from 'cors';
import { config } from './config/env';
import economyRoutes from './routes/economyRoutes';
import stockRoutes from './routes/stockRoutes';

const app = express();
app.use(cors({ origin: config.frontendUrl }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', name: 'Quanticulus API' });
});
app.use('/api/economy', economyRoutes);
app.use('/api/stocks', stockRoutes);

app.listen(config.port, () => {
  console.log(`Quanticulus API listening on port ${config.port}`);
});
