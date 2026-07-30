// Checks that a deployed server is alive and that both API keys work.
//
// Usage:
//   node test/ping.mjs https://your-project.vercel.app
//
// This exists instead of a curl command because quoting JSON on the command
// line behaves differently on Windows, macOS and Linux, and getting it wrong
// produces confusing errors.

const base = (process.argv[2] || '').replace(/\/+$/, '');

if (!base) {
  console.error('\nUsage: node test/ping.mjs https://your-project.vercel.app\n');
  process.exit(1);
}

const VEHICLE = { year: '2014', make: 'Honda', model: 'Civic', repair: 'replace front brake pads' };

/** Thrown when we could not talk to the server at all, as opposed to the
 *  server answering with an error. The two need different advice. */
class Unreachable extends Error {}

async function post(path, body) {
  let res;
  try {
    res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Unreachable(`could not connect to ${base} (${err.message})`);
  }
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Server did not return JSON (status ${res.status}):\n${text.slice(0, 300)}`);
  }
  if (!res.ok) throw new Error(data.error || `status ${res.status}`);
  return data;
}

/** Print advice that matches what actually went wrong. */
function explain(err, keyAdvice) {
  console.error(`     FAIL - ${err.message}`);
  if (err instanceof Unreachable) {
    console.error('\n     The address is wrong, or the server was never deployed.');
    console.error('     Check the address printed by:  npx vercel --prod\n');
  } else {
    console.error(`\n     Most likely cause: ${keyAdvice}`);
    console.error('     Fix it, then run:  npx vercel --prod\n');
  }
  process.exit(1);
}

console.log(`\nTesting ${base}\n`);

// --- Test 1: the repair guide (uses your Anthropic key) ---------------------
console.log('1/2  Asking for a repair guide (uses your Anthropic key)...');
let guide;
try {
  guide = await post('/api/guide', VEHICLE);
  console.log(`     PASS - got ${guide.steps.length} steps for "${guide.vehicle}"`);
  console.log(`     first step: ${guide.steps[0].title}`);
} catch (err) {
  explain(err, 'ANTHROPIC_API_KEY is missing, invalid, or has no credit.');
}

// --- Test 2: the video matching (uses your YouTube key) --------------------
console.log('\n2/2  Finding video clips for those steps (uses your YouTube key)...');
try {
  const result = await post('/api/videos', {
    vehicle: guide.vehicle,
    repair: guide.repair,
    searchQueries: guide.searchQueries,
    steps: guide.steps,
  });

  const withVideo = result.matches.filter((m) => m.videoId);
  console.log(`     searched ${result.videosSearched} videos`);
  console.log(`     matched ${withVideo.length} of ${result.matches.length} steps to a clip`);

  for (const m of result.matches) {
    const where = m.videoId ? `${m.videoId} @ ${m.startSeconds}s (${m.confidence})` : 'no clip';
    console.log(`       step ${m.stepNumber}: ${where}`);
  }

  if (withVideo.length === 0) {
    console.log('\n     WARNING - no clips matched.');
    console.log('     If videosSearched is 0, your YOUTUBE_API_KEY is wrong or the');
    console.log('     YouTube Data API v3 is not enabled for it.');
    console.log('     If videosSearched is above 0, the videos found had no captions');
    console.log('     or chapters. That is a normal outcome for some repairs.');
  } else {
    console.log('\n     PASS');
  }
} catch (err) {
  explain(err, 'YOUTUBE_API_KEY is missing, or the YouTube Data API v3 is not enabled for it.');
}

console.log('\nYour server is working. Put this address in ai-mechanic/eas.json:');
console.log(`  "EXPO_PUBLIC_API_URL": "${base}"\n`);
