# SEO-Plattform

SEO-Plattform mit den Kernmodulen von Ahrefs und Semrush auf Basis der DataForSEO API:

- Domain-Überblick
- Keyword-Recherche
- SERP-Analyse
- Backlink-Analyse
- On-Page-Audit
- Wettbewerbs- und Gap-Analyse

## Einrichtung

1. Abhängigkeiten installieren:

```bash
npm install
```

2. Umgebungsvariablen anlegen:

```bash
cp .env.example .env.local
```

3. DataForSEO-Zugangsdaten setzen:

```env
DATAFORSEO_LOGIN=...
DATAFORSEO_PASSWORD=...
DATAFORSEO_BASE_URL=https://api.dataforseo.com
DATAFORSEO_SANDBOX=false
```

4. Entwicklungsserver starten:

```bash
npm run dev
```

## Hinweise

- Ohne gesetzte DataForSEO-Zugangsdaten läuft die App im Demo-Modus mit Mock-Daten.
- Die Server-Routen `/api/seo` und `/api/keyword-research` kapseln die API-Zugriffe und halten Zugangsdaten aus dem Browser fern.
- Für Live-Keyword-Endpunkte von Google Ads gelten laut DataForSEO enge Rate-Limits; die App ist deshalb um eine gemeinsame Proxy-Schicht herum aufgebaut.
- Die Dropdowns für `Standort` und `Sprache` liefern DataForSEO-kompatible Werte für `location_name` und `language_name`.

## Keyword-Recherche

Die Keyword-Recherche läuft jetzt in einem eigenständigen Workspace mit Matching Terms, Fragen, Clustern, BID-Vetting, Tool-Chancen und KI-/Brand-Gap.

Die vollständige Ablaufdokumentation liegt in [docs/keyword-recherche.md](./docs/keyword-recherche.md).

## Verwendete DataForSEO-Bausteine

- `dataforseo_labs/google/ranked_keywords/live`
- `dataforseo_labs/google/competitors_domain/live`
- `dataforseo_labs/google/domain_intersection/live`
- `keywords_data/google_ads/search_volume/live`
- `keywords_data/google_ads/keywords_for_keywords/live`
- `serp/google/organic/live/advanced`
- `backlinks/summary/live`
- `backlinks/backlinks/live`
- `on_page/instant_pages`
