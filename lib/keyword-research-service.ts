import {
  DataForSeoClient,
  hasDataForSeoCredentials,
  type DataForSeoTask
} from "@/lib/dataforseo";
import { getMockKeywordResearchResponse } from "@/lib/mock-data";
import {
  buildHeroPrompt,
  buildTermClusters,
  computeGrowthRate,
  deriveAiRisk,
  detectToolOpportunity,
  estimateBusinessPotential,
  formatGrowth,
  getClusterLabel,
  getParentTopicLabel,
  getToolPattern,
  getTrendLabel,
  hasAiOverview,
  inferIntentFromKeyword,
  inferSerpFormat,
  isQuestionKeyword,
  matchesIncludeExclude,
  matchesMatchingMode,
  normalizeDomain,
  normalizeIntentLabel,
  parseList
} from "@/lib/keyword-research";
import type {
  AiBrandGapEntry,
  AiBrandGapReport,
  AiPlatform,
  BidQueueEntry,
  KeywordCluster,
  KeywordResearchFormState,
  KeywordResearchQuery,
  KeywordResearchResponse,
  KeywordResearchRow,
  Metric,
  SearchIntent,
  ToolOpportunityEntry
} from "@/lib/types";

type ApiItem = Record<string, unknown>;
type ApiResult = ApiItem & {
  items?: ApiItem[];
};
type ApiTask = {
  result?: ApiResult[];
};
type ApiResponse = Record<string, unknown> & {
  tasks?: ApiTask[];
};

type KeywordCandidate = {
  keyword: string;
  searchVolume: number;
  competition: number | null;
  cpc: number | null;
  monthlySearches?: Array<Record<string, unknown>>;
};

type DifficultySnapshot = {
  difficultyApprox: number | null;
  lowestAuthority: number | null;
  minRefDomains: number | null;
  hasAiOverview: boolean;
  serpFormat: string;
  serpFeatures: string[];
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function median(values: number[]) {
  if (!values.length) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function extractFirstResult(response: ApiResponse) {
  return response.tasks?.[0]?.result?.[0];
}

function extractItems(response: ApiResponse) {
  return (extractFirstResult(response)?.items ?? []).filter(Boolean);
}

function valueAtPath(input: Record<string, unknown>, path: string) {
  return path.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    return (current as Record<string, unknown>)[part];
  }, input);
}

function findFirstString(input: unknown, keys: string[]): string | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  for (const key of keys) {
    const value = valueAtPath(input as Record<string, unknown>, key);

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function findFirstNumber(input: unknown, keys: string[]): number | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  for (const key of keys) {
    const value = valueAtPath(input as Record<string, unknown>, key);
    const numericValue = Number(value);

    if (Number.isFinite(numericValue)) {
      return numericValue;
    }
  }

  return null;
}

function collectStringMatches(input: unknown, matcher: (value: string) => boolean, bucket: Set<string>) {
  if (typeof input === "string") {
    if (matcher(input)) {
      bucket.add(input);
    }
    return;
  }

  if (Array.isArray(input)) {
    input.forEach((value) => collectStringMatches(value, matcher, bucket));
    return;
  }

  if (input && typeof input === "object") {
    Object.values(input).forEach((value) => collectStringMatches(value, matcher, bucket));
  }
}

function toCandidate(item: ApiItem): KeywordCandidate | null {
  const keyword = String(item.keyword ?? "").trim();

  if (!keyword) {
    return null;
  }

  return {
    keyword,
    searchVolume: Number(item.search_volume ?? 0),
    competition: Number.isFinite(Number(item.competition))
      ? Number(item.competition)
      : null,
    cpc: Number.isFinite(Number(item.cpc)) ? Number(item.cpc) : null,
    monthlySearches: item.monthly_searches as Array<Record<string, unknown>> | undefined
  };
}

