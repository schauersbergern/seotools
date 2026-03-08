"use client";

import { startTransition, useState } from "react";
import { KeywordResearchWorkspace } from "@/components/keyword-research/workspace";
import {
  deviceOptions,
  languageOptions,
  locationOptions,
  osOptions
} from "@/lib/market-options";
import type {
  SeoFeature,
  SeoFeatureFormState,
  SeoResult,
  StandardSeoFeature,
  TableRow
} from "@/lib/types";

const features: Array<{
  id: SeoFeature;
  label: string;
  description: string;
}> = [
  {
    id: "overview",
    label: "Überblick",
    description: "Domain-Überblick mit Rankings, Backlinks und Wettbewerbern."
  },
  {
    id: "keywords",
    label: "Keyword-Recherche",
    description:
      "Eigenständiger Workspace für Matching Terms, Fragen, Cluster, BID und KI-/Brand-Gaps."
  },
  {
    id: "serp",
    label: "SERP-Analyse",
    description: "Live-SERP-Analyse für ein Keyword."
  },
  {
    id: "backlinks",
    label: "Backlink-Analyse",
    description: "Autoritäts-Überblick und verweisende Seiten."
  },
  {
    id: "audit",
    label: "Seiten-Audit",
    description: "On-Page-Prüfung für eine URL oder Startseite."
  },
  {
    id: "competitors",
    label: "Wettbewerber",
    description: "Wettbewerber und Keyword-Überschneidungen."
  }
];

const sharedState = {
  locationName: "Germany",
  languageName: "German",
  device: "desktop",
  os: "windows",
  enableBrowserRendering: false
};

const initialState: Record<StandardSeoFeature, SeoFeatureFormState> = {
  overview: {
    ...sharedState,
    domain: "hubspot.com",
    compareDomain: "",
    keyword: "",
    url: ""
  },
  serp: {
    ...sharedState,
    domain: "",
    compareDomain: "",
    keyword: "beste espresso maschine",
    url: ""
  },
  backlinks: {
    ...sharedState,
    domain: "ahrefs.com",
    compareDomain: "",
    keyword: "",
    url: ""
  },
  audit: {
    ...sharedState,
    domain: "https://example.com",
    compareDomain: "",
    keyword: "",
    url: "https://example.com"
  },
  competitors: {
    ...sharedState,
    domain: "semrush.com",
    compareDomain: "ahrefs.com",
    keyword: "",
    url: ""
  }
};

