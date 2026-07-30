import Anthropic from '@anthropic-ai/sdk';

// Claude Opus 5 — the strongest model, which matters here because matching a
// repair step to the right moment in a video is genuinely fiddly reasoning.
export const MODEL = 'claude-opus-5';

let cached = null;
export function getClient() {
  if (!cached) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not set on the server.');
    }
    cached = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return cached;
}

/**
 * Ask Claude for a response that matches a JSON schema exactly, and hand back
 * the parsed object.
 *
 * Streaming is used internally purely so a long reply cannot trip an HTTP
 * timeout; the caller still gets a single finished object.
 */
export async function askForJson({ system, prompt, schema, maxTokens = 16000, effort = 'high' }) {
  const client = getClient();

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    output_config: {
      effort,
      format: { type: 'json_schema', schema },
    },
    messages: [{ role: 'user', content: prompt }],
  });

  const message = await stream.finalMessage();

  // Claude Opus 5 can decline a request outright. That arrives as a normal
  // successful response, so it has to be checked before reading the content.
  if (message.stop_reason === 'refusal') {
    throw new Error(
      'Claude declined to answer this request. Try rewording the repair description.'
    );
  }
  if (message.stop_reason === 'max_tokens') {
    throw new Error('Claude ran out of room before finishing. Try a simpler repair description.');
  }
  if (message.stop_reason === 'model_context_window_exceeded') {
    throw new Error(
      'Too much video transcript to read at once. Try a more specific repair description.'
    );
  }

  const text = message.content.find((block) => block.type === 'text')?.text;
  if (!text) throw new Error('Claude returned an empty response.');

  return JSON.parse(text);
}