function dedupeCandidates(candidates: KeywordCandidate[]) {
  const map = new Map<string, KeywordCandidate>();

  candidates.forEach((candidate) => {
    const key = candidate.keyword.toLowerCase();
    const existing = map.get(key);

    if (!existing || candidate.searchVolume > existing.searchVolume) {
      map.set(key, candidate);
    }
  });

  return [...map.values()];
}

async function optionalPost(
  client: DataForSeoClient,
  path: string,
  task: DataForSeoTask
) {
  try {
    return await client.post(path, task);
  } catch {
    return null;
  }
}

async function postKeywordBatches(
  client: DataForSeoClient,
  path: string,
  keywords: string[],
  payload: KeywordResearchFormState,
  taskEnhancer?: (keywordsBatch: string[]) => DataForSeoTask
) {
  const responses = await Promise.all(
    chunk(keywords, 40).map(async (keywordsBatch) => {
      const task = taskEnhancer
        ? taskEnhancer(keywordsBatch)
        : {
            keywords: keywordsBatch,
            location_name: payload.locationName,
            language_name: payload.languageName
          };

      return optionalPost(client, path, task);
    })
  );

  return responses.filter(Boolean) as ApiResponse[];
}

function resolveIntentFromItem(item: ApiItem): SearchIntent | null {
  const directIntent = normalizeIntentLabel(
    findFirstString(item, [
      "main_intent",
      "search_intent",
      "intent",
      "item_intent",
      "keyword_intent.label"
    ])
  );

  if (directIntent) {
    return directIntent;
  }

  const collected = new Set<string>();
  collectStringMatches(
    item,
    (value) => {
      return Boolean(normalizeIntentLabel(value));
    },
    collected
  );

  for (const value of collected) {
    const mapped = normalizeIntentLabel(value);

    if (mapped) {
      return mapped;
    }
  }

  return null;
}

function resolveKeywordFromItem(item: ApiItem) {
  return (
    findFirstString(item, ["keyword", "keyword_data.keyword", "keyword_info.keyword"]) ?? ""
  ).toLowerCase();
}

function resolveTrafficPotential(item: ApiItem) {
  return (
    findFirstNumber(item, [
      "traffic_potential",
      "keyword_info.traffic_potential",
      "keyword_info.etv",
      "avg_backlinks_info.etv",
      "etv"
    ]) ?? null
  );
}

function resolveSerpFeatures(item: ApiItem) {
  const features = new Set<string>();
  collectStringMatches(
    item.serp_info ?? item,
    (value) => value.includes("_") || value.toLowerCase().includes("snippet"),
    features
  );

  return [...features].slice(0, 6);
}

function buildQuery(payload: KeywordResearchFormState): KeywordResearchQuery {
  const seeds = parseList(payload.seeds).slice(0, 10);
  const modifiers = parseList(payload.modifiers);
  const includeTerms = parseList(payload.includeTerms);
  const excludeTerms = parseList(payload.excludeTerms);
  const monetization = parseList(payload.monetization);
  const competitorDomains = parseList(payload.competitorDomains)
    .map((entry) => normalizeDomain(entry))
    .filter(Boolean)
    .slice(0, 3);

  return {
    seeds,
    modifiers,
    includeTerms,
    excludeTerms,
    monetization,
    matchingMode: payload.matchingMode,
    reportType: "matching_terms",
    resultLimit: clamp(Number(payload.resultLimit || 60), 20, 80),
    locationName: payload.locationName,
    languageName: payload.languageName,
    ownBrandLabel: payload.ownBrandLabel.trim(),
    ownBrandDomain: normalizeDomain(payload.ownBrandDomain),
    competitorDomains,
    aiPlatform: payload.aiPlatform
  };
}

