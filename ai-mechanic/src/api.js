// All communication with our own backend.
//
// The Anthropic and YouTube keys are NOT in this app. They live on the server,
// which is the whole reason the server exists. The app only knows the address
// of the server, which is public and harmless.

const BASE_URL = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/+$/, '');

export function isConfigured() {
  return BASE_URL.length > 0;
}

export function configHint() {
  return (
    'This app does not know where its server is yet.\n\n' +
    'Open eas.json, replace https://REPLACE-ME.vercel.app with your real server ' +
    'address, and build the app again.\n\n' +
    'See Part 4 of SETUP.md.'
  );
}

async function post(path, body, { timeoutMs = 120000 } = {}) {
  if (!BASE_URL) throw new Error(configHint());

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error('The server took too long to answer. Check your signal and try again.');
    }
    throw new Error(
      `Could not reach the server at ${BASE_URL}. Check your internet connection.`
    );
  }
  clearTimeout(timer);

  // Read as text first so a crashed server returning HTML gives a sane message
  // instead of a confusing JSON parse error.
  const raw = await res.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    throw new Error(`The server sent back something unexpected (status ${res.status}).`);
  }

  if (!res.ok) {
    throw new Error(data?.error || `The server returned an error (status ${res.status}).`);
  }
  return data;
}

/**
 * Step 1: turn whatever the person typed into a written guide.
 *
 * Two possible shapes come back:
 *   - a full guide, or
 *   - { needMoreInfo: true, question } when the request was too vague to act on.
 * The caller has to check for the second one.
 */
export function fetchGuide(request) {
  return post('/api/guide', { request });
}

/**
 * Step 2: find the best video moment for each step.
 *
 * This never throws for "no videos found" — that is a normal outcome and comes
 * back as matches with an empty videoId. It only throws if the request itself
 * failed, and even then the caller carries on with the written guide.
 */
export function fetchVideoMatches({ vehicle, repair, steps, searchQueries }) {
  return post('/api/videos', {
    vehicle,
    repair,
    searchQueries,
    steps: steps.map((s) => ({
      number: s.number,
      title: s.title,
      detail: s.detail,
      videoCue: s.videoCue,
    })),
  });
}
