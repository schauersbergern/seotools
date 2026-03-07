import { NextResponse } from "next/server";
import {
  DataForSeoClient,
  hasDataForSeoCredentials,
  type DataForSeoTask
} from "@/lib/dataforseo";
import { getMockResult } from "@/lib/mock-data";
import type {
  FeatureFormState,
  Metric,
  SeoFeature,
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

function toArray(value: string) {
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function formatNumber(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "n/a";
  }

  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: value >= 100 ? 0 : 2
  }).format(value);
}

function formatCurrency(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "n/a";
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
            : String(value ?? "n/a");
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

async function handleOverview(
  client: DataForSeoClient,
  payload: FeatureFormState
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
    {
      label: "Target",
      value: target
    },
    {
      label: "Ref. Domains",
      value: formatNumber(backlinksSummary.referring_domains)
    },
    {
      label: "Backlinks",
      value: formatNumber(
        backlinksSummary.external_links_count ?? backlinksSummary.backlinks
      )
    },
    {
      label: "Organic Competitors",
      value: formatNumber(
        (extractFirstResult(competitorsResponse)?.items_count as number | undefined) ??
          competitorItems.length
      )
    }
  ];

  return {
    feature: "overview",
    mode: "live",
    title: `Domain Overview fuer ${target}`,
    generatedAt: new Date().toISOString(),
    summary,
    sections: [
      {
        id: "overview-keywords",
        title: "Top Rankings",
        description:
          "Stichprobe der Keywords, fuer die die Domain aktuell organisch rankt.",
        table: {
          columns: [
            { key: "keyword_data.keyword", label: "Keyword" },
            { key: "ranked_serp_element.serp_item.rank_absolute", label: "Pos." },
            { key: "keyword_data.keyword_info.search_volume", label: "Search Vol." },
            { key: "ranked_serp_element.serp_item.etv", label: "Traffic" }
          ],
          rows: buildRows(rankedItems, [
            { key: "keyword_data.keyword", label: "Keyword" },
            { key: "ranked_serp_element.serp_item.rank_absolute", label: "Pos." },
            { key: "keyword_data.keyword_info.search_volume", label: "Search Vol." },
            { key: "ranked_serp_element.serp_item.etv", label: "Traffic" }
          ])
        }
      },
      {
        id: "overview-competitors",
        title: "Wettbewerber",
        description:
          "Domains mit hoher SERP-Ueberschneidung basierend auf den Google-Rankings aus DataForSEO Labs.",
        table: {
          columns: [
            { key: "domain", label: "Domain" },
            { key: "intersections", label: "Shared KW" },
            { key: "avg_position", label: "Avg. Position" },
            { key: "etv", label: "Traffic" }
          ],
          rows: buildRows(competitorItems, [
            { key: "domain", label: "Domain" },
            { key: "intersections", label: "Shared KW" },
            { key: "avg_position", label: "Avg. Position" },
            { key: "etv", label: "Traffic" }
          ])
        }
      },
      {
        id: "overview-notes",
        title: "Backlink Snapshot",
        metrics: [
          {
            label: "Ref. Pages",
            value: formatNumber(backlinksSummary.referring_pages)
          },
          {
            label: "Broken Backlinks",
            value: formatNumber(backlinksSummary.broken_backlinks)
          },
          {
            label: "Broken Pages",
            value: formatNumber(backlinksSummary.broken_pages)
          },
          {
            label: "Rank",
            value: formatNumber(backlinksSummary.rank)
          }
        ]
      }
    ]
  };
}