async function buildDifficultySnapshot(
  client: DataForSeoClient,
  keyword: string,
  payload: KeywordResearchFormState
): Promise<DifficultySnapshot> {
  const serpResponse = await optionalPost(client, "serp/google/organic/live/advanced", {
    keyword,
    location_name: payload.locationName,
    language_name: payload.languageName,
    device: "desktop",
    os: "windows",
    depth: 10
  });

  const serpItems = serpResponse ? extractItems(serpResponse) : [];
  const organicItems = serpItems.filter((item) => item.type === "organic").slice(0, 10);
  const domains = [
    ...new Set(
      organicItems
        .map((item) => String(item.domain ?? ""))
        .map((domain) => normalizeDomain(domain))
        .filter(Boolean)
    )
  ];

  const backlinkSummaries = await Promise.all(
    domains.map(async (domain) => {
      const response = await optionalPost(client, "backlinks/summary/live", {
        target: domain,
        include_subdomains: true
      });
      const result = response ? extractFirstResult(response) : null;

      return {
        authority: Number(result?.rank ?? NaN),
        referringDomains: Number(result?.referring_domains ?? NaN)
      };
    })
  );

  const authorities = backlinkSummaries
    .map((item) => item.authority)
    .filter((value) => Number.isFinite(value));
  const referringDomains = backlinkSummaries
    .map((item) => item.referringDomains)
    .filter((value) => Number.isFinite(value));
  const medianAuthority = median(authorities);
  const medianRefDomains = median(referringDomains);
  const aiOverview = hasAiOverview(serpItems);
  const aiPenalty = aiOverview ? 10 : 0;

  const difficultyApprox =
    medianAuthority === null || medianRefDomains === null
      ? null
      : clamp(
          Math.round(
            0.6 * medianAuthority + 8 * Math.log10(medianRefDomains + 1) + aiPenalty
          ),
          0,
          100
        );

  return {
    difficultyApprox,
    lowestAuthority: authorities.length ? Math.min(...authorities) : null,
    minRefDomains: referringDomains.length ? Math.min(...referringDomains) : null,
    hasAiOverview: aiOverview,
    serpFormat: inferSerpFormat(serpItems),
    serpFeatures: [
      ...new Set(
        serpItems
          .map((item) => String(item.type ?? ""))
          .filter(Boolean)
      )
    ]
  };
}

function buildClusterBuckets(rows: KeywordResearchRow[], key: "termCluster" | "parentTopic") {
  const total = rows.length || 1;
  const counts = rows.reduce<Map<string, number>>((accumulator, row) => {
    const label = row[key];
    accumulator.set(label, (accumulator.get(label) ?? 0) + 1);
    return accumulator;
  }, new Map<string, number>());

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 18)
    .map(([label, count]) => ({
      label,
      count,
      share: Math.round((count / total) * 100)
    }));
}

function getPlatformAvailability(platform: AiPlatform, payload: KeywordResearchFormState) {
  if (platform === "google") {
    return {
      enabled: true,
      reason: undefined
    };
  }

  const supported = payload.languageName === "English" && payload.locationName === "United States";

  return supported
    ? {
        enabled: true,
        reason: undefined
      }
    : {
        enabled: false,
        reason:
          "ChatGPT-Mentions sind hier deaktiviert, weil v1 nur Englisch + Vereinigte Staaten sauber unterstützt."
      };
}

function buildAiCoverageReport(
  ownBrandLabel: string,
  ownBrandDomain: string,
  competitorDomains: string[],
  gaps: AiBrandGapEntry[]
): Metric[] {
  return [
    {
      label: "Eigene Marke",
      value: ownBrandLabel || ownBrandDomain || "nicht gesetzt"
    },
    {
      label: "Wettbewerber",
      value: competitorDomains.length
    },
    {
      label: "Gap-Prompts",
      value: gaps.length
    },
    {
      label: "Status",
      value: gaps.length ? "Lücken erkannt" : "keine Lücken erkannt"
    }
  ];
}

