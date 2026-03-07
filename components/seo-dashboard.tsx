"use client";

import { startTransition, useState } from "react";
import type {
  FeatureFormState,
  SeoFeature,
  SeoResult,
  TableRow
} from "@/lib/types";

const features: Array<{
  id: SeoFeature;
  label: string;
  description: string;
}> = [
  {
    id: "overview",
    label: "Overview",
    description: "Domain Snapshot mit Rankings, Backlinks und Wettbewerbern."
  },
  {
    id: "keywords",
    label: "Keywords",
    description: "Seed Keywords, Suchvolumen und Keyword-Ideen."
  },
  {
    id: "serp",
    label: "SERP",
    description: "Live SERP-Analyse fuer ein Keyword."
  },
  {
    id: "backlinks",
    label: "Backlinks",
    description: "Authority Snapshot und verweisende Seiten."
  },
  {
    id: "audit",
    label: "Audit",
    description: "On-Page Check fuer eine URL oder Startseite."
  },
  {
    id: "competitors",
    label: "Competitors",
    description: "Wettbewerber und Keyword-Ueberschneidung."
  }
];

const initialState: Record<SeoFeature, FeatureFormState> = {
  overview: {
    domain: "hubspot.com",
    compareDomain: "",
    keywords: "",
    keyword: "",
    url: "",
    locationName: "United States",
    languageName: "English",
    device: "desktop",
    os: "windows",
    enableBrowserRendering: false
  },
  keywords: {
    domain: "",
    compareDomain: "",
    keywords: "seo tool\nkeyword research\nrank tracker",
    keyword: "",
    url: "",
    locationName: "United States",
    languageName: "English",
    device: "desktop",
    os: "windows",
    enableBrowserRendering: false
  },
  serp: {
    domain: "",
    compareDomain: "",
    keywords: "",
    keyword: "best seo tools",
    url: "",
    locationName: "United States",
    languageName: "English",
    device: "desktop",
    os: "windows",
    enableBrowserRendering: false
  },
  backlinks: {
    domain: "ahrefs.com",
    compareDomain: "",
    keywords: "",
    keyword: "",
    url: "",
    locationName: "United States",
    languageName: "English",
    device: "desktop",
    os: "windows",
    enableBrowserRendering: false
  },
  audit: {
    domain: "https://example.com",
    compareDomain: "",
    keywords: "",
    keyword: "",
    url: "https://example.com",
    locationName: "United States",
    languageName: "English",
    device: "desktop",
    os: "windows",
    enableBrowserRendering: false
  },
  competitors: {
    domain: "semrush.com",
    compareDomain: "ahrefs.com",
    keywords: "",
    keyword: "",
    url: "",
    locationName: "United States",
    languageName: "English",
    device: "desktop",
    os: "windows",
    enableBrowserRendering: false
  }
};

