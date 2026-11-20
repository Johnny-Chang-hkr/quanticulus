import { Router } from 'express';
import { getEconomicOverview } from '../services/fredService';

const router = Router();

router.get('/overview', async (_req, res) => {
  try {
    const indicators = await getEconomicOverview();
    res.json({ indicators, updatedAt: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ error: error instanceof Error ? error.message : 'Economic data is unavailable.' });
  }
});

export default router;
