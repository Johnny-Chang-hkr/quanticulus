import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getJson } from './api';

const StockDetailPage = lazy(() => import('./Details').then((module) => ({ default: module.StockDetailPage })));
const EconomicDetailPage = lazy(() => import('./Details').then((module) => ({ default: module.EconomicDetailPage })));
const ForecastPage = lazy(() => import('./Details').then((module) => ({ default: module.ForecastPage })));

type Indicator = {
  id: string;
  name: string;
  unit: string;
  latest: number | null;
  previous: number | null;
  date: string | null;
  unavailable?: boolean;
};
type Quote = {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  timestamp: number;
};
type Candle = { date: string; close: number };
type Article = { headline: string; summary: string; source: string; url: string; datetime: number };
type Company = { ticker: string; name: string; exchange: string; finnhubIndustry: string; weburl: string; logo: string };
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

function App() {
  const [page, setPage] = useState<'overview' | 'stock' | 'economy' | 'forecast'>('overview');
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTimes, setRefreshTimes] = useState<Record<string, string>>({});
  const [ticker, setTicker] = useState('AAPL');
  const [company, setCompany] = useState<Company | null>(null);
  const [companyQuote, setCompanyQuote] = useState<Quote | null>(null);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockError, setStockError] = useState('');

  async function searchStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const symbol = ticker.trim().toUpperCase();
    if (!symbol) return;
    setStockLoading(true);
    setStockError('');
    try {
      const [profile, quote] = await Promise.all([
        getJson<Company>(`/api/stocks/profile/${encodeURIComponent(symbol)}`),
        getJson<Quote>(`/api/stocks/quote/${encodeURIComponent(symbol)}`),
      ]);
      setCompany(profile);
      setCompanyQuote(quote);
    } catch (error) {
      setCompany(null);
      setCompanyQuote(null);
      setStockError(error instanceof Error ? error.message : 'Unable to load this symbol.');
    } finally {
      setStockLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    async function loadDashboard() {
      setLoading(true);
      setErrors([]);
      const tasks = [
        getJson<{ indicators: Indicator[]; updatedAt: string }>('/api/economy/overview').then((value) => {
          if (active) {
            setIndicators(value.indicators);
            setRefreshTimes((current) => ({ ...current, economy: value.updatedAt }));
          }
        }),
        getJson<{ quotes: Quote[]; updatedAt: string }>('/api/stocks/quotes').then((value) => {
          if (active) {
            setQuotes(value.quotes);
            setRefreshTimes((current) => ({ ...current, quotes: value.updatedAt }));
          }
        }),
        getJson<{ candles: Candle[]; updatedAt: string }>('/api/stocks/candles/SPY').then((value) => {
          if (active) {
            setCandles(value.candles);
            setRefreshTimes((current) => ({ ...current, candles: value.updatedAt }));
          }
        }),
        getJson<{ articles: Article[]; updatedAt: string }>('/api/stocks/news').then((value) => {
          if (active) {
            setArticles(value.articles);
            setRefreshTimes((current) => ({ ...current, news: value.updatedAt }));
          }
        }),
      ].map((task) => task.catch((error: Error) => {
        if (active) setErrors((current) => [...new Set([...current, error.message])]);
      }));
      await Promise.all(tasks);
      if (active) {
        setLoading(false);
      }
    }
    void loadDashboard();
    return () => { active = false; };
  }, []);

  return (
    <main className="min-h-screen bg-[#080d18] text-slate-100">
      <div className="mx-auto max-w-7xl px-5 py-7 sm:px-8 lg:py-10">
        <header className="flex flex-col justify-between gap-5 border-b border-slate-800 pb-7 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/10 text-xl font-bold text-cyan-300">Q</span>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">Quanticulus</p>
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">Market intelligence</h1>
            <p className="mt-2 text-sm text-slate-400">Macroeconomic signals and market movement, in one view.</p>
          </div>
          <div className="text-sm text-slate-500">Data sources update on different schedules</div>
        </header>

        <nav aria-label="Main navigation" className="mt-5 flex flex-wrap gap-2">
          {([
            ['overview', 'Overview'],
            ['stock', 'Stock analysis'],
            ['economy', 'Economic details'],
            ['forecast', 'Forecast experiment'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-current={page === id ? 'page' : undefined}
              onClick={() => setPage(id)}
              className={`rounded-lg px-3 py-2 text-sm ${page === id ? 'bg-cyan-300 text-slate-950' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'}`}
            >
              {label}
            </button>
          ))}
        </nav>
        <aside aria-label="FRED API attribution" className="mt-4 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm leading-relaxed text-slate-300">
          This product uses the <a className="font-medium text-cyan-300 underline" href="https://fred.stlouisfed.org/docs/api/terms_of_use.html" target="_blank" rel="noreferrer">FRED® API</a> but is not endorsed or certified by the Federal Reserve Bank of St. Louis.
        </aside>

        <Suspense fallback={<p role="status" className="mt-8 text-sm text-slate-400">Loading analysis view…</p>}>
          {page === 'stock' && <StockDetailPage />}
          {page === 'economy' && <EconomicDetailPage />}
          {page === 'forecast' && <ForecastPage />}
        </Suspense>

        {page === 'overview' && <>
        {errors.length > 0 && (
          <aside className="mt-6 rounded-xl border border-amber-400/20 bg-amber-300/5 px-4 py-3 text-sm text-amber-100">
            <p className="font-medium">Some data could not be loaded</p>
            <p className="mt-1 text-amber-100/70">{[...new Set(errors)].join(' · ')}</p>
          </aside>
        )}

        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <div><p className="section-kicker">Market snapshot</p><h2 className="section-title">Major ETFs</h2></div>
            <span className="text-xs text-slate-500">{refreshTimes.quotes ? `Finnhub · refreshed ${formatDateTime(refreshTimes.quotes)}` : 'Finnhub'}</span>
          </div>
          {quotes.length ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {quotes.map((quote) => <article className="panel" key={quote.symbol}>
                <div className="flex items-center justify-between"><span className="font-semibold">{quote.symbol}</span><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${quote.changePercent >= 0 ? 'bg-emerald-400/10 text-emerald-300' : 'bg-rose-400/10 text-rose-300'}`}>{quote.changePercent >= 0 ? '+' : ''}{number.format(quote.changePercent)}%</span></div>
                <p className="mt-5 text-3xl font-semibold tracking-tight">{money.format(quote.price)}</p>
                <p className={`mt-1 text-sm ${quote.change >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{quote.change >= 0 ? '+' : ''}{money.format(quote.change)} today</p>
                <p className="mt-4 border-t border-slate-800 pt-3 text-xs text-slate-500">Day range&nbsp; {money.format(quote.low)} – {money.format(quote.high)}</p>
                <p className="mt-2 text-xs text-slate-500">Quote as of {formatDateTime(quote.timestamp)}</p>
              </article>)}
            </div>
          ) : <LoadingPanel loading={loading} label="Waiting for Finnhub quotes" />}
        </section>

        <section className="mt-5">
          <article className="panel">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div><p className="section-kicker">Company lookup</p><h2 className="section-title">Explore a stock</h2></div>
              <form onSubmit={searchStock} className="flex gap-2">
                <label className="sr-only" htmlFor="ticker">Ticker symbol</label>
                <input id="ticker" value={ticker} onChange={(event) => setTicker(event.target.value.toUpperCase())} maxLength={12} className="w-28 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-cyan-400" placeholder="AAPL" />
                <button disabled={stockLoading} className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60">{stockLoading ? 'Loading…' : 'Search'}</button>
              </form>
            </div>
            {stockError && <p className="mt-4 text-sm text-amber-200">{stockError}</p>}
            {company && companyQuote && <div className="mt-5 flex flex-col justify-between gap-4 border-t border-slate-800 pt-5 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">{company.logo && <img src={company.logo} alt="" className="h-10 w-10 rounded-lg bg-white object-contain p-1" />}<div><p className="font-semibold">{company.name} <span className="text-slate-500">({company.ticker})</span></p><p className="mt-1 text-xs text-slate-500">{company.finnhubIndustry || 'Company profile'} · {company.exchange}</p></div></div>
              <div className="sm:text-right"><p className="text-2xl font-semibold">{money.format(companyQuote.price)}</p><p className={`mt-1 text-sm ${companyQuote.change >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{companyQuote.change >= 0 ? '+' : ''}{money.format(companyQuote.change)} ({number.format(companyQuote.changePercent)}%)</p><p className="mt-1 text-xs text-slate-500">Quote as of {formatDateTime(companyQuote.timestamp)}</p></div>
              {company.weburl && <a href={company.weburl} target="_blank" rel="noreferrer" className="text-sm text-cyan-300 hover:text-cyan-200">Company site ↗</a>}
            </div>}
          </article>
        </section>

        <section className="mt-9 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
          <article className="panel min-h-[340px]">
            <div className="mb-5 flex items-start justify-between"><div><p className="section-kicker">Price history</p><h2 className="section-title">SPY · 1 year</h2></div><span className="rounded-md bg-cyan-300/10 px-2 py-1 text-xs text-cyan-200">Daily close</span></div>
            {candles.length ? <>
              <p className="mb-2 text-xs text-slate-500">Latest observation {candles[candles.length - 1].date} · Refreshed {formatDateTime(refreshTimes.candles)}</p>
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={candles} margin={{ top: 8, right: 8, bottom: 0, left: -14 }}>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 5" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={42} tickFormatter={(value: string) => value.slice(5)} />
                    <YAxis domain={['auto', 'auto']} tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(value: number) => `$${value}`} />
                    <Tooltip contentStyle={{ background: '#101827', border: '1px solid #263449', borderRadius: 10 }} labelStyle={{ color: '#94a3b8' }} formatter={(value: number) => [money.format(value), 'Close']} />
                    <Line type="monotone" dataKey="close" stroke="#22d3ee" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#22d3ee' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </> : <LoadingPanel loading={loading} label="Loading historical prices" />}
          </article>

          <article className="panel">
            <div className="mb-5 flex items-start justify-between"><div><p className="section-kicker">Macro dashboard</p><h2 className="section-title">Economic indicators</h2></div><span className="text-xs text-slate-500">{refreshTimes.economy ? `FRED · refreshed ${formatDateTime(refreshTimes.economy)}` : 'FRED'}</span></div>
            <div className="space-y-1">
              {indicators.map((item) => <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 py-3 last:border-0" key={item.id}>
                <div className="min-w-0"><p className="truncate text-sm text-slate-200">{item.name}</p><p className="mt-0.5 text-xs text-slate-500">Observed {item.date ?? 'date unavailable'} · {item.unit}{item.unavailable ? ' · Provider unavailable' : ''}</p></div>
                <div className="shrink-0 text-right"><p className="text-sm font-medium">{item.latest === null ? '—' : number.format(item.latest)}{item.unit === 'Percent' ? '%' : ''}</p>{item.previous !== null && item.latest !== null && <p className={`text-xs ${item.latest >= item.previous ? 'text-amber-300' : 'text-emerald-300'}`}>{item.latest - item.previous >= 0 ? '+' : ''}{number.format(item.latest - item.previous)} vs prior</p>}</div>
              </div>)}
              {!indicators.length && <LoadingPanel loading={loading} label="Loading FRED observations" />}
            </div>
          </article>
        </section>

        <section className="mt-9">
          <div className="mb-4 flex items-center justify-between"><div><p className="section-kicker">Latest headlines</p><h2 className="section-title">Market news</h2></div><span className="text-xs text-slate-500">{refreshTimes.news ? `Finnhub · refreshed ${formatDateTime(refreshTimes.news)}` : 'Finnhub · General'}</span></div>
          {articles.length ? <div className="grid gap-3 md:grid-cols-2">
            {articles.slice(0, 6).map((article, index) => <a className="panel transition hover:border-slate-600" href={article.url} target="_blank" rel="noreferrer" key={`${article.datetime}-${index}`}>
              <p className="text-xs text-cyan-300">{article.source} · {new Date(article.datetime * 1000).toLocaleDateString()}</p>
              <h3 className="mt-2 font-medium leading-snug">{article.headline}</h3>
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-400">{article.summary}</p>
            </a>)}
          </div> : <LoadingPanel loading={loading} label="Loading market headlines" />}
        </section>

        </>}
        <footer className="mt-10 border-t border-slate-800 pt-5 text-xs leading-relaxed text-slate-500">
          <p>Data from FRED and Finnhub; releases and market prices update on different schedules. This dashboard is informational and does not provide investment advice or guaranteed predictions.</p>
          <p className="mt-2">Finnhub data is for authorized personal use only and is not redistributed. Review the <a className="underline hover:text-slate-300" href="https://finnhub.io/terms-of-service" target="_blank" rel="noreferrer">Finnhub terms</a> before use.</p>
        </footer>
      </div>
    </main>
  );
}

function LoadingPanel({ loading, label }: { loading: boolean; label: string }) {
  return <div className="rounded-lg border border-dashed border-slate-800 p-6 text-sm text-slate-500">{loading ? label : 'No data available. Check your API key and provider access.'}</div>;
}

function formatDateTime(value: string | number) {
  const date = new Date(typeof value === 'number' ? value * 1000 : value);
  return Number.isNaN(date.getTime())
    ? 'time unavailable'
    : new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export default App;


