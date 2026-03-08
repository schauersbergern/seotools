import {
  buildHeroPrompt,
  detectToolOpportunity,
  estimateBusinessPotential,
  getClusterLabel,
  getParentTopicLabel,
  inferIntentFromKeyword,
  parseList
} from "@/lib/keyword-research";
import type {
  KeywordResearchFormState,
  KeywordResearchResponse,
  SeoFeatureFormState,
  StandardSeoFeature,
  SeoResult
} from "@/lib/types";

function baseResult(feature: StandardSeoFeature, title: string): SeoResult {
  return {
    feature,
    mode: "demo",
    title,
    generatedAt: new Date().toISOString(),
    summary: [],
    sections: []
  };
}

export function getMockKeywordResearchResponse(
  payload: KeywordResearchFormState
): KeywordResearchResponse {
  const seeds = parseList(payload.seeds || "espresso machine\ncoffee grinder");
  const modifiers = parseList(payload.modifiers || "best\nreview\nchecker");
  const includeTerms = parseList(payload.includeTerms || "tool\ncalculator");
  const excludeTerms = parseList(payload.excludeTerms || "free");
  const monetization = parseList(payload.monetization || "affiliate\nads");
  const keywords = [
    "best espresso machine",
    "espresso machine review",
    "espresso machine calculator",
    "how to clean espresso machine",
    "coffee grinder comparison",
    "espresso ratio calculator",
    "espresso machine under 500",
    "beste espresso maschine für zuhause",
    "espresso machine vs coffee maker",
    "grinder size checker",
    "what is espresso extraction",
    "espresso puck prep tool"
  ];

  const rows = keywords.map((keyword, index) => {
    const businessPotential = estimateBusinessPotential(keyword, monetization);

    return {
      keyword,
      searchIntent: inferIntentFromKeyword(keyword),
      difficultyApprox: [18, 22, 16, 38, 24, 14, 20, 21, 25, 17, 33, 19][index] ?? 20,
      searchVolume: [36000, 12100, 1600, 2400, 5400, 1900, 6600, 8100, 2900, 950, 1200, 720][
        index
      ] ?? 500,
      trend: (["wachsend", "stabil", "wachsend", "stabil", "stabil", "wachsend"] as const)[
        index % 6
      ],
      growth12m: [9, 4, 18, 6, 7, 22, 11, 8, 3, 17, 2, 12][index] ?? 0,
      lowestAuthority: [24, 29, 18, 41, 31, 16, 23, 26, 28, 17, 39, 20][index] ?? 25,
      trafficPotential: [41000, 14800, 2200, 3000, 6200, 2600, 7400, 9600, 3400, 1200, 1600, 900][
        index
      ] ?? 700,
      cpc: [0.45, 0.41, 1.1, 0.2, 0.67, 0.6, 0.73, 0.69, 0.38, 0.52, 0.19, 0.57][index] ?? 0.2,
      parentTopic: getParentTopicLabel(keyword, seeds),
      aiRisk: (["mittel", "mittel", "niedrig", "hoch"] as const)[index % 4],
      toolOpportunity: detectToolOpportunity(keyword),
      termCluster: getClusterLabel(keyword, [...modifiers, ...includeTerms], seeds),
      serpFeatures: index % 3 === 0 ? ["featured_snippet", "people_also_ask"] : ["organic"],
      language: payload.languageName || "German",
      competition: 0.14 + index * 0.03,
      businessPotential: businessPotential.score,
      businessPotentialReason: businessPotential.reason,
      hasAiOverview: index % 4 === 3,
      minRefDomains: [14, 18, 8, 33, 19, 6, 12, 13, 16, 7, 24, 10][index] ?? 10,
      serpFormat: ["Vergleich oder Review", "Ratgeber", "Tool", "Produkt- oder Kategorieseite"][
        index % 4
      ]
    };
  });

  const questions = rows.filter(
    (row) => row.keyword.startsWith("how ") || row.keyword.startsWith("what ")
  );
  const termClusterCounts = Array.from(
    rows.reduce<Map<string, number>>((accumulator, row) => {
      accumulator.set(row.termCluster, (accumulator.get(row.termCluster) ?? 0) + 1);
      return accumulator;
    }, new Map<string, number>())
  ).map(([label, count]) => ({
    label,
    count,
    share: Math.round((count / rows.length) * 100)
  }));
  const parentTopicCounts = Array.from(
    rows.reduce<Map<string, number>>((accumulator, row) => {
      accumulator.set(row.parentTopic, (accumulator.get(row.parentTopic) ?? 0) + 1);
      return accumulator;
    }, new Map<string, number>())
  ).map(([label, count]) => ({
    label,
    count,
    share: Math.round((count / rows.length) * 100)
  }));

  return {
    mode: "demo",
    generatedAt: new Date().toISOString(),
    query: {
      seeds,
      modifiers,
      includeTerms,
      excludeTerms,
      monetization,
      matchingMode: payload.matchingMode,
      reportType: "matching_terms",
      resultLimit: 50,
      locationName: payload.locationName,
      languageName: payload.languageName,
      ownBrandLabel: payload.ownBrandLabel,
      ownBrandDomain: payload.ownBrandDomain,
      competitorDomains: parseList(payload.competitorDomains).slice(0, 3),
      aiPlatform: payload.aiPlatform
    },
    heroPrompt: buildHeroPrompt(payload, seeds, modifiers),
    summary: [
      { label: "Seeds", value: seeds.length },
      { label: "Modifier", value: modifiers.length + includeTerms.length },
      { label: "Matching Terms", value: rows.length },
      { label: "Tool-Chancen", value: rows.filter((row) => row.toolOpportunity).length }
    ],
    matchingTerms: rows,
    questions,
    termClusters: termClusterCounts,
    parentTopicClusters: parentTopicCounts,
    bidQueue: rows.slice(0, 6).map((row) => ({
      keyword: row.keyword,
      businessPotential: row.businessPotential,
      businessPotentialReason: row.businessPotentialReason,
      searchIntent: row.searchIntent,
      serpFormat: row.serpFormat,
      aiRisk: row.aiRisk,
      difficultyApprox: row.difficultyApprox,
      lowestAuthority: row.lowestAuthority,
      minRefDomains: row.minRefDomains,
      recommendation:
        row.businessPotential >= 3 && row.aiRisk !== "hoch"
          ? "Targeten"
          : "Nur mit starkem Mehrwert"
    })),
    toolOpportunities: rows
      .filter((row) => row.toolOpportunity)
      .map((row) => ({
        keyword: row.keyword,
        searchVolume: row.searchVolume,
        cpc: row.cpc,
        parentTopic: row.parentTopic,
        businessPotential: row.businessPotential,
        aiRisk: row.aiRisk,
        toolPattern: row.termCluster
      })),
    aiBrandGap: {
      platform: payload.aiPlatform,
      platformEnabled: payload.aiPlatform === "google",
      platformReason:
        payload.aiPlatform === "google"
          ? undefined
          : "ChatGPT-Mentions sind im Demo-Modus für diesen Markt deaktiviert.",
      ownBrandLabel: payload.ownBrandLabel || "Eigene Marke",
      ownBrandDomain: payload.ownBrandDomain || "example.com",
      competitors: parseList(payload.competitorDomains || "competitor-one.com\ncompetitor-two.com")
        .slice(0, 3)
        .map((domain) => ({ label: domain, domain })),
      coverage: [
        { label: "Eigene Marke", value: payload.ownBrandLabel || "Eigene Marke" },
        {
          label: "Wettbewerber",
          value: parseList(payload.competitorDomains || "competitor-one.com").slice(0, 3).length
        },
        { label: "Gap-Prompts", value: 3 },
        { label: "Status", value: "Demo-Lücken" }
      ],
      gaps: [
        {
          prompt: "best espresso machine for home",
          keyword: "best espresso machine",
          competitor: "competitor-one.com",
          competitorMentions: 5,
          ownMentions: 0,
          opportunityScore: 88
        },
        {
          prompt: "espresso ratio calculator",
          keyword: "espresso ratio calculator",
          competitor: "competitor-two.com",
          competitorMentions: 4,
          ownMentions: 0,
          opportunityScore: 80
        },
        {
          prompt: "how to clean espresso machine",
          keyword: "how to clean espresso machine",
          competitor: "competitor-one.com",
          competitorMentions: 3,
          ownMentions: 0,
          opportunityScore: 72
        }
      ]
    },
    warnings: [
      excludeTerms.length
        ? `Exclude-Filter aktiv: ${excludeTerms.join(", ")}`
        : "Demo-Modus aktiv: dieselbe Seitenstruktur wie live, aber mit statischen Daten."
    ]
  };
}

