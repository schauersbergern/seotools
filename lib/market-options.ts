export type SelectOption = {
  label: string;
  value: string;
};

export const locationOptions: SelectOption[] = [
  { label: "Deutschland", value: "Germany" },
  { label: "Österreich", value: "Austria" },
  { label: "Schweiz", value: "Switzerland" },
  { label: "Vereinigte Staaten", value: "United States" },
  { label: "Vereinigtes Königreich", value: "United Kingdom" },
  { label: "Frankreich", value: "France" },
  { label: "Italien", value: "Italy" },
  { label: "Spanien", value: "Spain" },
  { label: "Niederlande", value: "Netherlands" }
];

export const languageOptions: SelectOption[] = [
  { label: "Deutsch", value: "German" },
  { label: "Englisch", value: "English" }
];

export const deviceOptions: SelectOption[] = [
  { label: "Desktop", value: "desktop" },
  { label: "Mobil", value: "mobile" }
];

export const osOptions: SelectOption[] = [
  { label: "Windows", value: "windows" },
  { label: "macOS", value: "macos" },
  { label: "Android", value: "android" },
  { label: "iOS", value: "ios" }
];

function getOptionLabel(options: SelectOption[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}

export function getLocationLabel(value: string) {
  return getOptionLabel(locationOptions, value);
}

export function getLanguageLabel(value: string) {
  return getOptionLabel(languageOptions, value);
}

export function getDeviceLabel(value: string) {
  return getOptionLabel(deviceOptions, value);
}

export function getOsLabel(value: string) {
  return getOptionLabel(osOptions, value);
}

export function getSerpFeatureLabel(value: string) {
  const labels: Record<string, string> = {
    organic: "Organisch",
    featured_snippet: "Hervorgehobenes Snippet",
    people_also_ask: "Nutzer fragen auch",
    local_pack: "Lokales Paket",
    local_finder: "Lokaler Finder",
    video: "Video",
    images: "Bilder",
    shopping: "Shopping-Ergebnisse",
    top_stories: "Top-Meldungen",
    knowledge_graph: "Wissensbox",
    popular_products: "Beliebte Produkte",
    jobs: "Jobs",
    map: "Karte",
    ads: "Anzeigen",
    paid: "Bezahlt",
    faq: "FAQ"
  };

  return labels[value] ?? value.replaceAll("_", " ");
}