async function handleKeywords(
  client: DataForSeoClient,
  payload: FeatureFormState
): Promise<SeoResult> {
  const keywords = toArray(payload.keywords).slice(0, 20);
  const requestTask: DataForSeoTask = {
    keywords,
    location_name: payload.locationName,
    language_name: payload.languageName
  };

  const [searchVolumeResponse, suggestionsResponse] = await Promise.all([
    client.post("keywords_data/google_ads/search_volume/live", requestTask),
    client.post("keywords_data/google_ads/keywords_for_keywords/live", {
      ...requestTask,
      limit: 20
    })
  ]);

  const searchVolumeItems = extractItems(searchVolumeResponse);
  const suggestionItems = extractItems(suggestionsResponse);

  const averageVolume =
    searchVolumeItems.reduce((sum, item) => {
      return sum + Number(item.search_volume ?? 0);
    }, 0) / Math.max(searchVolumeItems.length, 1);

  return {
    feature: "keywords",
    mode: "live",
    title: "Keyword Research",
    generatedAt: new Date().toISOString(),
    summary: [
      { label: "Seeds", value: keywords.length },
      { label: "Avg. Search Vol.", value: formatNumber(averageVolume) },
      {
        label: "Location",
        value: payload.locationName
      },
      {
        label: "Language",
        value: payload.languageName
      }
    ],
    sections: [
      {
        id: "keyword-metrics",
        title: "Seed Keywords",
        description:
          "Suchvolumen, CPC und Wettbewerbsdaten aus der Google Ads Keywords Data API.",
        table: {
          columns: [
            { key: "keyword", label: "Keyword" },
            { key: "search_volume", label: "Search Vol." },
            { key: "competition", label: "Competition" },
            { key: "cpc", label: "CPC" }
          ],
          rows: searchVolumeItems.map((item) => ({
            Keyword: String(item.keyword ?? "n/a"),
            "Search Vol.": formatNumber(item.search_volume),
            Competition: formatNumber(item.competition),
            CPC: formatCurrency(item.cpc)
          }))
        }
      },
      {
        id: "keyword-ideas",
        title: "Keyword Ideen",
        description:
          "Automatisch generierte Keyword-Erweiterungen fuer die eingegebenen Seeds.",
        table: {
          columns: [
            { key: "keyword", label: "Keyword" },
            { key: "search_volume", label: "Search Vol." },
            { key: "competition", label: "Competition" },
            { key: "cpc", label: "CPC" }
          ],
          rows: suggestionItems.map((item) => ({
            Keyword: String(item.keyword ?? "n/a"),
            "Search Vol.": formatNumber(item.search_volume),
            Competition: formatNumber(item.competition),
            CPC: formatCurrency(item.cpc)
          }))
        }
      }
    ]
  };
}

async function handleSerp(
  client: DataForSeoClient,
  payload: FeatureFormState
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
    title: `SERP Analyse fuer "${payload.keyword}"`,
    generatedAt: new Date().toISOString(),
    summary: [
      { label: "Keyword", value: payload.keyword },
      { label: "Organic Results", value: organicItems.length },
      { label: "SERP Features", value: items.length - organicItems.length },
      { label: "Device", value: `${payload.device} / ${payload.os}` }
    ],
    sections: [
      {
        id: "serp-organic",
        title: "Top SERP Ergebnisse",
        description:
          "Google Organic SERP Advanced Daten fuer das ausgewaehlte Keyword.",
        table: {
          columns: [
            { key: "rank_absolute", label: "Pos." },
            { key: "title", label: "Titel" },
            { key: "domain", label: "Domain" },
            { key: "url", label: "URL" }
          ],
          rows: organicItems.map((item) => ({
            "Pos.": formatNumber(item.rank_absolute),
            Titel: String(item.title ?? "n/a"),
            Domain: String(item.domain ?? "n/a"),
            URL: String(item.url ?? "n/a")
          }))
        }
      },
      {
        id: "serp-features",
        title: "SERP Feature Mix",
        metrics: Object.entries(featureCounts).map(([label, value]) => ({
          label,
          value
        })),
        notice:
          "Je nach Keyword koennen neben organischen Treffern auch andere SERP-Features wie FAQs, Maps oder Featured Snippets auftauchen."
      }
    ]
  };
}

async function handleBacklinks(
  client: DataForSeoClient,
  payload: FeatureFormState
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
    title: `Backlink Analyse fuer ${target}`,
    generatedAt: new Date().toISOString(),
    summary: [
      {
        label: "Ref. Domains",
        value: formatNumber(summaryResult.referring_domains)
      },
      {
        label: "Ref. Pages",
        value: formatNumber(summaryResult.referring_pages)
      },
      {
        label: "External Links",
        value: formatNumber(summaryResult.external_links_count)
      },
      {
        label: "Broken Backlinks",
        value: formatNumber(summaryResult.broken_backlinks)
      }
    ],
    sections: [
      {
        id: "backlinks-summary",
        title: "Authority Snapshot",
        metrics: [
          {
            label: "Rank",
            value: formatNumber(summaryResult.rank)
          },
          {
            label: "Broken Pages",
            value: formatNumber(summaryResult.broken_pages)
          },
          {
            label: "Lost Backlinks",
            value: formatNumber(summaryResult.lost_backlinks)
          },
          {
            label: "New Backlinks",
            value: formatNumber(summaryResult.new_backlinks)
          }
        ]
      },
      {
        id: "backlinks-list",
        title: "Top Backlinks",
        description:
          "Auszug der verweisenden Seiten inklusive Ankertext und Linktyp.",
        table: {
          columns: [
            { key: "domain_from", label: "Source Domain" },
            { key: "url_from", label: "Source URL" },
            { key: "anchor", label: "Anchor" },
            { key: "dofollow", label: "DoFollow" }
          ],
          rows: backlinkItems.map((item) => ({
            "Source Domain": String(item.domain_from ?? "n/a"),
            "Source URL": String(item.url_from ?? "n/a"),
            Anchor: String(item.anchor ?? "n/a"),
            DoFollow:
              typeof item.dofollow === "boolean"
                ? item.dofollow
                  ? "Ja"
                  : "Nein"
                : "n/a"
          }))
        }
      }
    ]
  };
}

