const INTENT_PREFIXES: RegExp[] = [
  /^i\s+(hope|want|need|wish)\s+(to\s+)?(buy|get|find|purchase|pick\s+up|order|grab)\s+(some\s+|a\s+|a\s+couple\s+of\s+|a\s+few\s+)?/i,
  /^i\s+(hope|want|need|wish)\s+(to\s+)?/i,
  /^(looking|searching)\s+for\s+(some\s+|a\s+)?/i,
  /^(can\s+you\s+)?(recommend|suggest)\s+(some\s+|a\s+)?/i,
  /^give\s+(me\s+)?(some\s+)?(feedback|suggestions?)\s+(on|for|about)\s+/i,
];

const SHOPPING_SIGNAL =
  /\b(buy|purchase|order|shop|shopping|product|bottle|bottles|need|want|hope|looking for|recommend|suggestion|feedback|reserve|stock|item|sku|marketplace|spend|afford|pay for)\b/i;

const HOPE_OPENING = /^i\s+(hope|want|need|wish)\b/i;

const STOP_WORDS = new Set([
  "i",
  "me",
  "my",
  "we",
  "our",
  "you",
  "your",
  "the",
  "a",
  "an",
  "some",
  "few",
  "couple",
  "for",
  "to",
  "at",
  "in",
  "on",
  "of",
  "and",
  "or",
  "with",
  "this",
  "that",
  "these",
  "those",
  "before",
  "after",
  "end",
  "year",
  "quarter",
  "month",
  "week",
  "today",
  "tomorrow",
  "home",
  "please",
  "can",
  "could",
  "would",
  "should",
  "give",
  "get",
  "find",
  "make",
  "possible",
  "really",
  "very",
  "just",
  "about",
  "into",
  "from",
  "have",
  "has",
  "been",
  "being",
  "are",
  "is",
  "it",
  "its",
  "be",
  "by",
  "as",
  "if",
  "when",
  "where",
  "what",
  "which",
  "who",
  "how",
  "why",
  "any",
  "all",
  "more",
  "most",
  "other",
  "such",
  "only",
  "own",
  "same",
  "than",
  "too",
  "also",
  "not",
  "no",
  "yes",
  "do",
  "does",
  "did",
  "will",
  "shall",
  "may",
  "might",
  "must",
]);

function stripTrailingClauses(text: string): string {
  return text
    .replace(/\?[\s\S]*$/, "")
    .replace(/,\s*(can you|could you|please|give|any|what|how).+$/i, "")
    .replace(/\s+(please|thanks|thank you)\.?$/i, "")
    .trim();
}

export function hasShoppingIntent(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 6) return false;
  return SHOPPING_SIGNAL.test(trimmed) || HOPE_OPENING.test(trimmed);
}

/** Extract product search terms from hope / want phrasing. */
export function extractShoppingQuery(text: string): string | null {
  const trimmed = text.trim();
  if (!hasShoppingIntent(trimmed)) return null;

  let working = trimmed.toLowerCase();
  for (const prefix of INTENT_PREFIXES) {
    working = working.replace(prefix, "");
  }

  working = stripTrailingClauses(working);
  working = working.replace(/[^a-z0-9\s-]/g, " ");

  const tokens = working
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));

  if (tokens.length === 0) return null;

  return tokens.join(" ");
}
