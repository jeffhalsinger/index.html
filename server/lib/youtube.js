// Everything that talks to YouTube lives here.
//
// Two different sources of information are used, in order of preference:
//   1. Captions/transcript  - precise, gives us a timestamp for every sentence.
//   2. Chapters in the description - coarse, but comes from the official API
//      and always works.
// If neither is available we still return the video with no timeline, and the
// AI is told it has nothing to go on for that video.

const API = 'https://www.googleapis.com/youtube/v3';

// YouTube blocks obvious bots. A normal browser user-agent makes the caption
// request behave the same way it would in a browser.
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

async function fetchWithTimeout(url, options = {}, ms = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Search YouTube for repair videos and return rich metadata for the best
 * candidates. Throws only if the API key itself is broken or over quota —
 * anything else degrades to an empty list.
 */
export async function searchVideos(queries, apiKey, maxResults = 6) {
  const seen = new Map();

  for (const query of queries) {
    const url =
      `${API}/search?part=snippet&type=video&maxResults=${maxResults}` +
      `&videoEmbeddable=true&relevanceLanguage=en` +
      `&q=${encodeURIComponent(query)}&key=${apiKey}`;

    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      const body = await res.text();
      // 403 is almost always a bad key, a key with the API not enabled, or
      // exhausted daily quota. That is worth surfacing loudly.
      if (res.status === 403) {
        throw new Error(
          `YouTube rejected the request (403). Check that the YouTube Data API v3 ` +
            `is enabled for your key and that you are under the daily quota. ${body}`
        );
      }
      continue;
    }

    const data = await res.json();
    for (const item of data.items || []) {
      const id = item.id?.videoId;
      if (id && !seen.has(id)) {
        seen.set(id, { videoId: id, title: item.snippet?.title || '' });
      }
    }
  }

  if (seen.size === 0) return [];

  // A second call gets us the description (which is where chapters live) and
  // the duration, neither of which the search endpoint returns.
  const ids = [...seen.keys()].slice(0, 12);
  const detailsUrl =
    `${API}/videos?part=snippet,contentDetails,statistics` +
    `&id=${ids.join(',')}&key=${apiKey}`;

  const res = await fetchWithTimeout(detailsUrl);
  if (!res.ok) {
    // Fall back to the thinner search data rather than failing the request.
    return [...seen.values()].map((v) => ({
      ...v,
      description: '',
      durationSeconds: 0,
      channel: '',
      viewCount: 0,
    }));
  }

  const data = await res.json();
  return (data.items || []).map((item) => ({
    videoId: item.id,
    title: item.snippet?.title || '',
    description: item.snippet?.description || '',
    channel: item.snippet?.channelTitle || '',
    durationSeconds: parseIsoDuration(item.contentDetails?.duration),
    viewCount: Number(item.statistics?.viewCount || 0),
  }));
}

/** "PT12M34S" -> 754 */
export function parseIsoDuration(iso) {
  if (!iso) return 0;
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso);
  if (!m) return 0;
  return Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
}

