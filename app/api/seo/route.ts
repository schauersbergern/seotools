import { NextResponse } from "next/server";
import {
  DataForSeoClient,
  hasDataForSeoCredentials,
  type DataForSeoTask
} from "@/lib/dataforseo";
import { getKeywordResearchResponse } from "@/lib/keyword-research-service";
import { hasAiOverview, inferSerpFormat } from "@/lib/keyword-research";
import {
  getDeviceLabel,
  getLanguageLabel,
  getLocationLabel,
  getOsLabel,
  getSerpFeatureLabel
} from "@/lib/market-options";
import { getMockResult } from "@/lib/mock-data";
import type {
  KeywordResearchFormState,
  KeywordResearchResponse,
  Metric,
  SeoFeature,
  SeoFeatureFormState,
  SeoResult,
  SeoSection,
  TableColumn,
  TableRow
} from "@/lib/types";

type ApiItem = Record<string, unknown>;
type ApiResult = ApiItem & {
  items?: ApiItem[];
  items_count?: number;
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
  competition: number;
  cpc: number;
  monthlySearches?: Array<Record<string, unknown>>;
};

function formatNumber(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "k. A.";
  }

  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: value >= 100 ? 0 : 2
  }).format(value);
}

function formatCurrency(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "k. A.";
  }

  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(value);
}

function normalizeDomain(target: string) {
  return target
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "");
}

function normalizeUrl(target: string) {
  const trimmed = target.trim();
  if (!trimmed) {
    return trimmed;
  }

  return /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function valueAtPath(input: Record<string, unknown>, path: string) {
  return path.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    return (current as Record<string, unknown>)[part];
  }, input);
}

function buildRows(
  items: Array<Record<string, unknown>>,
  columns: TableColumn[]
): TableRow[] {
  return items.map((item) => {
    return columns.reduce<TableRow>((row, column) => {
      const value = valueAtPath(item, column.key);
      row[column.label] =
        typeof value === "boolean"
          ? value
            ? "Ja"
            : "Nein"
          : typeof value === "number"
            ? formatNumber(value)
            : String(value ?? "k. A.");
      return row;
    }, {});
  });
}

function extractFirstResult(response: ApiResponse) {
  const tasks = response.tasks;
  return tasks?.[0]?.result?.[0];
}

function extractItems(response: ApiResponse) {
  const result = extractFirstResult(response);
  return (result?.items ?? []).filter(Boolean);
}

