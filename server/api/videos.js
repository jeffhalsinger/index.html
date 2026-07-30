import { askForJson } from '../lib/claude.js';
import { searchVideos, buildVideoTimeline } from '../lib/youtube.js';
import { applyCors, readJsonBody, fail } from '../lib/http.js';

export const config = { maxDuration: 60 };

// How many videos we actually read in full. More videos means better matches
// but a slower, more expensive request; five is a good balance.
const MAX_VIDEOS_TO_ANALYSE = 5;

const SCHEMA = {
  type: 'object',
  properties: {
    matches: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          stepNumber: { type: 'integer' },
          videoId: {
            type: 'string',
            description:
              'The YouTube id of the best video for this step, or an empty string ' +
              'if no video covers this step well enough to be worth watching.',
          },
          startSeconds: {
            type: 'integer',
            description:
              'Where to start playing, in seconds. Start a few seconds BEFORE the ' +
              'action so the viewer catches the setup. 0 if there is no video.',
          },
          endSeconds: {
            type: 'integer',
            description:
              'Roughly where this step stops being covered, in seconds. Used only to ' +
              'show the clip length. 0 if there is no video.',
          },
          confidence: { type: 'string', enum: ['high', 'medium', 'low', 'none'] },
          note: {
            type: 'string',
            description:
              'One short sentence for the user about what this clip shows, or — when ' +
              'there is no video — why not.',
          },
        },
        required: ['stepNumber', 'videoId', 'startSeconds', 'endSeconds', 'confidence', 'note'],
        additionalProperties: false,
      },
    },
  },
  required: ['matches'],
  additionalProperties: false,
};

const SYSTEM = `You match written repair steps to the exact moment in a YouTube video where
that step is demonstrated.

You will be given repair steps and, for each candidate video, a timeline. A timeline is
either:
  - TRANSCRIPT: what is said, with the second it was said. Timestamps are precise.
  - CHAPTERS: the author's own chapter list. Timestamps are approximate section starts.
  - NONE: no timeline at all. You may only use such a video if its title is an
    overwhelmingly good match, and then only with confidence "low".

How to choose:
- Judge each step independently. Different steps may come from different videos — pick
  the video that shows THAT step best, not the video that is best overall.
- Prefer a video for the exact vehicle. A close relative (same platform or generation)
  is acceptable; a completely different vehicle is only acceptable when the procedure is
  genuinely identical, and then confidence is at most "medium".
- Set startSeconds 3-8 seconds before the action actually begins so the viewer sees the
  lead-in. Never point at the intro, the sponsor read, or the outro.
- A transcript that merely mentions a part in passing is NOT coverage. The mechanic has
  to be doing that step on camera.

Be honest. Returning videoId "" with confidence "none" is the correct answer whenever no
video genuinely covers a step — a wrong clip wastes the person's time while they are
under a car. Do not stretch a weak match to fill every step.

Return exactly one entry per step, in step order.`;

