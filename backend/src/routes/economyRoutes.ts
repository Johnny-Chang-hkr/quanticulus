import { Router } from 'express';
import axios from 'axios';
import { getEconomicOverview, getEconomicSeries, type FredFrequency } from '../services/fredService';

const router = Router();

router.get('/overview', async (_req, res) => {
  try {
    const result = await getEconomicOverview();
    res.json({ indicators: result.value, updatedAt: result.updatedAt });
  } catch (error) {
    res.status(503).json({ error: error instanceof Error ? error.message : 'Economic data is unavailable.' });
  }
});

router.get('/series/:seriesId', async (req, res) => {
  const { startDate, endDate, frequency = 'native' } = req.query;
  const isDate = (value: unknown): value is string => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  if (
    !isDate(startDate)
    || !isDate(endDate)
    || startDate > endDate
    || new Date(endDate).getTime() - new Date(startDate).getTime() > 5 * 366 * 24 * 60 * 60 * 1000
  ) {
    res.status(400).json({ error: 'Provide valid startDate and endDate values in YYYY-MM-DD format within a five-year range.' });
    return;
  }
  const frequencies: FredFrequency[] = ['native', 'd', 'w', 'm', 'q', 'a'];
  if (typeof frequency !== 'string' || !frequencies.includes(frequency as FredFrequency)) {
    res.status(400).json({ error: 'Frequency must be native, d, w, m, q, or a.' });
    return;
  }

  try {
    res.json(await getEconomicSeries(req.params.seriesId, startDate, endDate, frequency as FredFrequency));
  } catch (error) {
    const status = error instanceof Error && error.message.startsWith('Choose')
      ? 400
      : axios.isAxiosError(error) && error.code === 'ECONNABORTED' ? 504 : 502;
    res.status(status).json({ error: error instanceof Error ? error.message : 'Economic data is unavailable.' });
  }
});

export default router;