function toCandidate(item: Record<string, unknown>): KeywordCandidate | null {
  const keyword = String(item.keyword ?? "").trim();
  if (!keyword) {
    return null;
  }

  return {
    keyword,
    searchVolume: Number(item.search_volume ?? 0),
    competition: Number(item.competition ?? 0),
    cpc: Number(item.cpc ?? 0),
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

async function buildDifficultySnapshot(
  client: DataForSeoClient,
  keyword: string,
  payload: KeywordResearchFormState
) {
  const serpResponse = await optionalPost(client, "serp/google/organic/live/advanced", {
    keyword,
    location_name: payload.locationName,
    language_name: payload.languageName,
    device: "desktop",
    os: "windows",
    depth: 10
  });

  const serpItems = serpResponse ? extractItems(serpResponse) : [];
  const organicItems = serpItems.filter((item) => item.type === "organic").slice(0, 5);
  const domains = [...new Set(
    organicItems
      .map((item) => String(item.domain ?? ""))
      .filter(Boolean)
  )];

  const backlinkSummaries = await Promise.all(
    domains.map(async (domain) => {
      const response = await optionalPost(client, "backlinks/summary/live", {
        target: domain,
        include_subdomains: true
      });

      const result = response ? extractFirstResult(response) : null;
      return {
        domain,
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

  const lowestAuthority =
    authorities.length > 0 ? Math.min(...authorities) : null;
  const minReferringDomains =
    referringDomains.length > 0 ? Math.min(...referringDomains) : null;

  const difficultyScore = Math.round(
    Math.max(
      0,
      Math.min(
        100,
        (lowestAuthority ?? 20) * 0.7 +
          Math.log10((minReferringDomains ?? 1) + 1) * 12 +
          (hasAiOverview(serpItems) ? 12 : 0)
      )
    )
  );

  return {
    serpItems,
    lowestAuthority,
    minReferringDomains,
    difficultyScore,
    serpFormat: inferSerpFormat(serpItems),
    aiOverview: hasAiOverview(serpItems)
  };
}

async function handleOverview(
  client: DataForSeoClient,
  payload: SeoFeatureFormState
): Promise<SeoResult> {
  const target = normalizeDomain(payload.domain);
  const task: DataForSeoTask = {
    target,
    location_name: payload.locationName,
    language_name: payload.languageName,
    limit: 10
  };

  const [rankedResponse, backlinksResponse, competitorsResponse] = await Promise.all([
    client.post("dataforseo_labs/google/ranked_keywords/live", {
      ...task,
      load_rank_absolute: true
    }),
    client.post("backlinks/summary/live", {
      target,
      include_subdomains: true
    }),
    client.post("dataforseo_labs/google/competitors_domain/live", task)
  ]);

  const rankedItems = extractItems(rankedResponse);
  const competitorItems = extractItems(competitorsResponse);
  const backlinksSummary = extractFirstResult(backlinksResponse) ?? {};

  const summary: Metric[] = [
    { label: "Ziel-Domain", value: target },
    {
      label: "Verweisende Domains",
      value: formatNumber(backlinksSummary.referring_domains)
    },
    {
      label: "Backlinks",
      value: formatNumber(
        backlinksSummary.external_links_count ?? backlinksSummary.backlinks
      )
    },
    {
      label: "Organische Wettbewerber",
      value: formatNumber(
        (extractFirstResult(competitorsResponse)?.items_count as number | undefined) ??
          competitorItems.length
      )
    }
  ];

  return {
    feature: "overview",
    mode: "live",
    title: `Domain-Überblick für ${target}`,
    generatedAt: new Date().toISOString(),
    summary,
    sections: [
      {
        id: "overview-keywords",
        title: "Top-Rankings",
        description:
          "Stichprobe der Keywords, für die die Domain aktuell organisch rankt.",
        table: {
          columns: [
            { key: "keyword_data.keyword", label: "Keyword" },
            { key: "ranked_serp_element.serp_item.rank_absolute", label: "Pos." },
            { key: "keyword_data.keyword_info.search_volume", label: "Suchvolumen" },
            { key: "ranked_serp_element.serp_item.etv", label: "Besucherpotenzial" }
          ],
          rows: buildRows(rankedItems, [
            { key: "keyword_data.keyword", label: "Keyword" },
            { key: "ranked_serp_element.serp_item.rank_absolute", label: "Pos." },
            { key: "keyword_data.keyword_info.search_volume", label: "Suchvolumen" },
            { key: "ranked_serp_element.serp_item.etv", label: "Besucherpotenzial" }
          ])
        }
      },
      {
        id: "overview-competitors",
        title: "Wettbewerber",
        description:
          "Domains mit hoher SERP-Überschneidung basierend auf den Google-Rankings aus DataForSEO Labs.",
        table: {
          columns: [
            { key: "domain", label: "Domain" },
            { key: "intersections", label: "Gemeinsame Keywords" },
            { key: "avg_position", label: "Ø-Position" },
            { key: "etv", label: "Besucherpotenzial" }
          ],
          rows: buildRows(competitorItems, [
            { key: "domain", label: "Domain" },
            { key: "intersections", label: "Gemeinsame Keywords" },
            { key: "avg_position", label: "Ø-Position" },
            { key: "etv", label: "Besucherpotenzial" }
          ])
        }
      },
      {
        id: "overview-notes",
        title: "Backlink-Überblick",
        metrics: [
          {
            label: "Verweisende Seiten",
            value: formatNumber(backlinksSummary.referring_pages)
          },
          {
            label: "Defekte Backlinks",
            value: formatNumber(backlinksSummary.broken_backlinks)
          },
          {
            label: "Defekte Seiten",
            value: formatNumber(backlinksSummary.broken_pages)
          },
          {
            label: "Autorität",
            value: formatNumber(backlinksSummary.rank)
          }
        ]
      }
    ]
  };
}

async function handleKeywords(
  client: DataForSeoClient,
  payload: KeywordResearchFormState
): Promise<KeywordResearchResponse> {
  return getKeywordResearchResponse(payload);
}

async function handleSerp(
  client: DataForSeoClient,
  payload: SeoFeatureFormState
): Promise<SeoResult> {
  const response = await client.post("serp/google/organic/live/advanced", {
    keyword: payload.keyword,
    location_name: payload.locationName,
    language_name: payload.languageName,
    device: payload.device,
    os: payload.os,
    depth: 20
  });

  const items = extractItems(response);
  const organicItems = items.filter((item) => item.type === "organic");
  const featureCounts = items.reduce<Record<string, number>>((acc, item) => {
    const type = String(item.type ?? "unknown");
    acc[type] = (acc[type] ?? 0) + 1;
    return acc;
  }, {});

  return {
    feature: "serp",
    mode: "live",
    title: `SERP-Analyse für "${payload.keyword}"`,
    generatedAt: new Date().toISOString(),
    summary: [
      { label: "Keyword", value: payload.keyword },
      { label: "Organische Treffer", value: organicItems.length },
      { label: "SERP-Features", value: items.length - organicItems.length },
      {
        label: "Gerät",
        value: `${getDeviceLabel(payload.device)} / ${getOsLabel(payload.os)}`
      }
    ],
    sections: [
      {
        id: "serp-organic",
        title: "Top-SERP-Ergebnisse",
        description:
          "Google-Organic-SERP-Advanced-Daten für das ausgewählte Keyword.",
        table: {
          columns: [
            { key: "rank_absolute", label: "Pos." },
            { key: "title", label: "Titel" },
            { key: "domain", label: "Domain" },
            { key: "url", label: "URL" }
          ],
          rows: organicItems.map((item) => ({
            "Pos.": formatNumber(item.rank_absolute),
            Titel: String(item.title ?? "k. A."),
            Domain: String(item.domain ?? "k. A."),
            URL: String(item.url ?? "k. A.")
          }))
        }
      },
      {
        id: "serp-features",
        title: "SERP-Feature-Mix",
        metrics: Object.entries(featureCounts).map(([label, value]) => ({
          label: getSerpFeatureLabel(label),
          value
        })),
        notice:
          "Je nach Keyword können neben organischen Treffern auch andere SERP-Features wie FAQs, Karten oder hervorgehobene Snippets auftauchen."
      }
    ]
  };
}

async function handleBacklinks(
  client: DataForSeoClient,
  payload: SeoFeatureFormState
): Promise<SeoResult> {
  const target = normalizeDomain(payload.domain);
  const [summaryResponse, backlinksResponse] = await Promise.all([
    client.post("backlinks/summary/live", {
      target,
      include_subdomains: true
    }),
    client.post("backlinks/backlinks/live", {
      target,
      include_subdomains: true,
      limit: 20
    })
  ]);

  const summaryResult = extractFirstResult(summaryResponse) ?? {};
  const backlinkItems = extractItems(backlinksResponse);

  return {
    feature: "backlinks",
    mode: "live",
    title: `Backlink-Analyse für ${target}`,
    generatedAt: new Date().toISOString(),
    summary: [
      {
        label: "Verweisende Domains",
        value: formatNumber(summaryResult.referring_domains)
      },
      {
        label: "Verweisende Seiten",
        value: formatNumber(summaryResult.referring_pages)
      },
      {
        label: "Externe Links",
        value: formatNumber(summaryResult.external_links_count)
      },
      {
        label: "Defekte Backlinks",
        value: formatNumber(summaryResult.broken_backlinks)
      }
    ],
    sections: [
      {
        id: "backlinks-summary",
        title: "Autoritäts-Überblick",
        metrics: [
          {
            label: "Autorität",
            value: formatNumber(summaryResult.rank)
          },
          {
            label: "Defekte Seiten",
            value: formatNumber(summaryResult.broken_pages)
          },
          {
            label: "Verlorene Backlinks",
            value: formatNumber(summaryResult.lost_backlinks)
          },
          {
            label: "Neue Backlinks",
            value: formatNumber(summaryResult.new_backlinks)
          }
        ]
      },
      {
        id: "backlinks-list",
        title: "Top-Backlinks",
        description:
          "Auszug der verweisenden Seiten inklusive Ankertext und Linktyp.",
        table: {
          columns: [
            { key: "domain_from", label: "Quell-Domain" },
            { key: "url_from", label: "Quell-URL" },
            { key: "anchor", label: "Ankertext" },
            { key: "dofollow", label: "Follow-Link" }
          ],
          rows: backlinkItems.map((item) => ({
            "Quell-Domain": String(item.domain_from ?? "k. A."),
            "Quell-URL": String(item.url_from ?? "k. A."),
            Ankertext: String(item.anchor ?? "k. A."),
            "Follow-Link":
              typeof item.dofollow === "boolean"
                ? item.dofollow
                  ? "Ja"
                  : "Nein"
                : "k. A."
          }))
        }
      }
    ]
  };
}

async function handleAudit(
  client: DataForSeoClient,
  payload: SeoFeatureFormState
): Promise<SeoResult> {
  const url = normalizeUrl(payload.url || payload.domain);
  const response = await client.post("on_page/instant_pages", {
    url,
    enable_browser_rendering: payload.enableBrowserRendering,
    disable_cookie_popup: true,
    check_spell: true
  });

  const auditResult = extractFirstResult(response) ?? {};
  const item = ((auditResult.items as Array<Record<string, unknown>> | undefined) ?? [])[0] ?? {};
  const meta = (item.meta as Record<string, unknown> | undefined) ?? {};
  const issues = [
    meta.no_title ? "Kein oder leerer Titel-Tag" : null,
    meta.no_description ? "Keine oder leere Meta-Beschreibung" : null,
    meta.no_h1_tag ? "Kein H1 gefunden" : null,
    meta.no_image_alt ? "Bilder ohne ALT-Texte" : null,
    meta.large_page_size ? "Seite ist größer als empfohlen" : null,
    meta.https_to_http_links ? "HTTP-Links auf HTTPS-Seite" : null,
    meta.has_misspelling ? "Mögliche Rechtschreibfehler erkannt" : null
  ].filter(Boolean) as string[];

  return {
    feature: "audit",
    mode: "live",
    title: `On-Page-Audit für ${url}`,
    generatedAt: new Date().toISOString(),
    summary: [
      { label: "URL", value: String(item.url ?? url) },
      { label: "Status-Code", value: formatNumber(item.status_code) },
      {
        label: "Titel",
        value: String(meta.title ? "Vorhanden" : "Fehlt")
      },
      {
        label: "Kanonisch",
        value:
          typeof meta.canonical === "boolean"
            ? meta.canonical
              ? "Ja"
              : "Nein"
            : "k. A."
      }
    ],
    sections: [
      {
        id: "audit-core",
        title: "Seitenprüfungen",
        metrics: [
          {
            label: "Beschreibung",
            value: meta.no_description ? "Fehlt" : "Vorhanden"
          },
          {
            label: "H1",
            value: meta.no_h1_tag ? "Fehlt" : "Vorhanden"
          },
          {
            label: "SEO-URL",
            value:
              typeof meta.seo_friendly_url === "boolean"
                ? meta.seo_friendly_url
                  ? "Ja"
                  : "Nein"
                : "k. A."
          },
          {
            label: "Charset",
            value: String(meta.charset ?? "k. A.")
          }
        ]
      },
      {
        id: "audit-issues",
        title: "Auffällige Punkte",
        pills: issues,
        notice:
          issues.length === 0
            ? "In diesem Audit-Ausschnitt wurden keine offensichtlichen Standardprobleme erkannt."
            : undefined
      }
    ]
  };
}

async function handleCompetitors(
  client: DataForSeoClient,
  payload: SeoFeatureFormState
): Promise<SeoResult> {
  const target = normalizeDomain(payload.domain);
  const compareDomain = normalizeDomain(payload.compareDomain || "");
  const competitorResponse = await client.post(
    "dataforseo_labs/google/competitors_domain/live",
    {
      target,
      location_name: payload.locationName,
      language_name: payload.languageName,
      limit: 15
    }
  );

  const competitors = extractItems(competitorResponse);
  const sections: SeoSection[] = [
    {
      id: "competitors-domain",
      title: "SERP-Wettbewerber",
      description:
        "Domains mit höchster Überschneidung in organischen Rankings.",
      table: {
        columns: [
          { key: "domain", label: "Domain" },
          { key: "intersections", label: "Gemeinsame Keywords" },
          { key: "avg_position", label: "Ø-Position" },
          { key: "etv", label: "Besucherpotenzial" }
        ],
        rows: buildRows(competitors, [
          { key: "domain", label: "Domain" },
          { key: "intersections", label: "Gemeinsame Keywords" },
          { key: "avg_position", label: "Ø-Position" },
          { key: "etv", label: "Besucherpotenzial" }
        ])
      }
    }
  ];

  if (compareDomain) {
    const gapResponse = await client.post(
      "dataforseo_labs/google/domain_intersection/live",
      {
        target1: target,
        target2: compareDomain,
        location_name: payload.locationName,
        language_name: payload.languageName,
        limit: 15
      }
    );
    const intersections = extractItems(gapResponse);

    sections.push({
      id: "competitors-gap",
      title: `Keyword-Überschneidung: ${target} vs. ${compareDomain}`,
      description:
        "Keywords, für die beide Domains innerhalb derselben SERP ranken.",
      table: {
        columns: [
          { key: "keyword_data.keyword", label: "Keyword" },
          {
            key: "first_domain_serp_element.serp_item.rank_absolute",
            label: `${target} Pos.`
          },
          {
            key: "second_domain_serp_element.serp_item.rank_absolute",
            label: `${compareDomain} Pos.`
          },
          { key: "keyword_data.keyword_info.search_volume", label: "Suchvolumen" }
        ],
        rows: buildRows(intersections, [
          { key: "keyword_data.keyword", label: "Keyword" },
          {
            key: "first_domain_serp_element.serp_item.rank_absolute",
            label: `${target} Pos.`
          },
          {
            key: "second_domain_serp_element.serp_item.rank_absolute",
            label: `${compareDomain} Pos.`
          },
          { key: "keyword_data.keyword_info.search_volume", label: "Suchvolumen" }
        ])
      }
    });
  }

  return {
    feature: "competitors",
    mode: "live",
    title: "Wettbewerbsanalyse",
    generatedAt: new Date().toISOString(),
    summary: [
      { label: "Ziel-Domain", value: target },
      { label: "Wettbewerber", value: competitors.length },
      { label: "Vergleichsdomain", value: compareDomain || "nicht gesetzt" },
      {
        label: "Markt",
        value: `${getLocationLabel(payload.locationName)} / ${getLanguageLabel(payload.languageName)}`
      }
    ],
    sections
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      feature?: SeoFeature;
      payload?: SeoFeatureFormState | KeywordResearchFormState;
    };

    if (!body.feature || !body.payload) {
      return NextResponse.json(
        { error: "Ungültige Anfrage." },
        { status: 400 }
      );
    }

    if (body.feature === "keywords") {
      return NextResponse.json(
        await getKeywordResearchResponse(body.payload as KeywordResearchFormState)
      );
    }

    if (!hasDataForSeoCredentials()) {
      return NextResponse.json(
        getMockResult(body.feature, body.payload as SeoFeatureFormState)
      );
    }

    const client = new DataForSeoClient();
    let result: SeoResult | KeywordResearchResponse;

    switch (body.feature) {
      case "overview":
        result = await handleOverview(client, body.payload as SeoFeatureFormState);
        break;
      case "serp":
        result = await handleSerp(client, body.payload as SeoFeatureFormState);
        break;
      case "backlinks":
        result = await handleBacklinks(client, body.payload as SeoFeatureFormState);
        break;
      case "audit":
        result = await handleAudit(client, body.payload as SeoFeatureFormState);
        break;
      case "competitors":
        result = await handleCompetitors(client, body.payload as SeoFeatureFormState);
        break;
      default:
        return NextResponse.json(
          { error: "Funktion wird nicht unterstützt." },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Serverfehler";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
