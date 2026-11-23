# Provider terms and deployment boundary

Reviewed on 2026-11-23 against the provider pages linked below. This is an implementation checklist, not legal advice; terms and plan permissions can change and must be rechecked before a release.

## FRED

- [FRED API Terms of Use](https://fred.stlouisfed.org/docs/api/terms_of_use.html)
- The FRED terms require the following notice to appear prominently in an application: “This product uses the FRED® API but is not endorsed or certified by the Federal Reserve Bank of St. Louis.” The dashboard displays this notice and links to the terms.
- FRED series may be owned by third parties. Check the notes and permissions for each selected series before uses beyond personal use; API availability does not grant the right to redistribute every series.
- Do not imply Federal Reserve Bank of St. Louis endorsement or use its logo.
- If the app is later offered to other users, review the FRED requirements for linking and user agreement to the terms, and provide an appropriate privacy policy if usage information is collected.

## Finnhub

- [Finnhub Terms of Service](https://finnhub.io/terms-of-service)
- The terms describe personal plans as personal-use only, restrict sharing/redistribution of data and derived results without written approval, and require data to be deleted if the subscription ends. Confirm that the account plan explicitly permits every endpoint and intended use.
- Docker Compose binds the UI to `127.0.0.1` and is intended for one authorized personal user. Do not expose it on a public or shared network. The app persists historical Finnhub candles in PostgreSQL for up to five years. Before a Finnhub subscription ends, remove the Compose database volume with `docker compose down -v`; this deletes all persisted market and FRED history. The project does not configure database backups.
- The configured account previously returned HTTP 403 for candles and timed out on news. These features surface provider errors and can use persisted candle history; successful live access has not been verified.

## Operational controls

- Provider keys stay in the ignored root `.env` and are passed to the backend at runtime.
- The API applies per-IP rate limiting and conservative process-wide provider request spacing, and caches quotes, profiles, macro series, candles, and news for short windows.
- Local rate limiting and caching do not override the provider's account-level limits or grant redistribution rights.
- Any multi-user, business, or public deployment is out of scope until the data licenses, endpoint entitlements, authentication, user terms, privacy policy, and data retention/deletion obligations are reviewed and authorized.
