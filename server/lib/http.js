// Small helpers shared by the API endpoints.

/**
 * The phone app is not served from the same domain as this API, so the browser
 * layer inside React Native needs permissive CORS. Returns true if the request
 * was a preflight and has already been answered.
 */
export function applyCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

/** Vercel usually parses JSON for us, but not on every runtime path. */
export async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return null;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  }
}

/** One consistent error shape so the app always knows where to find the message. */
export function fail(res, status, message) {
  return res.status(status).json({ error: message });
}
