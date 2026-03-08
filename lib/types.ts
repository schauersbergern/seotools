export type SeoFeature =
  | "overview"
  | "keywords"
  | "serp"
  | "backlinks"
  | "audit"
  | "competitors";

export type StandardSeoFeature = Exclude<SeoFeature, "keywords">;

export type MarketFormState = {
  locationName: string;
  languageName: string;
  device: string;
  os: string;
  enableBrowserRendering: boolean;
};

export type SeoFeatureFormState = MarketFormState & {
  domain: string;
  compareDomain: string;
  keyword: string;
  url: string;
};

export type KeywordMatchingMode = "terms_match" | "phrase_match";
export type KeywordReportType = "matching_terms" | "questions";
export type KeywordWorkspaceView =
  | "matching_terms"
  | "questions"
  | "term_clusters"
  | "parent_topic_clusters"
  | "bid_vetting"
  | "tool_opportunities"
  | "ai_brand_gap";
export type KeywordClusterMode = "terms" | "parent_topics";
export type SearchIntent =
  | "Informational"
  | "Kommerziell"
  | "Transaktional"
  | "Navigational"
  | "Gemischt"
  | "Tool";
export type AiRiskLevel = "hoch" | "mittel" | "niedrig";
export type AiPlatform = "google" | "chat_gpt";

export type KeywordResearchFormState = MarketFormState & {
  seeds: string;
  modifiers: string;
  includeTerms: string;
  excludeTerms: string;
  niche: string;
  audience: string;
  monetization: string;
  matchingMode: KeywordMatchingMode;
  resultLimit: string;
  ownBrandLabel: string;
  ownBrandDomain: string;
  competitorDomains: string;
  aiPlatform: AiPlatform;
};

export type Metric = {
  label: string;
  value: string | number;
  hint?: string;
};

export type TableColumn = {
  key: string;
  label: string;
};

export type TableRow = Record<string, string | number>;

export type SeoSection = {
  id: string;
  title: string;
  description?: string;
  metrics?: Metric[];
  table?: {
    columns: TableColumn[];
    rows: TableRow[];
  };
  pills?: string[];
  notice?: string;
};

export type SeoResult = {
  feature: StandardSeoFeature;
  mode: "demo" | "live";
  title: string;
  generatedAt: string;
  summary: Metric[];
  sections: SeoSection[];
};

export type KeywordResearchQuery = {
  seeds: string[];
  modifiers: string[];
  includeTerms: string[];
  excludeTerms: string[];
  monetization: string[];
  matchingMode: KeywordMatchingMode;
  reportType: KeywordReportType;
  resultLimit: number;
  locationName: string;
  languageName: string;
  ownBrandLabel: string;
  ownBrandDomain: string;
  competitorDomains: string[];
  aiPlatform: AiPlatform;
};

export type KeywordResearchRow = {
  keyword: string;
  searchIntent: SearchIntent;
  difficultyApprox: number | null;
  searchVolume: number;
  trend: "wachsend" | "stabil" | "fallend" | "neu" | "unbekannt";
  growth12m: number | null;
  lowestAuthority: number | null;
  trafficPotential: number;
  cpc: number | null;
  parentTopic: string;
  aiRisk: AiRiskLevel;
  toolOpportunity: boolean;
  termCluster: string;
  serpFeatures: string[];
  language: string;
  competition: number | null;
  businessPotential: number;
  businessPotentialReason: string;
  hasAiOverview: boolean;
  minRefDomains: number | null;
  serpFormat: string;
};

export type KeywordCluster = {
  label: string;
  count: number;
  share: number;
};

export type BidQueueEntry = {
  keyword: string;
  businessPotential: number;
  businessPotentialReason: string;
  searchIntent: SearchIntent;
  serpFormat: string;
  aiRisk: AiRiskLevel;
  difficultyApprox: number | null;
  lowestAuthority: number | null;
  minRefDomains: number | null;
  recommendation: string;
};

export type ToolOpportunityEntry = {
  keyword: string;
  searchVolume: number;
  cpc: number | null;
  parentTopic: string;
  businessPotential: number;
  aiRisk: AiRiskLevel;
  toolPattern: string;
};

export type AiBrandGapCompetitor = {
  label: string;
  domain: string;
};

export type AiBrandGapEntry = {
  prompt: string;
  keyword: string;
  competitor: string;
  competitorMentions: number;
  ownMentions: number;
  opportunityScore: number;
};

export type AiBrandGapReport = {
  platform: AiPlatform;
  platformEnabled: boolean;
  platformReason?: string;
  ownBrandLabel: string;
  ownBrandDomain: string;
  competitors: AiBrandGapCompetitor[];
  coverage: Metric[];
  gaps: AiBrandGapEntry[];
};

export type KeywordResearchResponse = {
  mode: "demo" | "live";
  generatedAt: string;
  query: KeywordResearchQuery;
  heroPrompt: string;
  summary: Metric[];
  matchingTerms: KeywordResearchRow[];
  questions: KeywordResearchRow[];
  termClusters: KeywordCluster[];
  parentTopicClusters: KeywordCluster[];
  bidQueue: BidQueueEntry[];
  toolOpportunities: ToolOpportunityEntry[];
  aiBrandGap: AiBrandGapReport;
  warnings: string[];
};
