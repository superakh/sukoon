/**
 * POST /api/translate — dynamic translation via MyMemory.
 *
 * Body: { text: string, from: string, to: string }
 * Returns: { translated: string }
 *
 * MyMemory is free and unauthenticated; we use it for occasional
 * dynamic strings the client didn't ship a translation for (mostly
 * error messages and Claude-generated content). The static UI is
 * translated at build time via client-side i18n, so this is a
 * low-traffic endpoint.
 *
 * No retry logic. If MyMemory is down for the ~8s our AbortController
 * will wait, we surface a 502 and the client falls back to the
 * untranslated source string — better than making the user wait 30s
 * for a message that was cosmetic anyway.
 */
import { Hono } from 'hono';

import type { Bindings } from '../types';

const translate = new Hono<{ Bindings: Bindings }>();

const MYMEMORY_URL = 'https://api.mymemory.translated.net/get';
const TIMEOUT_MS = 8_000;

interface TranslateBody {
  text?: unknown;
  from?: unknown;
  to?: unknown;
}

interface MyMemoryResponse {
  responseData?: {
    translatedText?: string;
  };
}

translate.post('/translate', async (c) => {
  let body: TranslateBody;
  try {
    const raw: unknown = await c.req.json();
    body =
      raw && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as TranslateBody)
        : {};
  } catch {
    body = {};
  }

  const { text, from, to } = body;

  if (
    typeof text !== 'string' ||
    text.length === 0 ||
    typeof from !== 'string' ||
    from.length === 0 ||
    typeof to !== 'string' ||
    to.length === 0
  ) {
    return c.json(
      { error: 'Missing required fields: text, from, to' },
      400,
    );
  }

  const url = `${MYMEMORY_URL}?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(`${from}|${to}`)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      console.error(`[Translate] MyMemory ${response.status}`);
      return c.json(
        { error: 'Translation service temporarily unavailable.' },
        502,
      );
    }

    const data = (await response.json()) as MyMemoryResponse;
    const translated = data.responseData?.translatedText ?? '';

    if (!translated) {
      return c.json({ error: 'No translation returned.' }, 500);
    }

    return c.json({ translated });
  } catch (err) {
    const reason =
      err instanceof Error && err.name === 'AbortError'
        ? 'timeout'
        : err instanceof Error
          ? err.message
          : 'unknown';
    console.error(`[Translate] ${reason}`);
    return c.json({ error: 'Translation failed. Please try again.' }, 500);
  } finally {
    clearTimeout(timeout);
  }
});

export default translate;