function DataTable({ rows }: { rows: TableRow[] }) {
  if (!rows.length) {
    return <p className="muted">Keine Daten verfuegbar.</p>;
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
                <td key={column}>{String(row[column] ?? "n/a")}</td>
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
                Ergebnisquelle: {result.mode === "demo" ? "Demo-Modus" : "Live via DataForSEO"}
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
    useState<Record<SeoFeature, FeatureFormState>>(initialState);
  const [result, setResult] = useState<SeoResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeConfig = features.find((feature) => feature.id === activeFeature)!;
  const values = formState[activeFeature];

  function updateValue<K extends keyof FeatureFormState>(key: K, value: FeatureFormState[K]) {
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
          throw new Error(data.error ?? "Request fehlgeschlagen.");
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
            <p className="eyebrow">SEO Workbench</p>
            <h1>Build your own search intelligence stack.</h1>
            <p>
              Diese App bildet die Kernmodule eines Ahrefs- oder Semrush-aehnlichen
              SEO-Workflows auf Basis der DataForSEO API ab. Die API-Zugriffe laufen
              serverseitig, damit Zugangsdaten nicht im Browser landen.
            </p>
          </div>
          <div className="hero-aside">
            <div className="callout">
              <strong>Module</strong>
              <span>Overview, Keywords, SERP, Backlinks, Audit und Competitor Gap.</span>
            </div>
            <div className="callout">
              <strong>Betriebsmodus</strong>
              <span>
                Ohne gesetzte Credentials rendert die App Demo-Daten, mit Credentials
                verwendet sie die Live-Endpunkte von DataForSEO.
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

              {activeFeature === "keywords" && (
                <div className="field">
                  <label htmlFor="keywords">Seed Keywords</label>
                  <textarea
                    id="keywords"
                    onChange={(event) => updateValue("keywords", event.target.value)}
                    placeholder={"keyword eins\nkeyword zwei"}
                    value={values.keywords}
                  />
                </div>
              )}

              {activeFeature === "serp" && (
                <div className="field">
                  <label htmlFor="keyword">Keyword</label>
                  <input
                    id="keyword"
                    onChange={(event) => updateValue("keyword", event.target.value)}
                    placeholder="best seo software"
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
                    Browser Rendering aktivieren
                  </label>
                </>
              )}

              {activeFeature === "competitors" && (
                <div className="field">
                  <label htmlFor="compare-domain">Vergleichsdomain</label>
                  <input
                    id="compare-domain"
                    onChange={(event) => updateValue("compareDomain", event.target.value)}
                    placeholder="competitor.com"
                    value={values.compareDomain}
                  />
                </div>
              )}

              {(activeFeature === "overview" ||
                activeFeature === "keywords" ||
                activeFeature === "serp" ||
                activeFeature === "competitors") && (
                <>
                  <div className="split">
                    <div className="field">
                      <label htmlFor="location">Location</label>
                      <input
                        id="location"
                        onChange={(event) => updateValue("locationName", event.target.value)}
                        placeholder="United States"
                        value={values.locationName}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="language">Language</label>
                      <input
                        id="language"
                        onChange={(event) => updateValue("languageName", event.target.value)}
                        placeholder="English"
                        value={values.languageName}
                      />
                    </div>
                  </div>
                  {activeFeature === "serp" && (
                    <div className="split">
                      <div className="field">
                        <label htmlFor="device">Device</label>
                        <select
                          id="device"
                          onChange={(event) => updateValue("device", event.target.value)}
                          value={values.device}
                        >
                          <option value="desktop">desktop</option>
                          <option value="mobile">mobile</option>
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="os">OS</label>
                        <select
                          id="os"
                          onChange={(event) => updateValue("os", event.target.value)}
                          value={values.os}
                        >
                          <option value="windows">windows</option>
                          <option value="macos">macos</option>
                          <option value="android">android</option>
                          <option value="ios">ios</option>
                        </select>
                      </div>
                    </div>
                  )}
                </>
              )}

              <button className="primary-button" disabled={isLoading} type="submit">
                {isLoading ? "Lade Daten..." : `${activeConfig.label} ausfuehren`}
              </button>
            </form>

            <div className="meta-row">
              <span className="badge">Server-side API Proxy</span>
              <span className="badge">DataForSEO Demo Fallback</span>
            </div>

            {isLoading ? (
              <div className="status loading">
                Anfrage wird verarbeitet. Bei Live-Daten kann das je nach Endpoint etwas dauern.
              </div>
            ) : null}

            {error ? <div className="status error">{error}</div> : null}
          </div>
        </section>

        <section>
          {result ? (
            <ResultView result={result} />
          ) : (
            <div className="panel empty-state">
              <div className="panel-inner">
                <h2>Noch keine Analyse gestartet</h2>
                <p>
                  Waehle links ein Modul aus und starte eine Analyse. Im Demo-Modus
                  siehst du sofort strukturierte Beispielresultate; mit gesetzten
                  Credentials kommen die Daten live von DataForSEO.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
