/**
 * Crisis trigger-word detector — Cloudflare Worker port of
 * `routes/crisis.js`. Conservative substring matcher used by the chat
 * and routing surfaces to decide when to surface helplines.
 *
 * Cultural specificity: includes Hindi/Urdu transliterations commonly
 * typed by Indian users in Roman script. Sukoon is India-first, so the
 * region map defaults English speakers to Indian helplines and only
 * falls through to US/UK when the explicit locale demands it.
 *
 * Tiers mirror the existing chat safety override:
 *   1 — passive ideation
 *   2 — active ideation
 *   3 — imminent danger / overdose / specific method
 */

import type { ChatMessage } from '../types';

// ── Trigger substrings ────────────────────────────────────────────────
// Verbatim from routes/crisis.js — do NOT edit without a review pass.

export const TIER_3: readonly string[] = [
  'i have a plan', 'tonight i will', 'taking pills', 'overdose', 'overdosing',
  'jump off', 'jumping off', 'hanging myself', 'noose',
  'phasi', 'phaansi', 'phaasi'
];

export const TIER_2: readonly string[] = [
  'kill myself', 'killing myself', 'kms', 'end my life', 'ending my life',
  'take my own life', 'commit suicide', 'i want to die', 'wanna die',
  'want to die', 'apni jaan', 'khud ko maar', 'khud-kushi', 'khudkushi',
  'atmahatya', 'aatmahatya'
];

export const TIER_1: readonly string[] = [
  "don't want to exist", 'do not want to exist', 'wish i was dead',
  'wish i were dead', "wouldn't wake up", 'would not wake up',
  'tired of living', 'no point in living', "can't go on", 'cannot go on',
  'jeena nahi', 'nahi jeena', 'jeene ka mann nahi'
];

export const NSSI_LIST: readonly string[] = [
  'cut myself', 'cutting myself', 'burning myself', 'hitting myself',
  'self harm', 'self-harm'
];

// ── Scanning ──────────────────────────────────────────────────────────

export type ScanTier = 1 | 2 | 3 | null;

export interface ScanResult {
  hit: boolean;
  tier: ScanTier;
  terms: string[];
  nssi: boolean;
}

/**
 * Normalize input the same way the Node route does: lower-case, strip
 * zero-width joiners, drop emoji/punctuation (keeping apostrophe and
 * hyphen so "don't" and "self-harm" still match), collapse whitespace.
 */
function normalize(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/[​-‏]/g, '')          // zero-widths
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')      // strip emoji/punct except '-
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Scan text for crisis trigger substrings. Higher tiers win — a Tier 3
 * hit suppresses the Tier 2/1 terms so the caller can route on the most
 * urgent signal without noise.
 */
export function scan(text: string): ScanResult {
  const n = normalize(text);
  if (!n) return { hit: false, tier: null, terms: [], nssi: false };

  const terms: string[] = [];
  let tier: ScanTier = null;

  for (const t of TIER_3) if (n.includes(t)) { terms.push(t); tier = 3; }
  if (tier !== 3) {
    for (const t of TIER_2) if (n.includes(t)) { terms.push(t); tier = 2; }
  }
  if (tier === null) {
    for (const t of TIER_1) if (n.includes(t)) { terms.push(t); tier = 1; }
  }

  const nssi = NSSI_LIST.some(t => n.includes(t));

  return { hit: terms.length > 0 || nssi, tier, terms, nssi };
}

/**
 * Return the text of the most recent user turn in a transcript, or an
 * empty string if none exists.
 */
export function lastUserText(messages: ChatMessage[]): string {
  if (!Array.isArray(messages)) return '';
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m && m.role === 'user' && typeof m.content === 'string') return m.content;
  }
  return '';
}

// ── Helplines ─────────────────────────────────────────────────────────
// Sukoon is India-first. Every South-Asian language — and unqualified
// English — resolves to "IN". US / UK are only reached when the caller
// passes an explicit `locale` of `en-US` / `en-GB`.

export type Region = 'IN' | 'US' | 'UK' | 'INTL';

export const REGION_BY_LANG: Readonly<Record<string, Region>> = {
  en: 'IN',
  hi: 'IN',
  ur: 'IN',
  pa: 'IN',
  bn: 'IN',
  ta: 'IN',
  te: 'IN',
  mr: 'IN'
};

export const HELPLINES: Readonly<Record<Region, string>> = {
  IN: 'India: iCall +91 9152987821 • Vandrevala 1860-2662-345 • AASRA +91 9820466726',
  US: 'US: 988 Suicide & Crisis Lifeline (call or text 988)',
  UK: 'UK: Samaritans 116 123',
  INTL: 'International: find a local helpline at iasp.info'
};

/**
 * Resolve a language + optional locale to a helpline string.
 *
 * Precedence:
 *   1. Explicit locale of `en-US` or `en-GB` overrides everything.
 *   2. The lang code is looked up in REGION_BY_LANG.
 *   3. Unknown languages fall back to the international helpline.
 *
 * Bare "en" resolves to IN — this is the India-first default the whole
 * product is built around and must not silently regress.
 */
export function helplinesFor(
  lang: string,
  opts?: { locale?: string }
): string {
  const locale = opts?.locale?.toLowerCase();
  if (locale === 'en-us') return HELPLINES.US;
  if (locale === 'en-gb') return HELPLINES.UK;

  const key = String(lang || '').toLowerCase();
  const region: Region = REGION_BY_LANG[key] ?? 'INTL';
  return HELPLINES[region];
}