function extractMentionCounts(item: ApiItem, domains: string[]) {
  const counts = new Map<string, number>();

  function walk(node: unknown) {
    if (!node) {
      return;
    }

    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }

    if (typeof node !== "object") {
      return;
    }

    const record = node as Record<string, unknown>;
    const target = findFirstString(record, ["domain", "target", "target_domain", "brand"]);
    const count = findFirstNumber(record, [
      "mentions",
      "mention_count",
      "count",
      "citations",
      "results_count"
    ]);

    if (target && count !== null) {
      const normalizedTarget = normalizeDomain(target);

      domains.forEach((domain) => {
        if (normalizedTarget.includes(domain)) {
          counts.set(domain, Math.max(counts.get(domain) ?? 0, count));
        }
      });
    }

    Object.values(record).forEach(walk);
  }

  walk(item);

  return counts;
}

async function buildAiBrandGapReport(
  client: DataForSeoClient,
  payload: KeywordResearchFormState,
  query: KeywordResearchQuery,
  rows: KeywordResearchRow[],
  warnings: string[]
): Promise<AiBrandGapReport> {
  const availability = getPlatformAvailability(query.aiPlatform, payload);
  const competitors = query.competitorDomains.map((domain) => ({
    label: domain,
    domain
  }));

  if (!query.ownBrandDomain || query.competitorDomains.length === 0) {
    return {
      platform: query.aiPlatform,
      platformEnabled: availability.enabled,
      platformReason:
        "Eigene Domain/Marke und mindestens ein Wettbewerber sind nötig, um den KI-/Brand-Gap zu berechnen.",
      ownBrandLabel: query.ownBrandLabel,
      ownBrandDomain: query.ownBrandDomain,
      competitors,
      coverage: buildAiCoverageReport(
        query.ownBrandLabel,
        query.ownBrandDomain,
        query.competitorDomains,
        []
      ),
      gaps: []
    };
  }

  if (!availability.enabled) {
    return {
      platform: query.aiPlatform,
      platformEnabled: false,
      platformReason: availability.reason,
      ownBrandLabel: query.ownBrandLabel,
      ownBrandDomain: query.ownBrandDomain,
      competitors,
      coverage: buildAiCoverageReport(
        query.ownBrandLabel,
        query.ownBrandDomain,
        query.competitorDomains,
        []
      ),
      gaps: []
    };
  }

  const shortlist = rows.slice(0, 15).map((row) => row.keyword);
  const task = {
    keywords: shortlist,
    targets: [query.ownBrandDomain, ...query.competitorDomains],
    platform: query.aiPlatform
  };
  const [metricsResponse, overviewResponse] = await Promise.all([
    optionalPost(client, "ai_optimization/llm_mentions/cross_aggregated_metrics/live", task),
    optionalPost(client, "ai_optimization/llm_mentions/overview", task)
  ]);

  const items = [
    ...(metricsResponse ? extractItems(metricsResponse) : []),
    ...(overviewResponse ? extractItems(overviewResponse) : [])
  ];
  const gaps: AiBrandGapEntry[] = [];
  const trackedDomains = [query.ownBrandDomain, ...query.competitorDomains];

  items.forEach((item) => {
    const keyword =
      findFirstString(item, ["keyword", "prompt", "query", "search_term"]) ?? "";
    const prompt =
      findFirstString(item, ["prompt", "keyword", "query", "title"]) ?? keyword;
    const counts = extractMentionCounts(item, trackedDomains);
    const ownMentions = counts.get(query.ownBrandDomain) ?? 0;

    query.competitorDomains.forEach((domain) => {
      const competitorMentions = counts.get(domain) ?? 0;

      if (competitorMentions > ownMentions) {
        gaps.push({
          prompt,
          keyword,
          competitor: domain,
          competitorMentions,
          ownMentions,
          opportunityScore: clamp((competitorMentions - ownMentions) * 20, 0, 100)
        });
      }
    });
  });

  if (!gaps.length && shortlist.length > 0) {
    warnings.push(
      "KI-/Brand-Gap konnte live nicht mit belastbaren Mention-Daten gefüllt werden; die UI bleibt aktiv, aber ohne Gap-Treffer."
    );
  }

  const sortedGaps = gaps
    .sort((left, right) => right.opportunityScore - left.opportunityScore)
    .slice(0, 15);

  return {
    platform: query.aiPlatform,
    platformEnabled: true,
    ownBrandLabel: query.ownBrandLabel,
    ownBrandDomain: query.ownBrandDomain,
    competitors,
    coverage: buildAiCoverageReport(
      query.ownBrandLabel,
      query.ownBrandDomain,
      query.competitorDomains,
      sortedGaps
    ),
    gaps: sortedGaps
  };
}

