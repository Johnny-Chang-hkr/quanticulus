# Data sources

## FRED

The API requests each series from `/series/observations`, asks for JSON, and returns the latest two non-missing observations when available. The series ID and unit are included in the response.

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

Quote timestamps are provider timestamps. Candle dates are normalized to UTC calendar dates. Provider plan entitlements and delayed-data rules determine the actual coverage and update timing.

## Configuration and handling

Set `FRED_API_KEY`, `FRED_BASE_URL`, `FINNHUB_API_KEY`, and `FINNHUB_BASE_URL` in the root `.env`. Never put credentials in Vite `VITE_*` variables, source control, screenshots, or client-visible error details. The backend sends Finnhub credentials in a request header and sends the FRED key only in its server-to-server request.

No data is persisted or cached in the current implementation. Add caching only with freshness requirements and provider request limits in mind.

## Current provider check

The local keys returned all seven configured FRED series, Finnhub quotes for SPY, QQQ, and DIA, and an AAPL quote and profile. Finnhub candle history returned a 403 response for both SPY and AAPL, and general news timed out during the current check. These failures can reflect provider entitlement or availability; confirm plan access before building on those endpoints. The app shows endpoint errors and leaves missing history or news blank.

