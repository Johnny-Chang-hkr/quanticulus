const nextAllowedAt = new Map<string, number>();
const minimumIntervalMs: Record<string, number> = {
  FRED: 500,
  Finnhub: 200,
};

export async function waitForProviderSlot(provider: 'FRED' | 'Finnhub') {
  const now = Date.now();
  const nextAt = Math.max(now, nextAllowedAt.get(provider) ?? now);
  nextAllowedAt.set(provider, nextAt + minimumIntervalMs[provider]);
  const delay = nextAt - now;
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
}
