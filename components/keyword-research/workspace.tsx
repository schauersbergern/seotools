"use client";

import { startTransition, useEffect, useState } from "react";
import {
  buildHeroPrompt,
  formatGrowth,
  parseList
} from "@/lib/keyword-research";
import {
  formatKeywordCurrency,
  formatKeywordNumber
} from "@/lib/keyword-research-service";
import {
  getLanguageLabel,
  getLocationLabel,
  languageOptions,
  locationOptions
} from "@/lib/market-options";
import type {
  AiBrandGapEntry,
  BidQueueEntry,
  KeywordCluster,
  KeywordClusterMode,
  KeywordMatchingMode,
  KeywordResearchFormState,
  KeywordResearchResponse,
  KeywordResearchRow,
  KeywordWorkspaceView,
  ToolOpportunityEntry
} from "@/lib/types";

const workspaceViews: Array<{ id: KeywordWorkspaceView; label: string }> = [
  { id: "matching_terms", label: "Matching Terms" },
  { id: "questions", label: "Fragen" },
  { id: "term_clusters", label: "Cluster nach Begriffen" },
  { id: "parent_topic_clusters", label: "Cluster nach Oberthema" },
  { id: "bid_vetting", label: "BID-Vetting" },
  { id: "tool_opportunities", label: "Tool-Chancen" },
  { id: "ai_brand_gap", label: "KI-/Brand-Gap" }
];

const initialFormState: KeywordResearchFormState = {
  seeds: "espresso machine\ncoffee grinder\ncoffee beans",
  modifiers: "best\nreview\nvs\nfor home\nunder 500\nchecker\ncalculator\ngenerator",
  includeTerms: "tool\nsoftware",
  excludeTerms: "free\npdf",
  niche: "Kaffee- und Espresso-Review-Seite",
  audience: "Neue und angehende Home-Baristas",
  monetization: "Affiliate\nAds\nSponsorships",
  matchingMode: "terms_match",
  resultLimit: "50",
  ownBrandLabel: "Brew Atlas",
  ownBrandDomain: "brewatlas.example",
  competitorDomains: "ahrefs.com\nsemrush.com",
  aiPlatform: "google",
  locationName: "Germany",
  languageName: "German",
  device: "desktop",
  os: "windows",
  enableBrowserRendering: false
};

type FilterState = {
  trend: string;
  intent: string;
  maxDifficulty: string;
  minVolume: string;
  minGrowth: string;
  maxAuthority: string;
  minTrafficPotential: string;
  language: string;
  parentTopic: string;
  serpFeature: string;
  include: string;
  exclude: string;
};

const initialFilters: FilterState = {
  trend: "",
  intent: "",
  maxDifficulty: "",
  minVolume: "",
  minGrowth: "",
  maxAuthority: "",
  minTrafficPotential: "",
  language: "",
  parentTopic: "",
  serpFeature: "",
  include: "",
  exclude: ""
};

function MetricGrid({
  items
}: {
  items: Array<{ label: string; value: string | number; hint?: string }>;
}) {
  return (
    <div className="metric-grid">
      {items.map((item) => (
        <div className="metric-card" key={item.label}>
          <span>{item.label}</span>
          <strong>{String(item.value)}</strong>
          {item.hint ? <small>{item.hint}</small> : null}
        </div>
      ))}
    </div>
  );
}

function RiskBadge({ value }: { value: KeywordResearchRow["aiRisk"] }) {
  return <span className={`mini-badge risk-${value}`}>{value}</span>;
}

function BooleanBadge({
  value,
  trueLabel = "Ja",
  falseLabel = "Nein"
}: {
  value: boolean;
  trueLabel?: string;
  falseLabel?: string;
}) {
  return (
    <span className={`mini-badge ${value ? "badge-positive" : "badge-muted"}`}>
      {value ? trueLabel : falseLabel}
    </span>
  );
}