function emptyResponse(payload: KeywordResearchFormState, query: KeywordResearchQuery) {
  return {
    mode: "live",
    generatedAt: new Date().toISOString(),
    query,
    heroPrompt: buildHeroPrompt(payload, query.seeds, query.modifiers),
    summary: [
      { label: "Seeds", value: query.seeds.length },
      { label: "Modifier", value: query.modifiers.length },
      { label: "Matching Terms", value: 0 },
      { label: "Shortlist", value: 0 }
    ],
    matchingTerms: [],
    questions: [],
    termClusters: [],
    parentTopicClusters: [],
    bidQueue: [],
    toolOpportunities: [],
    aiBrandGap: {
      platform: query.aiPlatform,
      platformEnabled: query.aiPlatform === "google",
      ownBrandLabel: query.ownBrandLabel,
      ownBrandDomain: query.ownBrandDomain,
      competitors: query.competitorDomains.map((domain) => ({ label: domain, domain })),
      coverage: [],
      gaps: [],
      platformReason: "Für diese Kombination wurden keine Keywords gefunden."
    },
    warnings: ["Keine Matching Terms für die aktuelle Seed-/Filter-Kombination gefunden."]
  } satisfies KeywordResearchResponse;
}

export async function getKeywordResearchResponse(payload: KeywordResearchFormState) {
  if (!hasDataForSeoCredentials()) {
    return getMockKeywordResearchResponse(payload);
  }

  const client = new DataForSeoClient();
  return buildKeywordResearchResponse(client, payload);
}

