# SEO App

SEO-Dashboard mit den Kernmodulen von Ahrefs/Semrush auf Basis der DataForSEO API:

- Domain Overview
- Keyword Research
- SERP Analyse
- Backlink Analyse
- On-Page Audit
- Competitor / Gap Analyse

## Setup

1. Dependencies installieren:

```bash
npm install
```

2. Umgebungsvariablen anlegen:

```bash
cp .env.example .env.local
```

3. DataForSEO Zugangsdaten setzen:

```env
DATAFORSEO_LOGIN=...
DATAFORSEO_PASSWORD=...
DATAFORSEO_BASE_URL=https://api.dataforseo.com
DATAFORSEO_SANDBOX=false
```

4. Dev-Server starten:

```bash
npm run dev
```

## Hinweise

- Ohne gesetzte DataForSEO Credentials läuft die App im Demo-Modus mit Mock-Daten.
- Die Server-Route `/api/seo` kapselt die API-Zugriffe und hält Credentials aus dem Browser fern.
- Für Live-Keyword-Endpoints von Google Ads gelten laut DataForSEO enge Rate-Limits; die App ist deshalb um eine gemeinsame Proxy-Schicht herum aufgebaut.

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