function MatchingTermsTable({ rows }: { rows: KeywordResearchRow[] }) {
  if (!rows.length) {
    return <p className="muted">Keine Keywords nach den aktuellen Filtern.</p>;
  }

  return (
    <div className="workspace-table-shell">
      <table className="data-table dense-table">
        <thead>
          <tr>
            <th>Keyword</th>
            <th>Suchintention</th>
            <th>Schwierigkeit</th>
            <th>SV</th>
            <th>Trend</th>
            <th>Wachstum 12M</th>
            <th>Niedrigste Autorität</th>
            <th>Traffic-Potenzial</th>
            <th>CPC</th>
            <th>Oberthema</th>
            <th>KI-Risiko</th>
            <th>Tool-Chance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.keyword}>
              <td>
                <div className="keyword-cell">
                  <strong>{row.keyword}</strong>
                  <span>{row.termCluster}</span>
                </div>
              </td>
              <td>{row.searchIntent}</td>
              <td>{formatKeywordNumber(row.difficultyApprox)}</td>
              <td>{formatKeywordNumber(row.searchVolume)}</td>
              <td className="capitalize">{row.trend}</td>
              <td>{formatGrowth(row.growth12m)}</td>
              <td>{formatKeywordNumber(row.lowestAuthority)}</td>
              <td>{formatKeywordNumber(row.trafficPotential)}</td>
              <td>{formatKeywordCurrency(row.cpc)}</td>
              <td>{row.parentTopic}</td>
              <td>
                <RiskBadge value={row.aiRisk} />
              </td>
              <td>
                <BooleanBadge value={row.toolOpportunity} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClusterSidebar({
  rows,
  clusterMode,
  selectedCluster,
  onModeChange,
  onClusterChange
}: {
  rows: KeywordResearchResponse;
  clusterMode: KeywordClusterMode;
  selectedCluster: string | null;
  onModeChange: (value: KeywordClusterMode) => void;
  onClusterChange: (value: string | null) => void;
}) {
  const clusters =
    clusterMode === "terms" ? rows.termClusters : rows.parentTopicClusters;

  return (
    <aside className="cluster-sidebar">
      <div className="cluster-mode-switch">
        <button
          className={`chip-button ${clusterMode === "terms" ? "active" : ""}`}
          onClick={() => onModeChange("terms")}
          type="button"
        >
          nach Begriffen
        </button>
        <button
          className={`chip-button ${clusterMode === "parent_topics" ? "active" : ""}`}
          onClick={() => onModeChange("parent_topics")}
          type="button"
        >
          nach Oberthema
        </button>
      </div>
      <button
        className={`cluster-item ${selectedCluster === null ? "active" : ""}`}
        onClick={() => onClusterChange(null)}
        type="button"
      >
        <span>Alle Cluster</span>
        <strong>{rows.matchingTerms.length}</strong>
      </button>
      <div className="cluster-list">
        {clusters.map((cluster) => (
          <button
            className={`cluster-item ${selectedCluster === cluster.label ? "active" : ""}`}
            key={cluster.label}
            onClick={() => onClusterChange(cluster.label)}
            type="button"
          >
            <span>{cluster.label}</span>
            <strong>{cluster.count}</strong>
          </button>
        ))}
      </div>
    </aside>
  );
}

function SimpleClusterTable({ rows }: { rows: KeywordCluster[] }) {
  if (!rows.length) {
    return <p className="muted">Keine Cluster vorhanden.</p>;
  }

  return (
    <div className="workspace-table-shell">
      <table className="data-table">
        <thead>
          <tr>
            <th>Cluster</th>
            <th>Keywords</th>
            <th>Anteil</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td>{row.label}</td>
              <td>{formatKeywordNumber(row.count)}</td>
              <td>{row.share}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BidTable({ rows }: { rows: BidQueueEntry[] }) {
  if (!rows.length) {
    return <p className="muted">Keine BID-Kandidaten vorhanden.</p>;
  }

  return (
    <div className="workspace-table-shell">
      <table className="data-table">
        <thead>
          <tr>
            <th>Keyword</th>
            <th>Business-Potenzial</th>
            <th>Suchintention</th>
            <th>SERP-Format</th>
            <th>KI-Risiko</th>
            <th>Schwierigkeit (approx)</th>
            <th>Niedrigste Autorität</th>
            <th>Min. Ref.-Domains</th>
            <th>Empfehlung</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.keyword}>
              <td>
                <div className="keyword-cell">
                  <strong>{row.keyword}</strong>
                  <span>{row.businessPotentialReason}</span>
                </div>
              </td>
              <td>{row.businessPotential}/3</td>
              <td>{row.searchIntent}</td>
              <td>{row.serpFormat}</td>
              <td>
                <RiskBadge value={row.aiRisk} />
              </td>
              <td>{formatKeywordNumber(row.difficultyApprox)}</td>
              <td>{formatKeywordNumber(row.lowestAuthority)}</td>
              <td>{formatKeywordNumber(row.minRefDomains)}</td>
              <td>{row.recommendation}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ToolOpportunityTable({ rows }: { rows: ToolOpportunityEntry[] }) {
  if (!rows.length) {
    return <p className="muted">Keine Tool-Chancen erkannt.</p>;
  }

  return (
    <div className="workspace-table-shell">
      <table className="data-table">
        <thead>
          <tr>
            <th>Keyword</th>
            <th>Pattern</th>
            <th>SV</th>
            <th>CPC</th>
            <th>Oberthema</th>
            <th>Business-Potenzial</th>
            <th>KI-Risiko</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.keyword}>
              <td>{row.keyword}</td>
              <td>{row.toolPattern}</td>
              <td>{formatKeywordNumber(row.searchVolume)}</td>
              <td>{formatKeywordCurrency(row.cpc)}</td>
              <td>{row.parentTopic}</td>
              <td>{row.businessPotential}/3</td>
              <td>
                <RiskBadge value={row.aiRisk} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AiGapTable({ rows }: { rows: AiBrandGapEntry[] }) {
  if (!rows.length) {
    return <p className="muted">Keine KI-/Brand-Gaps für die aktuelle Konfiguration.</p>;
  }

  return (
    <div className="workspace-table-shell">
      <table className="data-table">
        <thead>
          <tr>
            <th>Prompt</th>
            <th>Keyword</th>
            <th>Wettbewerber</th>
            <th>Competitor Mentions</th>
            <th>Eigene Mentions</th>
            <th>Opportunity Score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.prompt}-${row.competitor}-${index}`}>
              <td>{row.prompt}</td>
              <td>{row.keyword}</td>
              <td>{row.competitor}</td>
              <td>{formatKeywordNumber(row.competitorMentions)}</td>
              <td>{formatKeywordNumber(row.ownMentions)}</td>
              <td>{formatKeywordNumber(row.opportunityScore)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function KeywordResearchWorkspace() {
  const [formState, setFormState] = useState(initialFormState);
  const [result, setResult] = useState<KeywordResearchResponse | null>(null);
  const [activeView, setActiveView] =
    useState<KeywordWorkspaceView>("matching_terms");
  const [matchingTab, setMatchingTab] = useState<"all" | "questions">("all");
  const [clusterMode, setClusterMode] = useState<KeywordClusterMode>("terms");
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const seeds = parseList(formState.seeds).slice(0, 10);
  const modifiers = [...parseList(formState.modifiers), ...parseList(formState.includeTerms)];
  const heroPromptPreview = buildHeroPrompt(formState, seeds, modifiers);
  const chatGptSupported =
    formState.languageName === "English" && formState.locationName === "United States";

  useEffect(() => {
    if (!chatGptSupported && formState.aiPlatform === "chat_gpt") {
      setFormState((current) => ({ ...current, aiPlatform: "google" }));
    }
  }, [chatGptSupported, formState.aiPlatform]);

  function updateValue<K extends keyof KeywordResearchFormState>(
    key: K,
    value: KeywordResearchFormState[K]
  ) {
    setFormState((current) => ({
      ...current,
      [key]: value
    }));
  }

  function updateFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((current) => ({
      ...current,
      [key]: value
    }));
  }

  async function runResearch(nextState?: KeywordResearchFormState) {
    const payload = nextState ?? formState;
    setIsLoading(true);
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/keyword-research", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ payload })
        });
        const data = (await response.json()) as KeywordResearchResponse & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error ?? "Keyword-Recherche fehlgeschlagen.");
        }

        setResult(data);
        setActiveView("matching_terms");
        setMatchingTab("all");
        setSelectedCluster(null);
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

  function updateMatchingMode(mode: KeywordMatchingMode) {
    const nextState = {
      ...formState,
      matchingMode: mode
    };

    setFormState(nextState);

    if (result) {
      void runResearch(nextState);
    }
  }

  const baseRows =
    activeView === "questions" || matchingTab === "questions"
      ? result?.questions ?? []
      : result?.matchingTerms ?? [];

  const filteredRows = baseRows.filter((row) => {
    if (selectedCluster) {
      const clusterValue =
        clusterMode === "terms" ? row.termCluster : row.parentTopic;

      if (clusterValue !== selectedCluster) {
        return false;
      }
    }

    if (filters.trend && row.trend !== filters.trend) {
      return false;
    }

    if (filters.intent && row.searchIntent !== filters.intent) {
      return false;
    }

    if (
      filters.maxDifficulty &&
      (row.difficultyApprox === null ||
        row.difficultyApprox > Number(filters.maxDifficulty))
    ) {
      return false;
    }

    if (filters.minVolume && row.searchVolume < Number(filters.minVolume)) {
      return false;
    }

    if (
      filters.minGrowth &&
      (row.growth12m === null || row.growth12m < Number(filters.minGrowth))
    ) {
      return false;
    }

    if (
      filters.maxAuthority &&
      (row.lowestAuthority === null ||
        row.lowestAuthority > Number(filters.maxAuthority))
    ) {
      return false;
    }

    if (
      filters.minTrafficPotential &&
      row.trafficPotential < Number(filters.minTrafficPotential)
    ) {
      return false;
    }

    if (filters.language && row.language !== filters.language) {
      return false;
    }

    if (filters.parentTopic && row.parentTopic !== filters.parentTopic) {
      return false;
    }

    if (
      filters.serpFeature &&
      !row.serpFeatures.some((feature) => feature.includes(filters.serpFeature))
    ) {
      return false;
    }

    if (
      filters.include &&
      !row.keyword.toLowerCase().includes(filters.include.toLowerCase())
    ) {
      return false;
    }

    if (
      filters.exclude &&
      row.keyword.toLowerCase().includes(filters.exclude.toLowerCase())
    ) {
      return false;
    }

    return true;
  });

  const parentTopics = result
    ? [...new Set(result.matchingTerms.map((row) => row.parentTopic))].sort()
    : [];
  const serpFeatures = result
    ? [
        ...new Set(
          result.matchingTerms.flatMap((row) => row.serpFeatures).filter(Boolean)
        )
      ].sort()
    : [];

  return (
    <div className="keyword-workspace-layout">
      <section className="panel">
        <div className="panel-inner">
          <div className="workspace-section-head">
            <div>
              <p className="eyebrow">Keyword-Recherche</p>
              <h2>Setup & Query</h2>
            </div>
            <span className="badge">Deutschland / Deutsch</span>
          </div>

          <form
            className="stack"
            onSubmit={(event) => {
              event.preventDefault();
              void runResearch();
            }}
          >
            <div className="field">
              <label htmlFor="niche">Thema oder Nische</label>
              <input
                id="niche"
                onChange={(event) => updateValue("niche", event.target.value)}
                value={formState.niche}
              />
            </div>
            <div className="field">
              <label htmlFor="audience">Zielgruppe</label>
              <input
                id="audience"
                onChange={(event) => updateValue("audience", event.target.value)}
                value={formState.audience}
              />
            </div>
            <div className="field">
              <label htmlFor="monetization">Monetarisierung</label>
              <textarea
                id="monetization"
                onChange={(event) => updateValue("monetization", event.target.value)}
                value={formState.monetization}
              />
            </div>
            <div className="field">
              <label htmlFor="seeds">Seeds</label>
              <textarea
                id="seeds"
                onChange={(event) => updateValue("seeds", event.target.value)}
                value={formState.seeds}
              />
            </div>
            <div className="field">
              <label htmlFor="modifiers">Modifier</label>
              <textarea
                id="modifiers"
                onChange={(event) => updateValue("modifiers", event.target.value)}
                value={formState.modifiers}
              />
            </div>
            <div className="split">
              <div className="field">
                <label htmlFor="includeTerms">Include</label>
                <textarea
                  id="includeTerms"
                  onChange={(event) => updateValue("includeTerms", event.target.value)}
                  value={formState.includeTerms}
                />
              </div>
              <div className="field">
                <label htmlFor="excludeTerms">Exclude</label>
                <textarea
                  id="excludeTerms"
                  onChange={(event) => updateValue("excludeTerms", event.target.value)}
                  value={formState.excludeTerms}
                />
              </div>
            </div>
            <div className="split">
              <div className="field">
                <label htmlFor="location">Standort</label>
                <select
                  id="location"
                  onChange={(event) => updateValue("locationName", event.target.value)}
                  value={formState.locationName}
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
                  value={formState.languageName}
                >
                  {languageOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="split">
              <div className="field">
                <label htmlFor="matchingMode">Matching-Modus</label>
                <select
                  id="matchingMode"
                  onChange={(event) =>
                    updateMatchingMode(event.target.value as KeywordMatchingMode)
                  }
                  value={formState.matchingMode}
                >
                  <option value="terms_match">Begriffe enthalten</option>
                  <option value="phrase_match">Phrase enthalten</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="resultLimit">Resultset</label>
                <input
                  id="resultLimit"
                  inputMode="numeric"
                  onChange={(event) => updateValue("resultLimit", event.target.value)}
                  value={formState.resultLimit}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="ownBrandLabel">Eigene Marke</label>
              <input
                id="ownBrandLabel"
                onChange={(event) => updateValue("ownBrandLabel", event.target.value)}
                value={formState.ownBrandLabel}
              />
            </div>
            <div className="split">
              <div className="field">
                <label htmlFor="ownBrandDomain">Eigene Domain</label>
                <input
                  id="ownBrandDomain"
                  onChange={(event) => updateValue("ownBrandDomain", event.target.value)}
                  value={formState.ownBrandDomain}
                />
              </div>
              <div className="field">
                <label htmlFor="aiPlatform">AI-Plattform</label>
                <select
                  id="aiPlatform"
                  onChange={(event) =>
                    updateValue(
                      "aiPlatform",
                      event.target.value as KeywordResearchFormState["aiPlatform"]
                    )
                  }
                  value={formState.aiPlatform}
                >
                  <option value="google">Google</option>
                  <option disabled={!chatGptSupported} value="chat_gpt">
                    ChatGPT
                  </option>
                </select>
              </div>
            </div>
            <div className="field">
              <label htmlFor="competitorDomains">Wettbewerber (1-3)</label>
              <textarea
                id="competitorDomains"
                onChange={(event) => updateValue("competitorDomains", event.target.value)}
                value={formState.competitorDomains}
              />
            </div>

            {!chatGptSupported ? (
              <div className="notice">
                `chat_gpt` ist nur für Englisch + Vereinigte Staaten aktivierbar und wird
                sonst sauber deaktiviert.
              </div>
            ) : null}

            <button className="primary-button" disabled={isLoading} type="submit">
              {isLoading ? "Keyword-Recherche läuft..." : "Matching Terms laden"}
            </button>
          </form>

          <div className="keyword-hero-preview">
            <div className="workspace-section-head">
              <h3>Hero Prompt</h3>
              <span className="badge">v1 Generator</span>
            </div>
            <p>{heroPromptPreview}</p>
          </div>
        </div>
      </section>

      <section className="keyword-workspace-panel">
        {!result ? (
          <div className="panel">
            <div className="panel-inner">
              <div className="empty-state">
                <p className="eyebrow">Workspace</p>
                <h2>Matching Terms als Standardziel</h2>
                <p>
                  Nach dem ersten Run landet der Workspace direkt in einer Ahrefs-ähnlichen
                  Matching-Terms-Ansicht mit Filterleiste, Cluster-Sidebar und separaten
                  Reports für Fragen, BID, Tool-Chancen und KI-/Brand-Gap.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="keyword-workspace-stack">
            <div className="panel">
              <div className="panel-inner">
                <div className="result-header">
                  <div>
                    <p className="eyebrow">Keyword Research Workspace</p>
                    <h2>Matching Terms</h2>
                    <p className="subtle">
                      Quelle: {result.mode === "demo" ? "Demo-Modus" : "Live über DataForSEO"}.
                      Markt: {getLocationLabel(result.query.locationName)} /{" "}
                      {getLanguageLabel(result.query.languageName)}.
                    </p>
                  </div>
                  <div className="badge">
                    {new Date(result.generatedAt).toLocaleString("de-DE")}
                  </div>
                </div>

                <MetricGrid items={result.summary} />

                <div className="warning-stack">
                  {result.warnings.map((warning) => (
                    <div className="notice" key={warning}>
                      {warning}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="workspace-tabs">
              {workspaceViews.map((view) => (
                <button
                  className={`tab-button ${activeView === view.id ? "active" : ""}`}
                  key={view.id}
                  onClick={() => setActiveView(view.id)}
                  type="button"
                >
                  {view.label}
                </button>
              ))}
            </div>

            {activeView === "matching_terms" ? (
              <div className="keyword-results-grid">
                <ClusterSidebar
                  clusterMode={clusterMode}
                  onClusterChange={setSelectedCluster}
                  onModeChange={setClusterMode}
                  rows={result}
                  selectedCluster={selectedCluster}
                />

                <div className="panel">
                  <div className="panel-inner">
                    <div className="workspace-section-head">
                      <div>
                        <h3>Matching Terms</h3>
                        <p className="subtle">
                          Gefilterte Keywords mit Suchintention, Schwierigkeit (approx),
                          Traffic-Potenzial, KI-Risiko und Tool-Signal.
                        </p>
                      </div>
                      <div className="chip-row">
                        <button
                          className={`chip-button ${matchingTab === "all" ? "active" : ""}`}
                          onClick={() => setMatchingTab("all")}
                          type="button"
                        >
                          Alle Begriffe
                        </button>
                        <button
                          className={`chip-button ${matchingTab === "questions" ? "active" : ""}`}
                          onClick={() => setMatchingTab("questions")}
                          type="button"
                        >
                          Fragen
                        </button>
                      </div>
                    </div>

                    <div className="chip-row">
                      <button
                        className={`chip-button ${formState.matchingMode === "terms_match" ? "active" : ""}`}
                        onClick={() => updateMatchingMode("terms_match")}
                        type="button"
                      >
                        Begriffe enthalten
                      </button>
                      <button
                        className={`chip-button ${formState.matchingMode === "phrase_match" ? "active" : ""}`}
                        onClick={() => updateMatchingMode("phrase_match")}
                        type="button"
                      >
                        Phrase enthalten
                      </button>
                    </div>

                    <div className="filter-bar">
                      <label className="filter-chip">
                        <span>Trend</span>
                        <select
                          onChange={(event) => updateFilter("trend", event.target.value)}
                          value={filters.trend}
                        >
                          <option value="">Alle</option>
                          <option value="wachsend">Wachsend</option>
                          <option value="stabil">Stabil</option>
                          <option value="fallend">Fallend</option>
                        </select>
                      </label>
                      <label className="filter-chip">
                        <span>Suchintention</span>
                        <select
                          onChange={(event) => updateFilter("intent", event.target.value)}
                          value={filters.intent}
                        >
                          <option value="">Alle</option>
                          <option value="Informational">Informational</option>
                          <option value="Kommerziell">Kommerziell</option>
                          <option value="Transaktional">Transaktional</option>
                          <option value="Gemischt">Gemischt</option>
                          <option value="Tool">Tool</option>
                        </select>
                      </label>
                      <label className="filter-chip">
                        <span>Schwierigkeit</span>
                        <input
                          inputMode="numeric"
                          onChange={(event) =>
                            updateFilter("maxDifficulty", event.target.value)
                          }
                          placeholder="max"
                          value={filters.maxDifficulty}
                        />
                      </label>
                      <label className="filter-chip">
                        <span>Suchvolumen</span>
                        <input
                          inputMode="numeric"
                          onChange={(event) => updateFilter("minVolume", event.target.value)}
                          placeholder="min"
                          value={filters.minVolume}
                        />
                      </label>
                      <label className="filter-chip">
                        <span>Wachstum 12M</span>
                        <input
                          inputMode="numeric"
                          onChange={(event) => updateFilter("minGrowth", event.target.value)}
                          placeholder="min %"
                          value={filters.minGrowth}
                        />
                      </label>
                      <label className="filter-chip">
                        <span>Niedrigste Autorität</span>
                        <input
                          inputMode="numeric"
                          onChange={(event) =>
                            updateFilter("maxAuthority", event.target.value)
                          }
                          placeholder="max"
                          value={filters.maxAuthority}
                        />
                      </label>
                      <label className="filter-chip">
                        <span>Traffic-Potenzial</span>
                        <input
                          inputMode="numeric"
                          onChange={(event) =>
                            updateFilter("minTrafficPotential", event.target.value)
                          }
                          placeholder="min"
                          value={filters.minTrafficPotential}
                        />
                      </label>
                      <label className="filter-chip">
                        <span>Sprache</span>
                        <select
                          onChange={(event) => updateFilter("language", event.target.value)}
                          value={filters.language}
                        >
                          <option value="">Alle</option>
                          <option value="German">Deutsch</option>
                          <option value="English">Englisch</option>
                        </select>
                      </label>
                      <label className="filter-chip">
                        <span>Oberthema</span>
                        <select
                          onChange={(event) => updateFilter("parentTopic", event.target.value)}
                          value={filters.parentTopic}
                        >
                          <option value="">Alle</option>
                          {parentTopics.map((topic) => (
                            <option key={topic} value={topic}>
                              {topic}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="filter-chip">
                        <span>SERP-Features</span>
                        <select
                          onChange={(event) => updateFilter("serpFeature", event.target.value)}
                          value={filters.serpFeature}
                        >
                          <option value="">Alle</option>
                          {serpFeatures.map((feature) => (
                            <option key={feature} value={feature}>
                              {feature}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="filter-chip">
                        <span>Include</span>
                        <input
                          onChange={(event) => updateFilter("include", event.target.value)}
                          placeholder="contains"
                          value={filters.include}
                        />
                      </label>
                      <label className="filter-chip">
                        <span>Exclude</span>
                        <input
                          onChange={(event) => updateFilter("exclude", event.target.value)}
                          placeholder="exclude"
                          value={filters.exclude}
                        />
                      </label>
                    </div>

                    <div className="subtle">
                      {filteredRows.length} Keywords sichtbar, {result.matchingTerms.length} im
                      geladenen Datensatz.
                    </div>

                    <MatchingTermsTable rows={filteredRows} />
                  </div>
                </div>
              </div>
            ) : null}

            {activeView === "questions" ? (
              <div className="panel">
                <div className="panel-inner">
                  <div className="workspace-section-head">
                    <div>
                      <h3>Fragen</h3>
                      <p className="subtle">
                        Fragen-Report als eigene Unteransicht, getrennt von der Matching-Terms-
                        Navigation.
                      </p>
                    </div>
                    <span className="badge">{result.questions.length} Fragen</span>
                  </div>
                  <MatchingTermsTable rows={result.questions} />
                </div>
              </div>
            ) : null}

            {activeView === "term_clusters" ? (
              <div className="panel">
                <div className="panel-inner">
                  <div className="workspace-section-head">
                    <h3>Cluster nach Begriffen</h3>
                    <span className="badge">{result.termClusters.length} Cluster</span>
                  </div>
                  <SimpleClusterTable rows={result.termClusters} />
                </div>
              </div>
            ) : null}

            {activeView === "parent_topic_clusters" ? (
              <div className="panel">
                <div className="panel-inner">
                  <div className="workspace-section-head">
                    <h3>Cluster nach Oberthema</h3>
                    <span className="badge">{result.parentTopicClusters.length} Oberthemen</span>
                  </div>
                  <SimpleClusterTable rows={result.parentTopicClusters} />
                </div>
              </div>
            ) : null}

            {activeView === "bid_vetting" ? (
              <div className="panel">
                <div className="panel-inner">
                  <div className="workspace-section-head">
                    <div>
                      <h3>BID-Vetting</h3>
                      <p className="subtle">
                        Shortlist mit Business-Potenzial, SERP-Format, KI-Risiko und
                        Difficulty-Approximation.
                      </p>
                    </div>
                    <span className="badge">{result.bidQueue.length} Kandidaten</span>
                  </div>
                  <BidTable rows={result.bidQueue} />
                </div>
              </div>
            ) : null}

            {activeView === "tool_opportunities" ? (
              <div className="panel">
                <div className="panel-inner">
                  <div className="workspace-section-head">
                    <div>
                      <h3>Tool-Chancen</h3>
                      <p className="subtle">
                        Separater Report für calculator, checker, generator, tool, rechner und
                        ähnliche Muster.
                      </p>
                    </div>
                    <span className="badge">{result.toolOpportunities.length} Chancen</span>
                  </div>
                  <ToolOpportunityTable rows={result.toolOpportunities} />
                </div>
              </div>
            ) : null}

            {activeView === "ai_brand_gap" ? (
              <div className="panel">
                <div className="panel-inner">
                  <div className="workspace-section-head">
                    <div>
                      <h3>KI-/Brand-Gap</h3>
                      <p className="subtle">
                        Heuristische Brand-Radar-Annäherung mit eigener Marke, Wettbewerbern und
                        Mention-Gaps.
                      </p>
                    </div>
                    <span className="badge">
                      {result.aiBrandGap.platformEnabled
                        ? result.aiBrandGap.platform
                        : "deaktiviert"}
                    </span>
                  </div>
                  <MetricGrid items={result.aiBrandGap.coverage} />
                  {result.aiBrandGap.platformReason ? (
                    <div className="notice">{result.aiBrandGap.platformReason}</div>
                  ) : null}
                  <AiGapTable rows={result.aiBrandGap.gaps} />
                </div>
              </div>
            ) : null}
          </div>
        )}

        {error ? <div className="status error">{error}</div> : null}
        {isLoading ? <div className="status loading">Live-Daten werden geladen…</div> : null}
      </section>
    </div>
  );
}
