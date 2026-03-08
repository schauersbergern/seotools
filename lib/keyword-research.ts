import type {
  AiRiskLevel,
  KeywordMatchingMode,
  KeywordResearchFormState,
  SearchIntent
} from "@/lib/types";

const questionPrefixes = [
  "wie",
  "was",
  "warum",
  "wann",
  "wo",
  "welche",
  "welcher",
  "welches",
  "who",
  "what",
  "why",
  "when",
  "where",
  "how",
  "is",
  "are",
  "can"
];

const toolTerms = [
  "calculator",
  "checker",
  "generator",
  "tool",
  "audit",
  "template",
  "vorlage",
  "rechner",
  "prüfer",
  "vergleichsrechner"
];

const commercialTerms = [
  "best",
  "beste",
  "review",
  "reviews",
  "vergleich",
  "vs",
  "alternativen",
  "alternative",
  "top",
  "unter",
  "für",
  "preis",
  "kosten"
];

const transactionalTerms = [
  "kaufen",
  "buy",
  "shop",
  "angebot",
  "discount",
  "coupon",
  "gutschein",
  "bestellen"
];

const informationalTerms = [
  "wie",
  "was",
  "warum",
  "guide",
  "anleitung",
  "tutorial",
  "tipps",
  "learn",
  "lernen"
];

const productTerms = [
  "software",
  "plattform",
  "app",
  "plugin",
  "template",
  "vorlage",
  "kurs",
  "tool"
];

const stopTerms = new Set([
  "der",
  "die",
  "das",
  "ein",
  "eine",
  "für",
  "mit",
  "und",
  "oder",
  "the",
  "a",
  "an",
  "of",
  "to",
  "in",
  "on",
  "at",
  "by",
  "vs"
]);

