import axios from 'axios';
import { config } from '../config/env';

export const fredSeries = [
  { id: 'CPIAUCSL', name: 'Consumer Price Index', unit: 'Index (1982–84=100)' },
  { id: 'CPILFESL', name: 'Core CPI', unit: 'Index (1982–84=100)' },
  { id: 'UNRATE', name: 'Unemployment Rate', unit: 'Percent' },
  { id: 'GDP', name: 'Gross Domestic Product', unit: 'Billions of dollars' },
  { id: 'FEDFUNDS', name: 'Federal Funds Rate', unit: 'Percent' },
  { id: 'DGS10', name: '10-Year Treasury Yield', unit: 'Percent' },
  { id: 'DGS2', name: '2-Year Treasury Yield', unit: 'Percent' },
] as const;

type FredObservation = { date: string; value: string };

export async function getEconomicOverview() {
  if (!config.fred.apiKey) throw new Error('FRED is not configured. Add FRED_API_KEY to the root .env file.');

  return Promise.all(fredSeries.map(async (series) => {
    try {
      const { data } = await axios.get<{ observations: FredObservation[] }>(
        `${config.fred.baseUrl}/series/observations`,
        {
          params: {
            series_id: series.id,
            api_key: config.fred.apiKey,
            file_type: 'json',
            sort_order: 'desc',
            limit: 2,
          },
          timeout: 12000,
        },
      );
      const observations = (data.observations ?? []).filter((item) => item.value !== '.');
      const latest = observations[0];
      const previous = observations[1];
      return {
        ...series,
        latest: latest ? Number(latest.value) : null,
        previous: previous ? Number(previous.value) : null,
        date: latest?.date ?? null,
      };
    } catch {
      return { ...series, latest: null, previous: null, date: null, unavailable: true };
    }
  }));
}
