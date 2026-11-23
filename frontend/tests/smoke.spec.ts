import { expect, test } from '@playwright/test';

test('API health and invalid ticker responses are available', async ({ request }) => {
  const health = await request.get('http://127.0.0.1:5000/api/health');
  await expect(health).toBeOK();
  await expect(health.json()).resolves.toMatchObject({
    status: 'ok',
    name: 'Quanticulus API',
  });

  const invalidTicker = await request.get(
    'http://127.0.0.1:5000/api/stocks/quote/INVALID%20TICKER',
  );
  expect(invalidTicker.status()).toBe(400);
  await expect(invalidTicker.json()).resolves.toMatchObject({
    error: 'Use a valid ticker symbol.',
  });

  const invalidRange = await request.get('http://127.0.0.1:5000/api/stocks/candles/SPY?range=10y');
  expect(invalidRange.status()).toBe(400);
  const inheritedRange = await request.get('http://127.0.0.1:5000/api/stocks/candles/SPY?range=toString');
  expect(inheritedRange.status()).toBe(400);

  const invalidDate = await request.get(
    'http://127.0.0.1:5000/api/economy/series/UNRATE?startDate=2026-02-31&endDate=2026-11-23',
  );
  expect(invalidDate.status()).toBe(400);

  const invalidWeights = await request.get(
    'http://127.0.0.1:5000/api/stocks/analysis/SPY?trendWeight=80&momentumWeight=80&volatilityWeight=0',
  );
  expect(invalidWeights.status()).toBe(400);

  const invalidSeries = await request.get(
    'http://127.0.0.1:5000/api/stocks/correlation/SPY?seriesId=NOT_A_FRED_SERIES',
  );
  expect(invalidSeries.status()).toBe(400);
});

