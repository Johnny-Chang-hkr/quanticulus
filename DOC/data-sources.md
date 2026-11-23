# Data sources

## FRED

The API requests each series from `/series/observations`, asks for JSON, and returns the latest two non-missing observations when available. The series ID, observation date, and unit are included in the response. The overview response also includes `updatedAt`, the time the backend completed the provider refresh. The dashboard displays both the observation date and unit, separately from the refresh time.

| Display name | Series ID | Unit |
| --- | --- | --- |
| Consumer Price Index | `CPIAUCSL` | Index (1982–84=100) |
| Core CPI | `CPILFESL` | Index (1982–84=100) |
| Unemployment Rate | `UNRATE` | Percent |
| Gross Domestic Product | `GDP` | Billions of dollars |
| Federal Funds Rate | `FEDFUNDS` | Percent |
| 10-Year Treasury Yield | `DGS10` | Percent |
| 2-Year Treasury Yield | `DGS2` | Percent |

The dashboard currently shows the latest level and change from the immediately preceding observation. These series have different frequencies, so changes should not be compared as if they covered the same time span. CPI levels are not inflation rates; calculate year-over-year inflation explicitly before labeling it as inflation.

## Finnhub

The dashboard requests quotes for `SPY`, `QQQ`, and `DIA`, one year of daily candles for `SPY`, and general news. The backend also exposes single-symbol quote and company profile routes for later UI work.

Quote timestamps are provider timestamps. Candle dates are normalized to UTC calendar dates. Quote, candle, and news collection responses include `updatedAt` for the backend refresh time; article dates remain provider publication times. The dashboard distinguishes observation or publication times from refresh times. Provider plan entitlements and delayed-data rules determine the actual coverage and update timing.

## Configuration and handling

Set `FRED_API_KEY`, `FRED_BASE_URL`, `FINNHUB_API_KEY`, and `FINNHUB_BASE_URL` in the root `.env`. Never put credentials in Vite `VITE_*` variables, source control, screenshots, or client-visible error details. The backend sends Finnhub credentials in a request header and sends the FRED key only in its server-to-server request.

Quotes are cached in process for one minute, profiles for one day, news for five minutes, and economic series for up to one hour (detail requests: 15 minutes). Candle responses are cached for 15 minutes. Provider requests are spaced conservatively in process; a per-IP API rate limit is also applied. These are safeguards, not replacements for provider-plan limits.

The correlation view groups Finnhub daily closes into monthly periods, except GDP which remains quarterly. It compares consecutive period market returns with FRED series changes and reports Pearson correlation and the matched observation count. Percent-unit indicators use percentage-point changes; other indicators use percentage changes. FRED observation dates are not release timestamps, so this is descriptive period alignment, not a leakage-safe forecast input.

When PostgreSQL is configured, daily FRED and Finnhub candle observations are upserted by series/symbol and date. The database retains at most five years and serves explicitly labeled saved candle data if Finnhub history cannot be fetched. Local development can omit PostgreSQL. Docker Compose includes a PostgreSQL service and named persistent volume.

## Current provider check

The local keys returned all seven configured FRED series, Finnhub quotes for SPY, QQQ, and DIA, and an AAPL quote and profile. Finnhub candle history returned a 403 response for both SPY and AAPL, and general news timed out during the current check. These failures can reflect provider entitlement or availability; confirm plan access before building on those endpoints. The app shows endpoint errors and leaves missing history or news blank.

See [provider terms and deployment boundary](./provider-terms.md) for the reviewed FRED and Finnhub terms, required notices, personal-use restriction, and data deletion requirements.

