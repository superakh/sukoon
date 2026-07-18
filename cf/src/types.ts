/**
 * Shared TypeScript types for the Sukoon Worker.
 *
 * Bindings mirror the resources declared in `wrangler.toml`. Runtime
 * types are kept intentionally small — the routes layer massages
 * D1/R2 rows into these shapes so the frontend can stay honest.
 */

export interface Bindings {
  /** D1 database holding the content library, transcripts, crisis log. */
  SUKOON_DB: D1Database;
  /** R2 bucket holding meditation/sleep-story audio and imagery. */
  SUKOON_ASSETS: R2Bucket;
  /** KV namespace used for edge rate-limit counters. */
  RATE_LIMIT: KVNamespace;
  /** Durable Object namespace for the live "pulse" counter. */
  PULSE: DurableObjectNamespace;

  /** Secrets — set via `wrangler secret put`. */
  ANTHROPIC_API_KEY: string;

  /** Public runtime config from [vars]. */
  CF_AI_GATEWAY_URL: string;
  NODE_ENV: string;
}

/**
 * A single item in the Sukoon content library — meditation, sleep
 * story, breathwork exercise, journaling prompt, etc.
 */
export interface LibraryItem {
  id: string;
  slug: string;
  kind: KindAlias;
  title: string;
  subtitle?: string;
  description?: string;
  duration_seconds: number;
  language: string;
  audio_key?: string;
  image_key?: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

/**
 * The "kind" of library item. Aliases exist so the frontend can use
 * friendly names while the DB stores a stable enum.
 */
export type KindAlias =
  | 'meditation'
  | 'sleep_story'
  | 'breathwork'
  | 'journal_prompt'
  | 'sound_bath'
  | 'movement'
  | 'talk';

/**
 * A single chat turn. `role` mirrors the Anthropic Messages API so we
 * can pass transcripts straight through.
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  ts?: number;
}

/**
 * Crisis routing tiers. Higher tier => more urgent human intervention.
 *   0 — no crisis signal detected
 *   1 — low: distress, offer grounding resources
 *   2 — moderate: strong distress, surface helplines gently
 *   3 — high: active suicidal ideation or acute risk, hard-route to
 *       iCall / Vandrevala / KIRAN + local emergency numbers
 */
export type CrisisTier = 0 | 1 | 2 | 3;

export interface CrisisSignal {
  tier: CrisisTier;
  matched: string[];
  ts: number;
}