async function handleAudit(
  client: DataForSeoClient,
  payload: FeatureFormState
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
    meta.no_title ? "Kein oder leerer Title Tag" : null,
    meta.no_description ? "Keine oder leere Meta Description" : null,
    meta.no_h1_tag ? "Kein H1 gefunden" : null,
    meta.no_image_alt ? "Bilder ohne ALT-Texte" : null,
    meta.large_page_size ? "Seite ist groesser als empfohlen" : null,
    meta.https_to_http_links ? "HTTP-Links auf HTTPS-Seite" : null,
    meta.has_misspelling ? "Moegliche Rechtschreibfehler erkannt" : null
  ].filter(Boolean) as string[];

  return {
    feature: "audit",
    mode: "live",
    title: `On-Page Audit fuer ${url}`,
    generatedAt: new Date().toISOString(),
    summary: [
      { label: "URL", value: String(item.url ?? url) },
      { label: "Status Code", value: formatNumber(item.status_code) },
      {
        label: "Title",
        value: String(meta.title ? "Vorhanden" : "Fehlt")
      },
      {
        label: "Canonical",
        value: typeof meta.canonical === "boolean" ? (meta.canonical ? "Ja" : "Nein") : "n/a"
      }
    ],
    sections: [
      {
        id: "audit-core",
        title: "Page Checks",
        metrics: [
          {
            label: "Description",
            value: meta.no_description ? "Fehlt" : "Vorhanden"
          },
          {
            label: "H1",
            value: meta.no_h1_tag ? "Fehlt" : "Vorhanden"
          },
          {
            label: "SEO URL",
            value:
              typeof meta.seo_friendly_url === "boolean"
                ? meta.seo_friendly_url
                  ? "Ja"
                  : "Nein"
                : "n/a"
          },
          {
            label: "Charset",
            value: String(meta.charset ?? "n/a")
          }
        ]
      },
      {
        id: "audit-issues",
        title: "Auffaellige Punkte",
        pills: issues,
        notice:
          issues.length === 0
            ? "In diesem Audit-Snapshot wurden keine offensichtlichen Standardprobleme erkannt."
            : undefined
      }
    ]
  };
}

async function handleCompetitors(
  client: DataForSeoClient,
  payload: FeatureFormState
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
      title: "SERP Wettbewerber",
      description:
        "Domains mit hoechster Ueberschneidung in organischen Rankings.",
      table: {
        columns: [
          { key: "domain", label: "Domain" },
          { key: "intersections", label: "Shared KW" },
          { key: "avg_position", label: "Avg. Position" },
          { key: "etv", label: "Traffic" }
        ],
        rows: buildRows(competitors, [
          { key: "domain", label: "Domain" },
          { key: "intersections", label: "Shared KW" },
          { key: "avg_position", label: "Avg. Position" },
          { key: "etv", label: "Traffic" }
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
      title: `Keyword Intersection: ${target} vs. ${compareDomain}`,
      description:
        "Keywords, fuer die beide Domains innerhalb derselben SERP ranken.",
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
          { key: "keyword_data.keyword_info.search_volume", label: "Search Vol." }
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
          { key: "keyword_data.keyword_info.search_volume", label: "Search Vol." }
        ])
      }
    });
  }

  return {
    feature: "competitors",
    mode: "live",
    title: "Competitor Gap Analyse",
    generatedAt: new Date().toISOString(),
    summary: [
      { label: "Target", value: target },
      { label: "Competitors", value: competitors.length },
      { label: "Compare Domain", value: compareDomain || "nicht gesetzt" },
      { label: "Market", value: `${payload.locationName} / ${payload.languageName}` }
    ],
    sections
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      feature?: SeoFeature;
      payload?: FeatureFormState;
    };

    if (!body.feature || !body.payload) {
      return NextResponse.json(
        { error: "Ungueltige Anfrage." },
        { status: 400 }
      );
    }

    if (!hasDataForSeoCredentials()) {
      return NextResponse.json(getMockResult(body.feature, body.payload));
    }

    const client = new DataForSeoClient();
    let result: SeoResult;

    switch (body.feature) {
      case "overview":
        result = await handleOverview(client, body.payload);
        break;
      case "keywords":
        result = await handleKeywords(client, body.payload);
        break;
      case "serp":
        result = await handleSerp(client, body.payload);
        break;
      case "backlinks":
        result = await handleBacklinks(client, body.payload);
        break;
      case "audit":
        result = await handleAudit(client, body.payload);
        break;
      case "competitors":
        result = await handleCompetitors(client, body.payload);
        break;
      default:
        return NextResponse.json(
          { error: "Feature wird nicht unterstuetzt." },
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
