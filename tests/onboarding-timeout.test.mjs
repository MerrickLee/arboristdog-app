import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withTimeout } from '../utils/withTimeout.ts';

test('returns a successful save result', async () => {
  assert.equal(await withTimeout(Promise.resolve('saved'), 100, 'Timed out'), 'saved');
});

test('preserves a failed save error', async () => {
  const failure = new Error('Permission denied');
  await assert.rejects(withTimeout(Promise.reject(failure), 100, 'Timed out'), failure);
});

test('bounds a stalled request and aborts it', async () => {
  const controller = new AbortController();
  await assert.rejects(withTimeout(new Promise(() => {}), 20, 'Save timed out', () => controller.abort()), /Save timed out/);
  assert.equal(controller.signal.aborted, true);
});

test('a completed save cancels its timeout without aborting it later', async () => {
  let aborted = false;
  await withTimeout(Promise.resolve('saved'), 20, 'Timed out', () => { aborted = true; });
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.equal(aborted, false);
});