/** "1:23" -> 83, "1:02:03" -> 3723 */
function timeToSeconds(text) {
  const parts = text.split(':').map(Number);
  if (parts.some(Number.isNaN)) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

/**
 * Many repair videos list chapters in the description:
 *   0:00 Intro
 *   2:34 Removing the caliper
 * This is a reliable fallback when captions are unavailable.
 */
export function parseChapters(description) {
  if (!description) return [];
  const chapters = [];

  for (const rawLine of description.split('\n')) {
    const line = rawLine.trim();
    // Timestamp at the start of the line, optionally wrapped in brackets.
    const match = /^[[(]?(\d{1,2}:\d{2}(?::\d{2})?)[\])]?[\s\-–—:.]*(.*)$/.exec(line);
    if (!match) continue;

    const seconds = timeToSeconds(match[1]);
    const label = match[2].trim();
    if (seconds === null || !label) continue;

    chapters.push({ start: seconds, text: label });
  }

  // A real chapter list starts at or near zero and has a few entries. One
  // stray timestamp in a paragraph of prose is not a chapter list.
  if (chapters.length < 3) return [];
  if (chapters[0].start > 60) return [];
  return chapters;
}

/**
 * Pull the caption track for a video by reading the watch page the same way a
 * browser does. This is an unofficial route — the official captions.download
 * endpoint only works for videos you own — so it is written to fail softly.
 * Returns [] whenever anything at all goes wrong.
 */
export async function fetchTranscript(videoId) {
  try {
    const res = await fetchWithTimeout(
      `https://www.youtube.com/watch?v=${videoId}&hl=en`,
      { headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en-US,en;q=0.9' } },
      8000
    );
    if (!res.ok) return [];
    const html = await res.text();

    const tracks = extractCaptionTracks(html);
    if (!tracks.length) return [];

    // Prefer a human-written English track; settle for auto-generated English;
    // settle again for whatever is first.
    const track =
      tracks.find((t) => t.languageCode?.startsWith('en') && t.kind !== 'asr') ||
      tracks.find((t) => t.languageCode?.startsWith('en')) ||
      tracks[0];
    if (!track?.baseUrl) return [];

    const capsRes = await fetchWithTimeout(
      `${track.baseUrl}&fmt=json3`,
      { headers: { 'User-Agent': BROWSER_UA } },
      8000
    );
    if (!capsRes.ok) return [];

    const caps = await capsRes.json();
    const cues = [];
    for (const event of caps.events || []) {
      if (!event.segs) continue;
      const text = event.segs
        .map((s) => s.utf8 || '')
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
      if (!text) continue;
      cues.push({ start: Math.round((event.tStartMs || 0) / 1000), text });
    }
    return cues;
  } catch {
    return [];
  }
}

function extractCaptionTracks(html) {
  // The watch page embeds a big JSON blob; captionTracks lives inside it.
  const marker = '"captionTracks":';
  const idx = html.indexOf(marker);
  if (idx === -1) return [];

  const start = html.indexOf('[', idx);
  if (start === -1) return [];

  // Walk forward counting brackets so we grab exactly the array, which may
  // contain nested objects.
  let depth = 0;
  for (let i = start; i < html.length; i++) {
    if (html[i] === '[') depth++;
    else if (html[i] === ']') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1));
        } catch {
          return [];
        }
      }
    }
  }
  return [];
}

/**
 * Turn raw caption cues into a compact timeline the AI can read without
 * blowing up the token budget: group cues into buckets of `bucketSeconds`
 * and cap the total number of lines.
 */
export function condenseTranscript(cues, bucketSeconds = 20, maxLines = 160) {
  if (!cues.length) return [];

  const buckets = new Map();
  for (const cue of cues) {
    const key = Math.floor(cue.start / bucketSeconds) * bucketSeconds;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(cue.text);
  }

  const lines = [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([start, texts]) => ({ start, text: texts.join(' ').slice(0, 400) }));

  if (lines.length <= maxLines) return lines;

  // Too long: widen the buckets and try again rather than truncating the end,
  // which would hide the second half of the video from the AI.
  return condenseTranscript(cues, bucketSeconds * 2, maxLines);
}

/**
 * Build the best timeline available for a video, and say which kind it is so
 * the AI knows how much to trust the timestamps.
 */
export async function buildVideoTimeline(video) {
  const cues = await fetchTranscript(video.videoId);
  if (cues.length) {
    return {
      ...video,
      timelineSource: 'transcript',
      timeline: condenseTranscript(cues),
    };
  }

  const chapters = parseChapters(video.description);
  if (chapters.length) {
    return { ...video, timelineSource: 'chapters', timeline: chapters };
  }

  return { ...video, timelineSource: 'none', timeline: [] };
}
