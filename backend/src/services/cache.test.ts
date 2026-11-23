import assert from 'node:assert/strict';
import test from 'node:test';
import { cachedValue, clearCache } from './cache';

test('cache coalesces in-flight requests and preserves provider refresh time', async () => {
  clearCache();
  let requests = 0;
  const load = async () => {
    requests += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return { quotes: ['SPY'] };
  };
  const [first, concurrent] = await Promise.all([
    cachedValue('test:quotes', 1000, load),
    cachedValue('test:quotes', 1000, load),
  ]);
  const cachedResult = await cachedValue('test:quotes', 1000, load);

  assert.equal(requests, 1);
  assert.deepEqual(first.value, { quotes: ['SPY'] });
  assert.equal(first.updatedAt, concurrent.updatedAt);
  assert.equal(first.updatedAt, cachedResult.updatedAt);
});

test('cache does not retain failed provider requests', async () => {
  clearCache();
  let requests = 0;
  const load = async () => {
    requests += 1;
    throw new Error('provider unavailable');
  };

  await assert.rejects(cachedValue('test:failure', 1000, load), /provider unavailable/);
  await assert.rejects(cachedValue('test:failure', 1000, load), /provider unavailable/);
  assert.equal(requests, 2);
});