export async function buildKeywordResearchResponse(
  client: DataForSeoClient,
  payload: KeywordResearchFormState
): Promise<KeywordResearchResponse> {
  const query = buildQuery(payload);
  const warnings: string[] = [];

  if (!query.seeds.length) {
    return emptyResponse(payload, query);
  }

  const suggestionsResponse = await client.post(
    "keywords_data/google_ads/keywords_for_keywords/live",
    {
      keywords: query.seeds,
      location_name: payload.locationName,
      language_name: payload.languageName,
      limit: 200
    }
  );

  const rawSuggestionItems = extractItems(suggestionsResponse);
  const candidates = dedupeCandidates(
    rawSuggestionItems
      .map((item) => toCandidate(item))
      .filter((item): item is KeywordCandidate => Boolean(item))
  );

  const filteredCandidates = candidates
    .filter((candidate) =>
      matchesMatchingMode(candidate.keyword, query.seeds, query.matchingMode)
    )
    .filter((candidate) =>
      matchesIncludeExclude(
        candidate.keyword,
        query.modifiers,
        query.includeTerms,
        query.excludeTerms
      )
    );

  if (!filteredCandidates.length) {
    return emptyResponse(payload, query);
  }

  const keywordsToEnrich = filteredCandidates
    .slice(0, Math.min(query.resultLimit * 2, 100))
    .map((candidate) => candidate.keyword);
  const [searchVolumeResponses, searchIntentResponses, overviewResponses] = await Promise.all([
    postKeywordBatches(
      client,
      "keywords_data/google_ads/search_volume/live",
      keywordsToEnrich,
      payload
    ),
    postKeywordBatches(
      client,
      "dataforseo_labs/google/search_intent/live",
      keywordsToEnrich,
      payload
    ),
    postKeywordBatches(
      client,
      "dataforseo_labs/google/keyword_overview/live",
      keywordsToEnrich,
      payload
    )
  ]);

  if (!searchIntentResponses.length) {
    warnings.push("Suchintention wurde mangels API-Antwort heuristisch ergänzt.");
  }

  if (!overviewResponses.length) {
    warnings.push(
      "Traffic-Potenzial und SERP-Kontext fallen teilweise auf Suchvolumen und Heuristiken zurück."
    );
  }

  const searchVolumeMap = new Map<string, KeywordCandidate>();
  searchVolumeResponses.forEach((response) => {
    extractItems(response).forEach((item) => {
      const candidate = toCandidate(item);

      if (candidate) {
        searchVolumeMap.set(candidate.keyword.toLowerCase(), candidate);
      }
    });
  });

  const intentMap = new Map<string, SearchIntent>();
  searchIntentResponses.forEach((response) => {
    extractItems(response).forEach((item) => {
      const keyword = resolveKeywordFromItem(item);
      const intent = resolveIntentFromItem(item);

      if (keyword && intent) {
        intentMap.set(keyword, intent);
      }
    });
  });

  const overviewMap = new Map<
    string,
    {
      trafficPotential: number | null;
      serpFeatures: string[];
    }
  >();
  overviewResponses.forEach((response) => {
    extractItems(response).forEach((item) => {
      const keyword = resolveKeywordFromItem(item);

      if (keyword) {
        overviewMap.set(keyword, {
          trafficPotential: resolveTrafficPotential(item),
          serpFeatures: resolveSerpFeatures(item)
        });
      }
    });
  });

  const shortlistKeywords = filteredCandidates
    .map((candidate) => candidate.keyword)
    .slice(0, Math.min(query.resultLimit, 12));
  const difficultyMap = new Map<string, DifficultySnapshot>();
  const difficultySnapshots = await Promise.all(
    shortlistKeywords.map(async (keyword) => {
      const snapshot = await buildDifficultySnapshot(client, keyword, payload);
      return [keyword.toLowerCase(), snapshot] as const;
    })
  );

  difficultySnapshots.forEach(([keyword, snapshot]) => {
    difficultyMap.set(keyword, snapshot);
  });

  if (filteredCandidates.length > shortlistKeywords.length) {
    warnings.push(
      `SERP- und Backlink-Deep-Dives wurden aus Performance-Gründen nur für die Top-${shortlistKeywords.length}-Shortlist berechnet.`
    );
  }

  const rows = filteredCandidates
    .map((candidate) => {
      const enrichedCandidate = searchVolumeMap.get(candidate.keyword.toLowerCase()) ?? candidate;
      const searchVolume = enrichedCandidate.searchVolume || candidate.searchVolume;
      const searchIntent =
        intentMap.get(candidate.keyword.toLowerCase()) ??
        inferIntentFromKeyword(candidate.keyword);
      const growth12m = computeGrowthRate(enrichedCandidate.monthlySearches);
      const overview = overviewMap.get(candidate.keyword.toLowerCase());
      const difficultySnapshot = difficultyMap.get(candidate.keyword.toLowerCase());
      const parentTopic = getParentTopicLabel(candidate.keyword, query.seeds);
      const businessPotential = estimateBusinessPotential(
        candidate.keyword,
        query.monetization
      );
      const hasOverview = difficultySnapshot?.hasAiOverview ?? false;
      const aiRisk = deriveAiRisk(hasOverview, searchIntent);

      return {
        keyword: candidate.keyword,
        searchIntent,
        difficultyApprox: difficultySnapshot?.difficultyApprox ?? null,
        searchVolume,
        trend: getTrendLabel(growth12m),
        growth12m,
        lowestAuthority: difficultySnapshot?.lowestAuthority ?? null,
        trafficPotential: overview?.trafficPotential ?? searchVolume,
        cpc: enrichedCandidate.cpc ?? candidate.cpc,
        parentTopic,
        aiRisk,
        toolOpportunity: detectToolOpportunity(candidate.keyword),
        termCluster: getClusterLabel(candidate.keyword, query.modifiers, query.seeds),
        serpFeatures: difficultySnapshot?.serpFeatures ?? overview?.serpFeatures ?? [],
        language: payload.languageName,
        competition: enrichedCandidate.competition ?? candidate.competition,
        businessPotential: businessPotential.score,
        businessPotentialReason: businessPotential.reason,
        hasAiOverview: hasOverview,
        minRefDomains: difficultySnapshot?.minRefDomains ?? null,
        serpFormat: difficultySnapshot?.serpFormat ?? "k. A."
      } satisfies KeywordResearchRow;
    })
    .sort((left, right) => right.searchVolume - left.searchVolume)
    .slice(0, query.resultLimit);

  const questions = rows.filter(
    (row) => isQuestionKeyword(row.keyword) || row.searchIntent === "Informational"
  );
  const termClusters = buildClusterBuckets(rows, "termCluster");
  const parentTopicClusters = buildClusterBuckets(rows, "parentTopic");

  if (!termClusters.length && rows.length) {
    termClusters.push(
      ...buildTermClusters(rows.map((row) => row.keyword)).map((cluster) => ({
        label: cluster.term,
        count: cluster.count,
        share: Math.round((cluster.count / rows.length) * 100)
      }))
    );
  }

  const bidQueue = rows
    .map((row) => {
      const recommendation =
        row.businessPotential >= 3 &&
        (row.difficultyApprox === null || row.difficultyApprox <= 40) &&
        row.aiRisk !== "hoch"
          ? "Targeten"
          : row.aiRisk === "hoch"
            ? "Nur mit einzigartigem Mehrwert"
            : row.businessPotential >= 2
              ? "In Shortlist halten"
              : "Nachrangig";

      return {
        keyword: row.keyword,
        businessPotential: row.businessPotential,
        businessPotentialReason: row.businessPotentialReason,
        searchIntent: row.searchIntent,
        serpFormat: row.serpFormat,
        aiRisk: row.aiRisk,
        difficultyApprox: row.difficultyApprox,
        lowestAuthority: row.lowestAuthority,
        minRefDomains: row.minRefDomains,
        recommendation
      } satisfies BidQueueEntry;
    })
    .sort((left, right) => {
      if (right.businessPotential !== left.businessPotential) {
        return right.businessPotential - left.businessPotential;
      }

      return (left.difficultyApprox ?? 999) - (right.difficultyApprox ?? 999);
    })
    .slice(0, 12);

  const toolOpportunities = rows
    .filter((row) => row.toolOpportunity)
    .map((row) => ({
      keyword: row.keyword,
      searchVolume: row.searchVolume,
      cpc: row.cpc,
      parentTopic: row.parentTopic,
      businessPotential: row.businessPotential,
      aiRisk: row.aiRisk,
      toolPattern: getToolPattern(row.keyword)
    }))
    .slice(0, 20) satisfies ToolOpportunityEntry[];

  const aiBrandGap = await buildAiBrandGapReport(client, payload, query, rows, warnings);

  return {
    mode: "live",
    generatedAt: new Date().toISOString(),
    query,
    heroPrompt: buildHeroPrompt(payload, query.seeds, query.modifiers),
    summary: [
      { label: "Seeds", value: query.seeds.length },
      { label: "Modifier", value: query.modifiers.length + query.includeTerms.length },
      { label: "Matching Terms", value: rows.length },
      {
        label: "Tool-Chancen",
        value: toolOpportunities.length,
        hint: `${questions.length} Fragen im gleichen Datensatz`
      }
    ] satisfies Metric[],
    matchingTerms: rows,
    questions,
    termClusters,
    parentTopicClusters,
    bidQueue,
    toolOpportunities,
    aiBrandGap,
    warnings
  };
}

export function formatKeywordNumber(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "k. A.";
  }

  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: value >= 100 ? 0 : 2
  }).format(value);
}

export function formatKeywordCurrency(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "k. A.";
  }

  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(value);
}

export function formatKeywordGrowth(value: number | null) {
  return formatGrowth(value);
}
