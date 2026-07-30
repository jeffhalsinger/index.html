import { askForJson } from '../lib/claude.js';
import { applyCors, readJsonBody, fail } from '../lib/http.js';

export const config = { maxDuration: 60 };

const SCHEMA = {
  type: 'object',
  properties: {
    vehicle: { type: 'string' },
    repair: { type: 'string' },
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
    'vehicle',
    'repair',
    'difficulty',
    'estimatedMinutes',
    'toolsNeeded',
    'safetyWarnings',
    'searchQueries',
    'steps',
  ],
  additionalProperties: false,
};

const SYSTEM = `You are an experienced automotive technician writing a repair guide for a
competent DIYer working in their own driveway.

Rules:
- Write for the SPECIFIC vehicle given. Use the real fastener sizes, torque specs and
  quirks for that year/make/model when you are confident of them. If a spec varies by
  trim or engine, say so in the step rather than inventing a number.
- Between 5 and 12 steps. Each step is one physical action, in the order it happens.
- Step 1 should always cover safety and preparation (parking, chocking, jacking,
  disconnecting the battery) when the job calls for it.
- Never skip a torque-critical or safety-critical step to keep the list short.
- If the requested repair is genuinely unsafe to do at home, still write the guide but
  put a blunt warning in safetyWarnings.`;

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return fail(res, 405, 'Use POST.');

  try {
    const body = await readJsonBody(req);
    const { year, make, model, repair } = body || {};

    if (!year || !make || !model || !repair) {
      return fail(res, 400, 'Please fill in the year, make, model and the repair you want to do.');
    }

    const vehicle = `${year} ${make} ${model}`;
    const guide = await askForJson({
      system: SYSTEM,
      schema: SCHEMA,
      effort: 'medium',
      prompt:
        `Vehicle: ${vehicle}\n` +
        `Repair the owner wants to do: ${repair}\n\n` +
        `Write the step-by-step repair guide.`,
    });

    return res.status(200).json(guide);
  } catch (err) {
    console.error('guide error:', err);
    return fail(res, 500, err.message || 'Could not build the repair guide.');
  }
}
