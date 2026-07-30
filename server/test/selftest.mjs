// Plain self-test for the parts of the backend that do not need API keys.
// Run with:  node test/selftest.mjs
//
// This is not a full test suite — it checks the fiddly parsing logic and the
// request validation, which are where silent bugs would hide.

import assert from 'node:assert/strict';
import { parseChapters, parseIsoDuration, condenseTranscript } from '../lib/youtube.js';

let passed = 0;
// Must be awaited, including for the async cases — otherwise a rejected
// assertion escapes the try/catch and the check reports a false pass.
async function check(name, fn) {
  try {
    await fn();
    console.log(`  ok  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL ${name}\n       ${err.message}`);
    process.exitCode = 1;
  }
}

console.log('\nparseIsoDuration');
await check('minutes and seconds', () => assert.equal(parseIsoDuration('PT12M34S'), 754));
await check('hours', () => assert.equal(parseIsoDuration('PT1H2M3S'), 3723));
await check('seconds only', () => assert.equal(parseIsoDuration('PT45S'), 45));
await check('missing input', () => assert.equal(parseIsoDuration(undefined), 0));

console.log('\nparseChapters');
await check('reads a normal chapter list', () => {
  const chapters = parseChapters(
    ['Intro text here', '0:00 Intro', '2:34 Removing the caliper', '10:05 Torque specs'].join('\n')
  );
  assert.equal(chapters.length, 3);
  assert.deepEqual(chapters[1], { start: 154, text: 'Removing the caliper' });
});
await check('handles hours and separators', () => {
  const chapters = parseChapters(['0:00 - Start', '1:02:03 — Reassembly', '5:00 : Middle'].join('\n'));
  assert.equal(chapters.length, 3);
  assert.equal(chapters[1].start, 3723);
  assert.equal(chapters[1].text, 'Reassembly');
});
await check('handles bracketed timestamps', () => {
  const chapters = parseChapters(['[0:00] Intro', '(1:30) Jack it up', '[3:00] Wheel off'].join('\n'));
  assert.equal(chapters.length, 3);
  assert.equal(chapters[1].start, 90);
});
await check('ignores a stray timestamp in prose', () => {
  assert.deepEqual(parseChapters('Check out my video at 4:30 for more info'), []);
});
await check('ignores a list that does not start near zero', () => {
  // Timestamps scattered late in a description are references, not chapters.
  assert.deepEqual(parseChapters(['12:00 thing', '14:00 other', '16:00 more'].join('\n')), []);
});
await check('empty description', () => assert.deepEqual(parseChapters(''), []));

console.log('\ncondenseTranscript');
await check('groups cues into buckets', () => {
  const cues = [
    { start: 0, text: 'hello' },
    { start: 5, text: 'there' },
    { start: 25, text: 'next bucket' },
  ];
  const lines = condenseTranscript(cues, 20, 100);
  assert.equal(lines.length, 2);
  assert.equal(lines[0].start, 0);
  assert.equal(lines[0].text, 'hello there');
  assert.equal(lines[1].start, 20);
});
await check('widens buckets instead of dropping the end of a long video', () => {
  // 600 cues one second apart = 10 minutes of dense speech.
  const cues = Array.from({ length: 600 }, (_, i) => ({ start: i, text: `word${i}` }));
  const lines = condenseTranscript(cues, 20, 40);
  assert.ok(lines.length <= 40, `expected <= 40 lines, got ${lines.length}`);
  // The important property: the tail of the video is still represented.
  assert.ok(lines[lines.length - 1].start > 400, 'the end of the video was lost');
});
await check('no cues', () => assert.deepEqual(condenseTranscript([]), []));

// --- request validation -----------------------------------------------------
// A tiny stand-in for the Vercel response object.
function fakeRes() {
  const res = {
    statusCode: null,
    body: null,
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    end() {
      return this;
    },
  };
  return res;
}

console.log('\nrequest validation');
const { default: guideHandler } = await import('../api/guide.js');
const { default: videosHandler } = await import('../api/videos.js');

await check('guide rejects an empty request', async () => {
  const res = fakeRes();
  await guideHandler({ method: 'POST', body: { request: '   ' } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /what vehicle/i);
});

await check('guide rejects a missing body', async () => {
  const res = fakeRes();
  await guideHandler({ method: 'POST', body: {} }, res);
  assert.equal(res.statusCode, 400);
});

await check('guide rejects an absurdly long request', async () => {
  const res = fakeRes();
  await guideHandler({ method: 'POST', body: { request: 'a'.repeat(2001) } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /very long/i);
});

await check('guide answers CORS preflight', async () => {
  const res = fakeRes();
  await guideHandler({ method: 'OPTIONS' }, res);
  assert.equal(res.statusCode, 204);
  assert.equal(res.headers['Access-Control-Allow-Origin'], '*');
});

await check('guide rejects GET', async () => {
  const res = fakeRes();
  await guideHandler({ method: 'GET', body: {} }, res);
  assert.equal(res.statusCode, 405);
});

await check('videos rejects a request with no steps', async () => {
  const res = fakeRes();
  await videosHandler({ method: 'POST', body: { vehicle: '2014 Honda Civic', repair: 'brakes' } }, res);
  assert.equal(res.statusCode, 400);
});

console.log(`\n${passed} checks passed.\n`);
