import axios from 'axios';
import { config } from '../config/env';
import { cached, cachedValue } from './cache';
import { query } from './database';
import { waitForProviderSlot } from './providerThrottle';

export const fredSeries = [
  { id: 'CPIAUCSL', name: 'Consumer Price Index', unit: 'Index (1982-84=100)' },
  { id: 'CPILFESL', name: 'Core CPI', unit: 'Index (1982-84=100)' },
  { id: 'UNRATE', name: 'Unemployment Rate', unit: 'Percent' },
  { id: 'GDP', name: 'Gross Domestic Product', unit: 'Billions of dollars' },
  { id: 'FEDFUNDS', name: 'Federal Funds Rate', unit: 'Percent' },
  { id: 'DGS10', name: '10-Year Treasury Yield', unit: 'Percent' },
  { id: 'DGS2', name: '2-Year Treasury Yield', unit: 'Percent' },
] as const;

export type FredObservation = { date: string; value: string };
export type FredFrequency = 'native' | 'd' | 'w' | 'm' | 'q' | 'a';

function requireFredKey() {
  if (!config.fred.apiKey) throw new Error('FRED is not configured. Add FRED_API_KEY to the root .env file.');
  return config.fred.apiKey;
}

function seriesMetadata(seriesId: string) {
  return fredSeries.find((series) => series.id === seriesId);
}

async function storeObservations(
  seriesId: string,
  frequency: FredFrequency,
  observations: FredObservation[],
) {
  const validObservations = observations
    .map((observation) => ({ date: observation.date, value: Number(observation.value) }))
    .filter((observation) => Number.isFinite(observation.value));
  if (!validObservations.length) return;
  await query(
    `INSERT INTO economic_observations (series_id, frequency, observation_date, value)
     SELECT $1, $2, item.date, item.value
     FROM jsonb_to_recordset($3::jsonb) AS item(date DATE, value NUMERIC)
     ON CONFLICT (series_id, frequency, observation_date)
     DO UPDATE SET value = EXCLUDED.value, fetched_at = NOW()`,
    [seriesId, frequency, JSON.stringify(validObservations)],
  );
}

async function requestObservations(params: Record<string, string | number>) {
  await waitForProviderSlot('FRED');
  const { data } = await axios.get<{ observations: FredObservation[] }>(
    `${config.fred.baseUrl}/series/observations`,
    {
      params: {
        ...params,
        api_key: requireFredKey(),
        file_type: 'json',
      },
      timeout: 12000,
    },
  );
  return (data.observations ?? []).filter((item) => item.value !== '.');
}

export function getEconomicOverview() {
  return cachedValue('fred:overview', 60 * 60 * 1000, async () => {
    const indicators = await Promise.all(fredSeries.map(async (series) => {
      let observations: FredObservation[];
      try {
        observations = await requestObservations({
          series_id: series.id,
          sort_order: 'desc',
          limit: 2,
        });
      } catch (error) {
        console.warn(JSON.stringify({
          level: 'warn',
          event: 'provider_request_failed',
          provider: 'FRED',
          series: series.id,
          message: error instanceof Error ? error.message : 'Provider request failed',
        }));
        return { ...series, latest: null, previous: null, date: null, unavailable: true };
      }
      await storeObservations(series.id, 'native', observations);
      const latest = observations[0];
      const previous = observations[1];
      return {
        ...series,
        latest: latest ? Number(latest.value) : null,
        previous: previous ? Number(previous.value) : null,
        date: latest?.date ?? null,
      };
    }));
    return indicators;
  });
}

export function getEconomicSeries(
  seriesId: string,
  startDate: string,
  endDate: string,
  frequency: FredFrequency,
) {
  const metadata = seriesMetadata(seriesId);
  if (!metadata) throw new Error('Choose a supported economic series.');
  const cacheKey = `fred:series:${seriesId}:${startDate}:${endDate}:${frequency}`;
  return cached(cacheKey, 15 * 60 * 1000, async () => {
    const observations = await requestObservations({
      series_id: seriesId,
      observation_start: startDate,
      observation_end: endDate,
      sort_order: 'asc',
      ...(frequency === 'native' ? {} : { frequency, aggregation_method: 'avg' }),
    });
    await storeObservations(seriesId, frequency, observations);
    return {
      ...metadata,
      frequency,
      observations: observations.map((item) => ({ date: item.date, value: Number(item.value) })),
      updatedAt: new Date().toISOString(),
    };
  });
}