/** Render one video's timeline as compact text for the prompt. */
function renderVideo(video, index) {
  const header =
    `### VIDEO ${index + 1}\n` +
    `id: ${video.videoId}\n` +
    `title: ${video.title}\n` +
    `channel: ${video.channel}\n` +
    `length: ${video.durationSeconds}s\n` +
    `timeline type: ${video.timelineSource.toUpperCase()}\n`;

  if (!video.timeline.length) {
    return `${header}(no timeline available for this video)\n`;
  }

  const lines = video.timeline.map((entry) => `[${entry.start}s] ${entry.text}`).join('\n');
  return `${header}timeline:\n${lines}\n`;
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return fail(res, 405, 'Use POST.');

  try {
    const body = await readJsonBody(req);
    const { vehicle, repair, steps, searchQueries } = body || {};

    if (!vehicle || !repair || !Array.isArray(steps) || steps.length === 0) {
      return fail(res, 400, 'Missing the vehicle, the repair, or the list of steps.');
    }
    if (!process.env.YOUTUBE_API_KEY) {
      return fail(res, 500, 'YOUTUBE_API_KEY is not set on the server.');
    }

    // Always include an obvious query of our own alongside whatever the guide
    // step suggested, so a bad suggestion cannot sink the whole search.
    const queries = [
      `${vehicle} ${repair}`,
      ...(Array.isArray(searchQueries) ? searchQueries : []),
    ]
      .filter(Boolean)
      .slice(0, 3);

    const found = await searchVideos(queries, process.env.YOUTUBE_API_KEY);
    if (!found.length) {
      // Not an error — the app shows the written steps on their own.
      return res.status(200).json({
        matches: noVideoMatches(steps, 'No repair videos were found for this vehicle and job.'),
        videosSearched: 0,
      });
    }

    // Longer videos are usually full walkthroughs rather than 60-second clips,
    // and full walkthroughs are what cover every step.
    const ranked = found
      .filter((v) => v.durationSeconds === 0 || v.durationSeconds >= 120)
      .sort((a, b) => b.viewCount - a.viewCount)
      .slice(0, MAX_VIDEOS_TO_ANALYSE);

    const candidates = ranked.length ? ranked : found.slice(0, MAX_VIDEOS_TO_ANALYSE);

    // Fetching transcripts is the slow part — do them all at once.
    const analysed = await Promise.all(candidates.map(buildVideoTimeline));
    const usable = analysed.filter((v) => v.timeline.length > 0);

    if (!usable.length) {
      return res.status(200).json({
        matches: noVideoMatches(
          steps,
          'Videos were found, but none had captions or chapters to locate this step in.'
        ),
        videosSearched: analysed.length,
      });
    }

    const stepList = steps
      .map(
        (s) =>
          `Step ${s.number}: ${s.title}\n  what it involves: ${s.detail || ''}\n` +
          `  what it looks/sounds like on camera: ${s.videoCue || s.title}`
      )
      .join('\n\n');

    const result = await askForJson({
      system: SYSTEM,
      schema: SCHEMA,
      maxTokens: 16000,
      prompt:
        `VEHICLE: ${vehicle}\nREPAIR: ${repair}\n\n` +
        `## REPAIR STEPS TO MATCH\n${stepList}\n\n` +
        `## CANDIDATE VIDEOS\n${usable.map(renderVideo).join('\n')}`,
    });

    // Trust but verify: the model must not invent a video id, and timestamps
    // must land inside the video.
    const byId = new Map(usable.map((v) => [v.videoId, v]));
    const matches = steps.map((step) => {
      const raw = (result.matches || []).find((m) => m.stepNumber === step.number);
      if (!raw || !raw.videoId || !byId.has(raw.videoId)) {
        return blankMatch(step.number, raw?.note || 'No good video clip was found for this step.');
      }

      const video = byId.get(raw.videoId);
      const max = video.durationSeconds || Number.MAX_SAFE_INTEGER;
      const start = Math.max(0, Math.min(Number(raw.startSeconds) || 0, Math.max(0, max - 5)));

      return {
        stepNumber: step.number,
        videoId: raw.videoId,
        videoTitle: video.title,
        channel: video.channel,
        startSeconds: start,
        endSeconds: Math.max(start, Math.min(Number(raw.endSeconds) || 0, max)),
        confidence: raw.confidence || 'low',
        note: raw.note || '',
        timelineSource: video.timelineSource,
      };
    });

    return res.status(200).json({ matches, videosSearched: analysed.length });
  } catch (err) {
    console.error('videos error:', err);
    return fail(res, 500, err.message || 'Could not find video clips for these steps.');
  }
}

function blankMatch(stepNumber, note) {
  return {
    stepNumber,
    videoId: '',
    videoTitle: '',
    channel: '',
    startSeconds: 0,
    endSeconds: 0,
    confidence: 'none',
    note,
    timelineSource: 'none',
  };
}

function noVideoMatches(steps, note) {
  return steps.map((s) => blankMatch(s.number, note));
}