export function normalizeWhitespace(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeDomain(target: string) {
  return target
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

export function parseList(value: string) {
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function buildHeroPrompt(
  payload: KeywordResearchFormState,
  seeds: string[],
  modifiers: string[]
) {
  const monetization = parseList(payload.monetization).join(", ") || "keine Angabe";
  const audience = payload.audience.trim() || "keine Angabe";
  const niche = payload.niche.trim() || "keine Angabe";

  return [
    `Ich plane eine Keyword-Recherche für ${niche}.`,
    `Die Zielgruppe ist ${audience}.`,
    `Monetarisierung: ${monetization}.`,
    `Erarbeite Matching Terms, Fragen, Cluster und priorisierte Tool-Chancen.`,
    `Nutze Seeds wie ${seeds.join(", ") || niche}.`,
    `Nutze Modifier oder Include-Begriffe wie ${modifiers.join(", ") || "best, review, vs, checker, calculator"}.`,
    `Bewerte Business-Potenzial, Intent, Schwierigkeit (approx) und KI-Risiko.`
  ].join(" ");
}

export function matchesMatchingMode(
  keyword: string,
  seeds: string[],
  matchingMode: KeywordMatchingMode
) {
  const normalizedKeyword = normalizeWhitespace(keyword);

  if (matchingMode === "phrase_match") {
    return seeds.some((seed) => normalizedKeyword.includes(normalizeWhitespace(seed)));
  }

  const keywordTerms = new Set(normalizedKeyword.split(" "));

  return seeds.some((seed) =>
    normalizeWhitespace(seed)
      .split(" ")
      .every((term) => keywordTerms.has(term))
  );
}

export function isQuestionKeyword(keyword: string) {
  const normalizedKeyword = normalizeWhitespace(keyword);

  return (
    questionPrefixes.some(
      (prefix) =>
        normalizedKeyword.startsWith(`${prefix} `) || normalizedKeyword === prefix
    ) ||
    normalizedKeyword.includes("?")
  );
}

export function matchesIncludeExclude(
  keyword: string,
  modifiers: string[],
  includeTerms: string[],
  excludeTerms: string[]
) {
  const normalizedKeyword = normalizeWhitespace(keyword);
  const includePool = [...modifiers, ...includeTerms].map((term) => normalizeWhitespace(term));

  const includeMatches =
    includePool.length === 0
      ? true
      : includePool.some((term) => normalizedKeyword.includes(term));
  const excludeMatches = excludeTerms.some((term) =>
    normalizedKeyword.includes(normalizeWhitespace(term))
  );

  return includeMatches && !excludeMatches;
}

export function detectToolOpportunity(keyword: string) {
  const normalizedKeyword = normalizeWhitespace(keyword);
  return toolTerms.some((term) => normalizedKeyword.includes(term));
}

export function getToolPattern(keyword: string) {
  const normalizedKeyword = normalizeWhitespace(keyword);
  return toolTerms.find((term) => normalizedKeyword.includes(term)) ?? "tool";
}

export function inferIntentFromKeyword(keyword: string): SearchIntent {
  const normalizedKeyword = normalizeWhitespace(keyword);

  if (detectToolOpportunity(normalizedKeyword)) {
    return "Tool";
  }

  if (transactionalTerms.some((term) => normalizedKeyword.includes(term))) {
    return "Transaktional";
  }

  if (commercialTerms.some((term) => normalizedKeyword.includes(term))) {
    return "Kommerziell";
  }

  if (
    informationalTerms.some((term) => normalizedKeyword.includes(term)) ||
    isQuestionKeyword(normalizedKeyword)
  ) {
    return "Informational";
  }

  return "Gemischt";
}

export function normalizeIntentLabel(value: string | null | undefined): SearchIntent | null {
  const normalized = normalizeWhitespace(value ?? "");

  if (!normalized) {
    return null;
  }

  if (normalized.includes("transaction")) {
    return "Transaktional";
  }

  if (normalized.includes("commercial")) {
    return "Kommerziell";
  }

  if (normalized.includes("navigational")) {
    return "Navigational";
  }

  if (normalized.includes("inform")) {
    return "Informational";
  }

  if (normalized.includes("tool")) {
    return "Tool";
  }

  if (normalized.includes("mixed")) {
    return "Gemischt";
  }

  return null;
}

export function computeGrowthRate(monthlySearches: Array<Record<string, unknown>> | undefined) {
  if (!monthlySearches || monthlySearches.length < 2) {
    return null;
  }

  const ordered = [...monthlySearches]
    .map((entry) => Number(entry.search_volume ?? 0))
    .filter((value) => Number.isFinite(value));

  if (ordered.length < 2 || ordered[0] === 0) {
    return null;
  }

  const firstHalf = ordered.slice(0, Math.ceil(ordered.length / 2));
  const secondHalf = ordered.slice(Math.ceil(ordered.length / 2));
  const firstAverage =
    firstHalf.reduce((sum, value) => sum + value, 0) / Math.max(firstHalf.length, 1);
  const secondAverage =
    secondHalf.reduce((sum, value) => sum + value, 0) / Math.max(secondHalf.length, 1);

  if (firstAverage === 0) {
    return null;
  }

  return Math.round(((secondAverage - firstAverage) / firstAverage) * 100);
}

export function getTrendLabel(growth: number | null) {
  if (growth === null) {
    return "unbekannt" as const;
  }

  if (growth >= 20) {
    return "wachsend" as const;
  }

  if (growth <= -10) {
    return "fallend" as const;
  }

  return "stabil" as const;
}

export function getClusterLabel(keyword: string, modifiers: string[], seeds: string[]) {
  const normalizedKeyword = normalizeWhitespace(keyword);
  const matchingModifier = modifiers.find((modifier) =>
    normalizedKeyword.includes(normalizeWhitespace(modifier))
  );

  if (matchingModifier) {
    return matchingModifier;
  }

  const matchingSeed = seeds.find((seed) =>
    normalizedKeyword.includes(normalizeWhitespace(seed))
  );

  if (matchingSeed) {
    return matchingSeed;
  }

  return normalizedKeyword.split(" ").find((term) => !stopTerms.has(term)) ?? normalizedKeyword;
}

export function getParentTopicLabel(keyword: string, seeds: string[]) {
  const normalizedKeyword = normalizeWhitespace(keyword);
  const matchingSeed = [...seeds]
    .sort((left, right) => right.length - left.length)
    .find((seed) => normalizedKeyword.includes(normalizeWhitespace(seed)));

  if (matchingSeed) {
    return matchingSeed;
  }

  const terms = normalizedKeyword.split(" ").filter((term) => !stopTerms.has(term));
  return terms.slice(0, 2).join(" ") || normalizedKeyword;
}

export function estimateBusinessPotential(keyword: string, monetization: string[]) {
  const normalizedKeyword = normalizeWhitespace(keyword);
  let score = 0;
  const reasons: string[] = [];

  if (detectToolOpportunity(normalizedKeyword)) {
    score = Math.max(score, 3);
    reasons.push("Tool-Keyword mit direkter Nutzungsabsicht");
  }

  if (
    transactionalTerms.some((term) => normalizedKeyword.includes(term)) ||
    commercialTerms.some((term) => normalizedKeyword.includes(term))
  ) {
    score = Math.max(score, 3);
    reasons.push("transaktionaler oder kommerzieller Suchbezug");
  }

  if (productTerms.some((term) => normalizedKeyword.includes(term))) {
    score = Math.max(score, 2);
    reasons.push("starker Produkt- oder Lösungsbezug");
  }

  if (isQuestionKeyword(normalizedKeyword)) {
    score = Math.min(score || 1, 1);
    reasons.push("primär informationsgetrieben");
  }

  if (
    monetization.some((term) =>
      ["affiliate", "ads", "sponsorships", "leadgen", "saas", "dienstleistung"].includes(
        normalizeWhitespace(term)
      )
    ) &&
    score >= 2
  ) {
    reasons.push("passt zum Monetarisierungsmodell");
  }

  if (score === 0 && normalizedKeyword.length > 0) {
    score = 1;
    reasons.push("indirekter Themenfit");
  }

  return {
    score,
    label: `${score}/3`,
    reason: reasons.join(", ") || "kaum Monetarisierungssignale"
  };
}

export function buildTermClusters(keywords: string[]) {
  const counts = new Map<string, number>();

  keywords.forEach((keyword) => {
    normalizeWhitespace(keyword)
      .split(" ")
      .filter((term) => term.length > 2 && !stopTerms.has(term))
      .forEach((term) => {
        counts.set(term, (counts.get(term) ?? 0) + 1);
      });
  });

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 18)
    .map(([term, count]) => ({ term, count }));
}

export function inferSerpFormat(items: Array<Record<string, unknown>>) {
  const titles = items
    .filter((item) => item.type === "organic")
    .slice(0, 5)
    .map((item) =>
      `${String(item.title ?? "")} ${String(item.url ?? "")}`.toLowerCase()
    );

  if (!titles.length) {
    return "k. A.";
  }

  if (titles.some((title) => toolTerms.some((term) => title.includes(term)))) {
    return "Tool";
  }

  if (
    titles.some((title) =>
      ["product", "shop", "store", "kaufen", "produkt", "category"].some((term) =>
        title.includes(term)
      )
    )
  ) {
    return "Produkt- oder Kategorieseite";
  }

  if (
    titles.some((title) =>
      ["review", "vergleich", "best", "beste", "vs"].some((term) => title.includes(term))
    )
  ) {
    return "Vergleich oder Review";
  }

  return "Ratgeber";
}

export function hasAiOverview(items: Array<Record<string, unknown>>) {
  return items.some((item) => String(item.type ?? "").includes("ai"));
}

export function deriveAiRisk(
  hasOverview: boolean,
  intent: SearchIntent
): AiRiskLevel {
  if (!hasOverview) {
    return "niedrig";
  }

  if (intent === "Informational") {
    return "hoch";
  }

  if (intent === "Kommerziell" || intent === "Gemischt") {
    return "mittel";
  }

  return "niedrig";
}

export function formatGrowth(growth: number | null) {
  if (growth === null) {
    return "k. A.";
  }

  const prefix = growth > 0 ? "+" : "";
  return `${prefix}${growth}%`;
}

export function isTrivialToken(token: string) {
  return token.length <= 2 || stopTerms.has(token);
}
