import { askForJson } from '../lib/claude.js';
import { applyCors, readJsonBody, fail } from '../lib/http.js';

export const config = { maxDuration: 60 };

const SCHEMA = {
  type: 'object',
  properties: {
    needMoreInfo: {
      type: 'boolean',
      description:
        'True when the request cannot be turned into a safe, specific guide yet — ' +
        'usually because no vehicle was named at all, or the problem is too vague to ' +
        'act on. When true, leave steps empty and put the question in "question".',
    },
    question: {
      type: 'string',
      description:
        'One short, friendly question asking for exactly what is missing, or an empty ' +
        'string. Ask for one thing at a time.',
    },
    vehicle: {
      type: 'string',
      description:
        'The vehicle you understood, tidied up, e.g. "2014 Honda Civic". Empty string ' +
        'if none was given.',
    },
    repair: {
      type: 'string',
      description:
        'The job you understood, as a short action phrase, e.g. "Replace the front ' +
        'brake pads". If the person described a symptom rather than a job, this is the ' +
        'repair you concluded they need.',
    },
    assumption: {
      type: 'string',
      description:
        'If you had to assume something the person did not say — a likely cause from a ' +
        'symptom, a trim, an engine, or which end of the car — state it in one sentence ' +
        'so they can correct you. Otherwise an empty string.',
    },
    difficulty: { type: 'string', enum: ['easy', 'moderate', 'hard'] },
    estimatedMinutes: { type: 'integer' },
    toolsNeeded: { type: 'array', items: { type: 'string' } },
    safetyWarnings: { type: 'array', items: { type: 'string' } },
    searchQueries: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Two or three YouTube search phrases a person would actually type to find ' +
        'a video of this exact job on this exact vehicle.',
    },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          number: { type: 'integer' },
          title: { type: 'string', description: 'Short action, e.g. "Remove the caliper bolts".' },
          detail: {
            type: 'string',
            description:
              'Two to five sentences telling the person exactly what to do, including ' +
              'torque specs or sizes when they are known for this vehicle.',
          },
          caution: {
            type: 'string',
            description: 'A safety or damage warning for this step, or an empty string.',
          },
          videoCue: {
            type: 'string',
            description:
              'What a mechanic would be SAYING or DOING on camera during this step. ' +
              'Used to find this moment inside a video transcript.',
          },
        },
        required: ['number', 'title', 'detail', 'caution', 'videoCue'],
        additionalProperties: false,
      },
    },
  },
  required: [
    'needMoreInfo',
    'question',
    'vehicle',
    'repair',
    'assumption',
    'difficulty',
    'estimatedMinutes',
    'toolsNeeded',
    'safetyWarnings',
    'searchQueries',
    'steps',
  ],
  additionalProperties: false,
};

const SYSTEM = `You are an experienced automotive technician. Someone types a single message
describing their car and what is wrong, in whatever words come naturally, and you turn it
into a repair guide for a competent DIYer working in their own driveway.

FIRST, work out two things from their message:
  - the vehicle
  - the job that actually needs doing

They may give you a clean description ("2014 Honda Civic, replace front brake pads") or a
symptom in plain language ("my civic squeals when I brake"). Both are fine. When they
describe a symptom, diagnose the most likely cause and write the guide for fixing that,
then say what you concluded in "assumption" so they can correct you.

Ask for more information ONLY when you genuinely cannot proceed:
  - No vehicle at all, and the job depends on knowing it -> ask which vehicle.
  - The problem is so vague that any guide would be a guess ("it makes a noise") -> ask
    one specific question that would narrow it down.
In that case set needMoreInfo true, put your question in "question", leave steps empty,
and do not invent a guide.

Do NOT ask when you can reasonably proceed. A missing year on a clearly named model is
not a blocker — write the guide, and note in "assumption" that specs vary by year. Being
useful matters more than being exhaustive.

WHEN YOU WRITE THE GUIDE:
- Write for the SPECIFIC vehicle. Use the real fastener sizes, torque specs and quirks
  for that year/make/model when you are confident of them. If a spec varies by trim or
  engine, say so in the step rather than inventing a number.
- Between 5 and 12 steps. Each step is one physical action, in the order it happens.
- Step 1 should always cover safety and preparation (parking, chocking, jacking,
  disconnecting the battery) when the job calls for it.
- Never skip a torque-critical or safety-critical step to keep the list short.
- If the repair is genuinely unsafe to do at home, still write the guide but put a blunt
  warning in safetyWarnings.`;

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return fail(res, 405, 'Use POST.');

  try {
    const body = await readJsonBody(req);

    // The app sends one free-text message. The older four-field shape is still
    // accepted so existing scripts and saved requests keep working.
    const request =
      typeof body?.request === 'string' && body.request.trim()
        ? body.request.trim()
        : [body?.year, body?.make, body?.model, body?.repair].filter(Boolean).join(' ').trim();

    if (!request) {
      return fail(res, 400, 'Tell me what vehicle you have and what you need to do.');
    }
    if (request.length > 2000) {
      return fail(res, 400, 'That message is very long. Try describing the job in a sentence or two.');
    }

    const guide = await askForJson({
      system: SYSTEM,
      schema: SCHEMA,
      effort: 'medium',
      prompt: `The person typed:\n\n"""\n${request}\n"""\n\nWork out the vehicle and the job, then respond.`,
    });

    // If Claude asked a question, hand it straight back — the app will show it
    // rather than a half-built guide.
    if (guide.needMoreInfo || !guide.steps?.length) {
      return res.status(200).json({
        needMoreInfo: true,
        question:
          guide.question ||
          'I could not tell what vehicle this is. What year, make and model is it?',
        vehicle: guide.vehicle || '',
        repair: guide.repair || '',
      });
    }

    return res.status(200).json(guide);
  } catch (err) {
    console.error('guide error:', err);
    return fail(res, 500, err.message || 'Could not build the repair guide.');
  }
}