export function getMockResult(
  feature: StandardSeoFeature,
  payload: SeoFeatureFormState
): SeoResult {
  switch (feature) {
    case "overview": {
      const result = baseResult(
        feature,
        `Domain-Überblick für ${payload.domain || "example.com"}`
      );
      result.summary = [
        { label: "Ziel-Domain", value: payload.domain || "example.com" },
        { label: "Verweisende Domains", value: "12.480" },
        { label: "Backlinks", value: "148.300" },
        { label: "Organische Wettbewerber", value: "356" }
      ];
      result.sections = [
        {
          id: "overview-keywords",
          title: "Top-Rankings",
          description: "Demo-Daten für organische Top-Keywords.",
          table: {
            columns: [],
            rows: [
              {
                Keyword: "beste espresso maschine",
                "Pos.": "3",
                Suchvolumen: "18.100",
                Besucherpotenzial: "2.340"
              },
              {
                Keyword: "espresso maschine test",
                "Pos.": "4",
                Suchvolumen: "12.100",
                Besucherpotenzial: "1.920"
              }
            ]
          }
        }
      ];
      return result;
    }
    case "serp": {
      const result = baseResult(
        feature,
        `SERP-Analyse für "${payload.keyword || "beste seo software"}"`
      );
      result.summary = [
        { label: "Keyword", value: payload.keyword || "beste seo software" },
        { label: "Organische Treffer", value: "10" },
        { label: "SERP-Features", value: "4" },
        { label: "Gerät", value: `${payload.device} / ${payload.os}` }
      ];
      result.sections = [
        {
          id: "serp-organic",
          title: "Top-SERP-Ergebnisse",
          table: {
            columns: [],
            rows: [
              {
                "Pos.": "1",
                Titel: "10 SEO-Tools im Vergleich",
                Domain: "example.org",
                URL: "https://example.org/beste-seo-tools"
              }
            ]
          }
        }
      ];
      return result;
    }
    case "backlinks": {
      const result = baseResult(
        feature,
        `Backlink-Analyse für ${payload.domain || "example.com"}`
      );
      result.summary = [
        { label: "Verweisende Domains", value: "9.420" },
        { label: "Verweisende Seiten", value: "51.380" },
        { label: "Externe Links", value: "112.200" },
        { label: "Defekte Backlinks", value: "380" }
      ];
      result.sections = [
        {
          id: "backlinks-list",
          title: "Top-Backlinks",
          table: {
            columns: [],
            rows: [
              {
                "Quell-Domain": "example.org",
                "Quell-URL": "https://example.org/review",
                Ankertext: "SEO Plattform",
                "Follow-Link": "Ja"
              }
            ]
          }
        }
      ];
      return result;
    }
    case "audit": {
      const result = baseResult(
        feature,
        `On-Page-Audit für ${payload.url || payload.domain || "https://example.com"}`
      );
      result.summary = [
        { label: "URL", value: payload.url || payload.domain || "https://example.com" },
        { label: "Status-Code", value: "200" },
        { label: "Titel", value: "Vorhanden" },
        { label: "Kanonisch", value: "Ja" }
      ];
      result.sections = [
        {
          id: "audit-issues",
          title: "Auffällige Punkte",
          pills: ["Bilder ohne ALT-Texte", "Meta-Beschreibung zu kurz"]
        }
      ];
      return result;
    }
    case "competitors": {
      const result = baseResult(feature, "Wettbewerbsanalyse");
      result.summary = [
        { label: "Ziel-Domain", value: payload.domain || "example.com" },
        { label: "Wettbewerber", value: "12" },
        { label: "Vergleichsdomain", value: payload.compareDomain || "nicht gesetzt" },
        { label: "Markt", value: `${payload.locationName} / ${payload.languageName}` }
      ];
      result.sections = [
        {
          id: "competitors-domain",
          title: "SERP-Wettbewerber",
          table: {
            columns: [],
            rows: [
              {
                Domain: "competitor-one.com",
                "Gemeinsame Keywords": "420",
                "Ø-Position": "11",
                Besucherpotenzial: "3.200"
              },
              {
                Domain: "competitor-two.com",
                "Gemeinsame Keywords": "389",
                "Ø-Position": "14",
                Besucherpotenzial: "2.900"
              }
            ]
          }
        }
      ];
      return result;
    }
  }
}