test('dashboard renders data and company lookup results', async ({ page }) => {
  await page.route('**/api/economy/overview', (route) =>
    route.fulfill({
      json: {
        updatedAt: '2026-11-23T09:00:00.000Z',
        indicators: [
          {
            id: 'UNRATE',
            name: 'Unemployment Rate',
            unit: 'Percent',
            latest: 4.1,
            previous: 4,
            date: '2026-10-01',
          },
        ],
      },
    }),
  );
  await page.route('**/api/stocks/quotes', (route) =>
    route.fulfill({
      json: {
        updatedAt: '2026-11-23T09:01:00.000Z',
        quotes: [
          {
            symbol: 'SPY',
            price: 500,
            change: 2,
            changePercent: 0.4,
            high: 502,
            low: 497,
            timestamp: 1_794_000_000,
          },
        ],
      },
    }),
  );
  await page.route('**/api/stocks/candles/*', (route) =>
    route.fulfill({
      json: {
        symbol: 'SPY',
        updatedAt: '2026-11-23T09:02:00.000Z',
        candles: [{ date: '2026-11-20', close: 500 }],
      },
    }),
  );
  await page.route('**/api/stocks/news', (route) =>
    route.fulfill({
      json: {
        updatedAt: '2026-11-23T09:03:00.000Z',
        articles: [
          {
            headline: 'Smoke test market update',
            summary: 'A sample market update.',
            source: 'Test source',
            url: 'https://example.test/article',
            datetime: 1_794_000_000,
          },
        ],
      },
    }),
  );
  await page.route('**/api/stocks/profile/AAPL', (route) =>
    route.fulfill({
      json: {
        ticker: 'AAPL',
        name: 'Apple Inc.',
        exchange: 'NASDAQ',
        finnhubIndustry: 'Technology',
        weburl: 'https://www.apple.com',
        logo: '',
      },
    }),
  );
  await page.route('**/api/stocks/quote/AAPL', (route) =>
    route.fulfill({
      json: {
        symbol: 'AAPL',
        price: 200,
        change: 1,
        changePercent: 0.5,
        high: 201,
        low: 198,
        timestamp: 1_794_000_000,
      },
    }),
  );
  await page.route('**/api/stocks/analysis/SPY*', (route) =>
    route.fulfill({
      json: {
        symbol: 'SPY',
        source: 'Finnhub',
        stale: false,
        candles: [{ date: '2026-11-20', close: 500 }],
        analysis: {
          observations: [],
          latest: {
            date: '2026-11-20',
            close: 500,
            return20d: 1.5,
            movingAverage20: 495,
            movingAverage50: 490,
            annualizedVolatility20: 15,
          },
          condition: {
            score: 62.5,
            components: { trend: 61, momentum: 57.5, volatility: 70 },
            weights: { trend: 40, momentum: 35, volatility: 25 },
            methodology: 'Transparent test methodology.',
          },
        },
      },
    }),
  );
  await page.route('**/api/economy/series/UNRATE*', (route) =>
    route.fulfill({
      json: {
        id: 'UNRATE',
        name: 'Unemployment Rate',
        unit: 'Percent',
        frequency: 'native',
        updatedAt: '2026-11-23T09:05:00.000Z',
        observations: [{ date: '2026-10-01', value: 4.1 }],
      },
    }),
  );
  await page.route('**/api/stocks/forecast/SPY', (route) =>
    route.fulfill({
      json: {
        available: true,
        symbol: 'SPY',
        asOf: '2026-11-20',
        horizonTradingDays: 5,
        estimatePercent: 0.4,
        intervalPercent: { lower: -2, upper: 3, confidenceLevel: 90 },
        trainingObservations: 1000,
        evaluation: {
          method: 'Expanding-window walk-forward evaluation.',
          observations: 30,
          historicalPeriod: { start: '2025-08-01', end: '2026-11-20' },
          empiricalMedian: { meanAbsoluteError: 1.1, rootMeanSquaredError: 1.7 },
          zeroReturnBaseline: { meanAbsoluteError: 1.2, rootMeanSquaredError: 1.8 },
        },
        assumptions: ['Test forecast is not investment advice.'],
        source: 'Finnhub',
        stale: false,
      },
    }),
  );
  await page.route('**/api/stocks/correlation/SPY*', (route) =>
    route.fulfill({
      json: {
        series: { id: 'UNRATE', name: 'Unemployment Rate', unit: 'Percent' },
        correlation: {
          correlation: -0.25,
          sampleCount: 48,
          frequency: 'monthly',
          observations: [{ period: '2026-10', economicChange: 0.1, assetReturn: 0.4 }, { period: '2026-11', economicChange: -0.1, assetReturn: 0.2 }],
          method: 'Pearson correlation of consecutive aligned period changes.',
        },
        source: { prices: 'Finnhub', economics: 'FRED' },
        stale: false,
        updatedAt: { prices: '2026-11-23T09:00:00.000Z', economics: '2026-11-23T09:00:00.000Z' },
      },
    }),
  );

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Market intelligence' })).toBeVisible();
  await expect(page.getByText('SPY', { exact: true })).toBeVisible();
  await expect(page.getByText('Observed 2026-10-01 · Percent')).toBeVisible();
  await expect(page.getByText(/FRED · refreshed/)).toBeVisible();
  await expect(page.getByText(/^Latest observation 2026-11-20 · Refreshed/)).toBeVisible();
  await expect(page.getByText('Smoke test market update')).toBeVisible();
  await expect(page.getByRole('link', { name: 'FRED® API' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Finnhub terms' })).toBeVisible();

  await page.getByLabel('Ticker symbol').fill('AAPL');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByText('Apple Inc.')).toBeVisible();

  await page.getByRole('button', { name: 'Stock analysis' }).click();
  await page.getByLabel('Symbol').fill('BAD TICKER');
  await page.getByRole('button', { name: 'Load' }).click();
  await expect(page.getByRole('alert').getByText('Use a valid ticker symbol.')).toBeVisible();
  await page.getByLabel('Symbol').fill('SPY');
  await page.getByRole('button', { name: 'Load' }).click();
  await expect(page.getByText('62.5 / 100')).toBeVisible();
  await expect(page.getByText('20-observation return: 1.5%')).toBeVisible();
  await expect(page.getByText('Pearson r: -0.25 · 48 aligned monthly observations · Unemployment Rate · Sample window: 1y')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Unemployment Rate change versus SPY return scatter plot' })).toBeVisible();

  await page.getByRole('button', { name: 'Economic details' }).click();
  await expect(page.getByRole('heading', { name: 'Economic indicator details' })).toBeVisible();
  await expect(page.getByText('1 observations · Provider native monthly frequency.')).toBeVisible();

  await page.getByRole('button', { name: 'Forecast experiment' }).click();
  await expect(page.getByText('Five-trading-day return baseline')).toBeVisible();
  await expect(page.getByText('0.4%')).toBeVisible();
  await expect(page.getByRole('link', { name: 'FRED® API' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  const contentFitsViewport = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
  expect(contentFitsViewport).toBeTruthy();
});
