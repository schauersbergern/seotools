export type SeoFeature =
  | "overview"
  | "keywords"
  | "serp"
  | "backlinks"
  | "audit"
  | "competitors";

export type FeatureFormState = {
  domain: string;
  compareDomain: string;
  keywords: string;
  keyword: string;
  url: string;
  locationName: string;
  languageName: string;
  device: string;
  os: string;
  enableBrowserRendering: boolean;
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
  feature: SeoFeature;
  mode: "demo" | "live";
  title: string;
  generatedAt: string;
  summary: Metric[];
  sections: SeoSection[];
};
