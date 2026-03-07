import type { FeatureFormState, SeoFeature, SeoResult } from "@/lib/types";

function baseResult(feature: SeoFeature, title: string): SeoResult {
  return {
    feature,
    mode: "demo",
    title,
    generatedAt: new Date().toISOString(),
    summary: [],
    sections: []
  };
}

export function getMockResult(
  feature: SeoFeature,
  payload: FeatureFormState
): SeoResult {
  switch (feature) {
    case "overview": {
      const result = baseResult(
        feature,
        `Domain Overview fuer ${payload.domain || "example.com"}`
      );
      result.summary = [
        { label: "Target", value: payload.domain || "example.com" },
        { label: "Ref. Domains", value: "12.480" },
        { label: "Backlinks", value: "148.300" },
        { label: "Organic Competitors", value: "356" }
      ];
      result.sections = [
        {
          id: "overview-keywords",
          title: "Top Rankings",
          description: "Demo-Daten fuer organische Top-Keywords.",
          table: {
            columns: [],
            rows: [
              {
                Keyword: "seo software",
                "Pos.": "3",
                "Search Vol.": "18.100",
                Traffic: "2.340"
              },
              {
                Keyword: "rank tracker",
                "Pos.": "4",
                "Search Vol.": "12.100",
                Traffic: "1.920"
              },
              {
                Keyword: "backlink checker",
                "Pos.": "6",
                "Search Vol.": "9.900",
                Traffic: "1.210"
              }
            ]
          }
        },
        {
          id: "overview-competitors",
          title: "Wettbewerber",
          table: {
            columns: [],
            rows: [
              {
                Domain: "ahrefs.com",
                "Shared KW": "16.430",
                "Avg. Position": "11.2",
                Traffic: "52.400"
              },
              {
                Domain: "semrush.com",
                "Shared KW": "15.980",
                "Avg. Position": "10.6",
                Traffic: "49.870"
              }
            ]
          }
        }
      ];
      return result;
    }
    case "keywords": {
      const result = baseResult(feature, "Keyword Research");
      result.summary = [
        { label: "Seeds", value: "3" },
        { label: "Avg. Search Vol.", value: "8.740" },
        { label: "Location", value: payload.locationName },
        { label: "Language", value: payload.languageName }
      ];
      result.sections = [
        {
          id: "keyword-metrics",
          title: "Seed Keywords",
          table: {
            columns: [],
            rows: [
              {
                Keyword: "seo tool",
                "Search Vol.": "14.800",
                Competition: "0.73",
                CPC: "$9.40"
              },
              {
                Keyword: "keyword research",
                "Search Vol.": "6.600",
                Competition: "0.41",
                CPC: "$4.60"
              }
            ]
          }
        },
        {
          id: "keyword-ideas",
          title: "Keyword Ideen",
          table: {
            columns: [],
            rows: [
              {
                Keyword: "best seo tool for agencies",
                "Search Vol.": "1.900",
                Competition: "0.56",
                CPC: "$7.20"
              },
              {
                Keyword: "keyword research workflow",
                "Search Vol.": "1.300",
                Competition: "0.28",
                CPC: "$3.10"
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
        `SERP Analyse fuer "${payload.keyword || "best seo tools"}"`
      );
      result.summary = [
        { label: "Keyword", value: payload.keyword || "best seo tools" },
        { label: "Organic Results", value: "10" },
        { label: "SERP Features", value: "4" },
        { label: "Device", value: `${payload.device} / ${payload.os}` }
      ];
      result.sections = [
        {
          id: "serp-organic",
          title: "Top SERP Ergebnisse",
          table: {
            columns: [],
            rows: [
              {
                "Pos.": "1",
                Titel: "10 Best SEO Tools Compared",
                Domain: "example.org",
                URL: "https://example.org/best-seo-tools"
              },
              {
                "Pos.": "2",
                Titel: "SEO Tools for Growing Teams",
                Domain: "example.com",
                URL: "https://example.com/seo-tools"
              }
            ]
          }
        },
        {
          id: "serp-features",
          title: "SERP Feature Mix",
          metrics: [
            { label: "organic", value: "10" },
            { label: "people_also_ask", value: "1" },
            { label: "featured_snippet", value: "1" },
            { label: "video", value: "2" }
          ]
        }
      ];
      return result;
    }
    case "backlinks": {
      const result = baseResult(
        feature,
        `Backlink Analyse fuer ${payload.domain || "example.com"}`
      );
      result.summary = [
        { label: "Ref. Domains", value: "9.420" },
        { label: "Ref. Pages", value: "71.380" },
        { label: "External Links", value: "118.500" },
        { label: "Broken Backlinks", value: "312" }
      ];
      result.sections = [
        {
          id: "backlinks-summary",
          title: "Authority Snapshot",
          metrics: [
            { label: "Rank", value: "74.8" },
            { label: "Broken Pages", value: "18" },
            { label: "Lost Backlinks", value: "1.210" },
            { label: "New Backlinks", value: "1.880" }
          ]
        },
        {
          id: "backlinks-list",
          title: "Top Backlinks",
          table: {
            columns: [],
            rows: [
              {
                "Source Domain": "marketingblog.com",
                "Source URL": "https://marketingblog.com/resources",
                Anchor: "best seo platform",
                DoFollow: "Ja"
              },
              {
                "Source Domain": "growthweekly.io",
                "Source URL": "https://growthweekly.io/tool-stack",
                Anchor: "seo suite",
                DoFollow: "Nein"
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
        `On-Page Audit fuer ${payload.url || payload.domain || "https://example.com"}`
      );
      result.summary = [
        { label: "URL", value: payload.url || "https://example.com" },
        { label: "Status Code", value: "200" },
        { label: "Title", value: "Vorhanden" },
        { label: "Canonical", value: "Ja" }
      ];
      result.sections = [
        {
          id: "audit-core",
          title: "Page Checks",
          metrics: [
            { label: "Description", value: "Vorhanden" },
            { label: "H1", value: "Vorhanden" },
            { label: "SEO URL", value: "Ja" },
            { label: "Charset", value: "65001" }
          ]
        },
        {
          id: "audit-issues",
          title: "Auffaellige Punkte",
          pills: [
            "Bilder ohne ALT-Texte",
            "Meta Description koennte laenger sein",
            "Groesse der Seite ist ueber dem Zielwert"
          ]
        }
      ];
      return result;
    }
    case "competitors": {
      const result = baseResult(feature, "Competitor Gap Analyse");
      result.summary = [
        { label: "Target", value: payload.domain || "example.com" },
        { label: "Competitors", value: "15" },
        { label: "Compare Domain", value: payload.compareDomain || "ahrefs.com" },
        { label: "Market", value: `${payload.locationName} / ${payload.languageName}` }
      ];
      result.sections = [
        {
          id: "competitors-domain",
          title: "SERP Wettbewerber",
          table: {
            columns: [],
            rows: [
              {
                Domain: "ahrefs.com",
                "Shared KW": "17.200",
                "Avg. Position": "8.2",
                Traffic: "51.200"
              },
              {
                Domain: "moz.com",
                "Shared KW": "11.820",
                "Avg. Position": "14.1",
                Traffic: "24.400"
              }
            ]
          }
        },
        {
          id: "competitors-gap",
          title: "Keyword Intersection",
          table: {
            columns: [],
            rows: [
              {
                Keyword: "seo dashboard",
                "example.com Pos.": "7",
                "ahrefs.com Pos.": "3",
                "Search Vol.": "2.900"
              },
              {
                Keyword: "keyword tracker",
                "example.com Pos.": "11",
                "ahrefs.com Pos.": "6",
                "Search Vol.": "1.600"
              }
            ]
          }
        }
      ];
      return result;
    }
  }
}