function DataTable({ rows }: { rows: TableRow[] }) {
  if (!rows.length) {
    return <p className="muted">Keine Daten verfügbar.</p>;
  }

  const columns = Object.keys(rows[0]);

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`${rowIndex}-${columns[0]}`}>
              {columns.map((column) => (
                <td key={column}>{String(row[column] ?? "k. A.")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResultView({ result }: { result: SeoResult }) {
  return (
    <div className="results-shell">
      <div className="panel">
        <div className="panel-inner">
          <div className="result-header">
            <div>
              <h2>{result.title}</h2>
              <p className="subtle">
                Ergebnisquelle: {result.mode === "demo" ? "Demo-Modus" : "Live über DataForSEO"}
              </p>
            </div>
            <div className="badge">
              {new Date(result.generatedAt).toLocaleString("de-DE")}
            </div>
          </div>
          <div className="metric-grid" style={{ marginTop: 18 }}>
            {result.summary.map((metric) => (
              <div className="metric-card" key={metric.label}>
                <span>{metric.label}</span>
                <strong>{String(metric.value)}</strong>
                {metric.hint ? <small>{metric.hint}</small> : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      {result.sections.map((section) => (
        <section className="section-card" key={section.id}>
          <h3>{section.title}</h3>
          {section.description ? <p>{section.description}</p> : null}
          {section.metrics?.length ? (
            <div className="metric-grid">
              {section.metrics.map((metric) => (
                <div className="metric-card" key={`${section.id}-${metric.label}`}>
                  <span>{metric.label}</span>
                  <strong>{String(metric.value)}</strong>
                  {metric.hint ? <small>{metric.hint}</small> : null}
                </div>
              ))}
            </div>
          ) : null}
          {section.table?.rows?.length ? <DataTable rows={section.table.rows} /> : null}
          {section.pills?.length ? (
            <div className="pill-list">
              {section.pills.map((pill) => (
                <span className="pill" key={pill}>
                  {pill}
                </span>
              ))}
            </div>
          ) : null}
          {section.notice ? <div className="notice">{section.notice}</div> : null}
        </section>
      ))}
    </div>
  );
}

export function SeoDashboard() {
  const [activeFeature, setActiveFeature] = useState<SeoFeature>("overview");
  const [formState, setFormState] =
    useState<Record<StandardSeoFeature, SeoFeatureFormState>>(initialState);
  const [result, setResult] = useState<SeoResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeConfig = features.find((feature) => feature.id === activeFeature)!;
  const seoFeature =
    activeFeature === "keywords" ? "overview" : activeFeature;
  const values = formState[seoFeature as StandardSeoFeature];
  const showMarketSelectors =
    activeFeature === "overview" ||
    activeFeature === "serp" ||
    activeFeature === "competitors";

  function updateValue<K extends keyof SeoFeatureFormState>(
    key: K,
    value: SeoFeatureFormState[K]
  ) {
    if (activeFeature === "keywords") {
      return;
    }

    setFormState((current) => ({
      ...current,
      [activeFeature]: {
        ...current[activeFeature],
        [key]: value
      }
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (activeFeature === "keywords") {
      return;
    }

    setIsLoading(true);
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/seo", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            feature: activeFeature,
            payload: formState[activeFeature]
          })
        });

        const data = (await response.json()) as SeoResult & { error?: string };
        if (!response.ok) {
          throw new Error(data.error ?? "Anfrage fehlgeschlagen.");
        }

        setResult(data);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unbekannter Fehler."
        );
      } finally {
        setIsLoading(false);
      }
    });
  }

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero-grid">
          <div>
            <p className="eyebrow">SEO-Plattform</p>
            <h1>Baue deine eigene Suchdaten-Plattform.</h1>
            <p>
              Diese App bildet die Kernmodule eines Ahrefs- oder Semrush-ähnlichen
              SEO-Workflows auf Basis der DataForSEO API ab. Die API-Zugriffe laufen
              serverseitig, damit Zugangsdaten nicht im Browser landen.
            </p>
          </div>
          <div className="hero-aside">
            <div className="callout">
              <strong>Module</strong>
              <span>
                Überblick, Keyword-Workspace, SERP-Analyse, Backlink-Analyse,
                Seiten-Audit und Wettbewerb.
              </span>
            </div>
            <div className="callout">
              <strong>Keyword-Recherche-Fokus</strong>
              <span>
                Matching Terms, Fragen, Cluster, Tool-Chancen, Business-Potenzial,
                Schwierigkeit und KI-/Brand-Gap in einem eigenen Arbeitsbereich.
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="tab-bar">
        {features.map((feature) => (
          <button
            className={`tab-button ${feature.id === activeFeature ? "active" : ""}`}
            key={feature.id}
            onClick={() => setActiveFeature(feature.id)}
            type="button"
          >
            {feature.label}
          </button>
        ))}
      </div>

      {activeFeature === "keywords" ? (
        <KeywordResearchWorkspace />
      ) : (
        <div className="dashboard-grid">
          <section className="panel">
            <div className="panel-inner">
              <h2>{activeConfig.label}</h2>
              <p className="subtle">{activeConfig.description}</p>

              <form className="stack" onSubmit={handleSubmit} style={{ marginTop: 20 }}>
                {(activeFeature === "overview" ||
                  activeFeature === "backlinks" ||
                  activeFeature === "competitors") && (
                  <div className="field">
                    <label htmlFor="domain">Domain</label>
                    <input
                      id="domain"
                      onChange={(event) => updateValue("domain", event.target.value)}
                      placeholder="example.com"
                      value={values.domain}
                    />
                  </div>
                )}

                {activeFeature === "serp" && (
                  <div className="field">
                    <label htmlFor="keyword">Keyword</label>
                    <input
                      id="keyword"
                      onChange={(event) => updateValue("keyword", event.target.value)}
                      placeholder="beste espresso maschine"
                      value={values.keyword}
                    />
                  </div>
                )}

                {activeFeature === "audit" && (
                  <>
                    <div className="field">
                      <label htmlFor="url">URL</label>
                      <input
                        id="url"
                        onChange={(event) => updateValue("url", event.target.value)}
                        placeholder="https://example.com"
                        value={values.url}
                      />
                    </div>
                    <label className="checkbox-row">
                      <input
                        checked={values.enableBrowserRendering}
                        onChange={(event) =>
                          updateValue("enableBrowserRendering", event.target.checked)
                        }
                        type="checkbox"
                      />
                      Browser-Rendering aktivieren
                    </label>
                  </>
                )}

                {activeFeature === "competitors" && (
                  <div className="field">
                    <label htmlFor="compare-domain">Vergleichsdomain</label>
                    <input
                      id="compare-domain"
                      onChange={(event) => updateValue("compareDomain", event.target.value)}
                      placeholder="wettbewerber.de"
                      value={values.compareDomain}
                    />
                  </div>
                )}

                {showMarketSelectors && (
                  <>
                    <div className="split">
                      <div className="field">
                        <label htmlFor="location">Standort</label>
                        <select
                          id="location"
                          onChange={(event) => updateValue("locationName", event.target.value)}
                          value={values.locationName}
                        >
                          {locationOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="language">Sprache</label>
                        <select
                          id="language"
                          onChange={(event) => updateValue("languageName", event.target.value)}
                          value={values.languageName}
                        >
                          {languageOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {activeFeature === "serp" && (
                      <div className="split">
                        <div className="field">
                          <label htmlFor="device">Gerät</label>
                          <select
                            id="device"
                            onChange={(event) => updateValue("device", event.target.value)}
                            value={values.device}
                          >
                            {deviceOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <label htmlFor="os">Betriebssystem</label>
                          <select
                            id="os"
                            onChange={(event) => updateValue("os", event.target.value)}
                            value={values.os}
                          >
                            {osOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </>
                )}

                <button className="primary-button" disabled={isLoading} type="submit">
                  {isLoading ? "Daten werden geladen..." : "Analyse starten"}
                </button>
              </form>
            </div>
          </section>

          <section>
            {error ? <div className="status error">{error}</div> : null}
            {isLoading ? (
              <div className="status loading">Daten werden geladen…</div>
            ) : null}
            {result ? (
              <ResultView result={result} />
            ) : (
              <div className="empty-state">
                <p className="eyebrow">Bereit</p>
                <h2>{activeConfig.label}</h2>
                <p>{activeConfig.description}</p>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
