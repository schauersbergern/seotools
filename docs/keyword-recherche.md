# Keyword-Recherche mit dem Workspace

Diese Dokumentation beschreibt den Ablauf einer vollständigen Keyword-Recherche im Keyword-Workspace der App. Der Bereich ist als eigenständiger Arbeitsbereich aufgebaut und orientiert sich an einem Ahrefs-ähnlichen `Matching Terms`-Flow.

## Ziel des Workspaces

Der Workspace bündelt die wichtigsten Schritte einer Keyword-Recherche in einer Oberfläche:

- Setup und Query-Definition
- Hero Prompt für die manuelle Weiterverarbeitung
- Matching Terms als Standardansicht
- Fragen-Report
- Cluster nach Begriffen
- Cluster nach Oberthema
- BID-Vetting
- Tool-Chancen
- KI-/Brand-Gap

Die Recherche startet immer links im Setup und landet nach dem ersten Run standardmäßig rechts in `Matching Terms`.

## 1. Setup definieren

Die linke Spalte steuert die eigentliche Query. Hier werden keine Tabellen gefiltert, sondern das Datenset definiert, das vom Server geladen wird.

### Pflichtfelder

- `Seeds`
  Mehrere Start-Keywords, jeweils eine Phrase pro Zeile. Diese Seeds bilden die Basis für die Keyword-Ideen.
- `Standort`
  DataForSEO-kompatibler Markt, standardmäßig `Deutschland`.
- `Sprache`
  DataForSEO-kompatible Sprache, standardmäßig `Deutsch`.

### Strategiefelder

- `Thema oder Nische`
  Kontext für den Hero Prompt und die spätere Priorisierung.
- `Zielgruppe`
  Hilft bei der späteren Bewertung von Intent und Content-Fit.
- `Monetarisierung`
  Dient der Heuristik für `Business-Potenzial`.
- `Modifier`
  Typische Modifier wie `best`, `review`, `vs`, `calculator`.
- `Include`
  Zusätzliche Begriffe, von denen mindestens einer im Keyword vorkommen soll.
- `Exclude`
  Begriffe, die im Keyword nicht vorkommen dürfen.
- `Eigene Marke`
  Label für die KI-/Brand-Gap-Ansicht.
- `Eigene Domain`
  Domain der eigenen Marke.
- `Wettbewerber`
  Ein bis drei Wettbewerberdomains für die Mention-Gap-Ansicht.
- `AI-Plattform`
  Standard ist `Google`. `chat_gpt` wird nur angeboten, wenn Markt und Sprache im UI unterstützt werden.

### Matching-Modus

Der Matching-Modus beeinflusst die Grundmenge der Keywords:

- `Begriffe enthalten`
  Alle Terme eines Seeds müssen im Keyword vorkommen.
- `Phrase enthalten`
  Die exakte Seed-Phrase muss im Keyword vorkommen.

Ein Wechsel dieses Modus triggert eine neue Server-Anfrage, weil sich dadurch das zugrunde liegende Resultset ändert.

## 2. Run starten

Mit `Matching Terms laden` wird die Keyword-Recherche ausgeführt.

Serverseitig läuft der Flow in mehreren Schritten:

1. Aus den Seeds werden Keyword-Ideen über `keywords_data/google_ads/keywords_for_keywords/live` geladen.
2. Das Resultset wird nach Matching-Modus sowie Include-/Exclude-Logik gefiltert.
3. Die verbleibenden Keywords werden in Batches mit Suchvolumen und Suchintention angereichert.
4. Optional werden Keyword-Overview-Daten für Traffic-Potenzial und SERP-Kontext ergänzt.
5. Für eine Top-Shortlist werden zusätzliche SERP- und Backlink-Daten geladen, um `Schwierigkeit (approx)`, `Niedrigste Autorität`, `Min. Ref.-Domains` und KI-Risiko zu berechnen.
6. Für den KI-/Brand-Gap wird eine heuristische Mention-Analyse für eigene Marke und Wettbewerber gebaut.

## 3. Hero Prompt verstehen

Unterhalb des Setups zeigt der Workspace einen `Hero Prompt`.

Dieser Prompt:

- beschreibt Nische, Zielgruppe und Monetarisierung
- fasst Seeds und Modifier zusammen
- dient als strukturierte Übergabe an einen externen Research- oder Content-Workflow
- wird in v1 nur generiert, aber nicht automatisch an ein LLM gesendet

## 4. Matching Terms analysieren

Nach dem ersten Run öffnet sich die rechte Seite standardmäßig in `Matching Terms`.

Diese Ansicht besteht aus vier Teilen:

### Obere Summary

Hier werden die wichtigsten Kennzahlen des geladenen Datensatzes gezeigt:

- Anzahl Seeds
- Anzahl Modifier/Include-Terme
- Anzahl Matching Terms
- Anzahl Tool-Chancen

Warnungen unterhalb der Summary zeigen, wenn Daten nur heuristisch oder nur für eine Shortlist berechnet wurden.

### Tabs innerhalb der Matching-Ansicht

- `Alle Begriffe`
  Zeigt alle Matching Terms im aktuell geladenen Datensatz.
- `Fragen`
  Zeigt nur Frage-Keywords innerhalb desselben Datensatzes.

Diese Umschaltung verändert nur die Ergebnisansicht, nicht die zugrunde liegende Query.

### Matching-Modus-Umschalter

Innerhalb der rechten Seite kann zwischen `Begriffe enthalten` und `Phrase enthalten` gewechselt werden. Diese Umschaltung ändert die Server-Query und lädt den Datensatz neu.

### Linke Cluster-Sidebar

Die Sidebar kann zwischen zwei Clustering-Arten wechseln:

- `nach Begriffen`
  Häufigste nicht-triviale Tokens aus dem gefilterten Set.
- `nach Oberthema`
  Heuristische Gruppierung nach längstem passenden Seed oder dominanter Token-Kombination.

Ein Klick auf einen Cluster setzt sofort einen Filter für die Tabelle.

## 5. Filterleiste verwenden

Die Filterleiste oberhalb der Tabelle arbeitet clientseitig auf dem bereits geladenen Datensatz.

Verfügbare Filter:

- `Trend`
- `Suchintention`
- `Schwierigkeit`
- `Suchvolumen`
- `Wachstum 12M`
- `Niedrigste Autorität`
- `Traffic-Potenzial`
- `Sprache`
- `Oberthema`
- `SERP-Features`
- `Include`
- `Exclude`

Diese Filter verändern nicht die Server-Query. Neue Server-Anfragen entstehen nur bei Änderungen an:

- Seeds
- Modifiern
- Include/Exclude im Setup
- Matching-Modus
- Sprache
- Standort

## 6. Tabellenmetriken lesen

Die Haupttabelle in `Matching Terms` zeigt pro Keyword:

- `Keyword`
- `Suchintention`
- `Schwierigkeit`
- `SV`
- `Trend`
- `Wachstum 12M`
- `Niedrigste Autorität`
- `Traffic-Potenzial`
- `CPC`
- `Oberthema`
- `KI-Risiko`
- `Tool-Chance`

### Fachlogik hinter zentralen Metriken

#### Suchintention

Primärquelle ist `dataforseo_labs/google/search_intent/live`. Nur wenn dort keine belastbare Antwort vorliegt, fällt der Workspace auf lokale Heuristiken zurück.

#### Schwierigkeit (approx)

Die Schwierigkeit ist ausdrücklich eine Approximation, kein offizieller DataForSEO-KD.

Formel:

`score = clamp(round(0.6 * medianAuthority + 8 * log10(medianRefDomains + 1) + aiPenalty), 0, 100)`

Dabei gilt:

- `medianAuthority`
  Median der Autoritätswerte der Top-SERP-Domains
- `medianRefDomains`
  Median der verweisenden Domains der Top-Ergebnisse
- `aiPenalty = 10`
  wenn ein AI-Element in der SERP erkannt wurde

#### KI-Risiko

- `hoch`
  AI Overview vorhanden und Intent primär informational
- `mittel`
  AI Overview vorhanden und Intent kommerziell oder gemischt
- `niedrig`
  kein AI Overview erkannt

#### Business-Potenzial

Business-Potenzial wird auf einer Skala von `0` bis `3` bewertet:

- `3`
  transaktional, kommerziell oder Tool-Keyword mit klarer Monetarisierung
- `2`
  starker Produkt- oder Vergleichsbezug
- `1`
  indirekter Bezug
- `0`
  kaum monetarisierbar

## 7. Weitere Unteransichten

### Fragen

Zeigt informationsgetriebene oder klar als Frage formulierte Keywords als separaten Report. Diese Ansicht ist hilfreich für ToFu-Content, FAQ-Blöcke und Themenvalidierung.

### Cluster nach Begriffen

Zeigt die häufigsten Tokens im aktuellen Datensatz. Diese Ansicht hilft bei:

- Themenstrukturierung
- interner URL-Architektur
- Priorisierung von Modifier-Familien

### Cluster nach Oberthema

Zeigt heuristische Parent-Topic-Cluster. Das ist keine exakte Ahrefs-Parität, sondern ein bewusst als `Oberthema` ausgewiesener v1-Approximationslayer.

### BID-Vetting

Diese Ansicht priorisiert Keywords anhand von:

- `Business-Potenzial`
- `Suchintention`
- `SERP-Format`
- `KI-Risiko`
- `Schwierigkeit (approx)`
- `Niedrigste Autorität`
- `Min. Ref.-Domains`
- `Empfehlung`

Das Deep-Vetting wird aus Performance-Gründen nur für eine Shortlist berechnet, nicht für das gesamte Keyword-Set.

### Tool-Chancen

Hier landen Keywords mit Mustern wie:

- `calculator`
- `checker`
- `generator`
- `tool`
- `rechner`
- `prüfer`

Die Ansicht dient dazu, Tool-Keywords mit hoher Produkt- oder Lead-Potenzial direkt von klassischen Content-Keywords zu trennen.

### KI-/Brand-Gap

Diese Ansicht ist eine heuristische Annäherung an einen Brand-Radar-Workflow.

Sie zeigt:

- eigene Marke
- Wettbewerber
- Mention-Abdeckung
- Prompts oder Keywords, bei denen Wettbewerber Erwähnungen haben und die eigene Marke nicht

Wenn eine Plattform im aktuellen Markt nicht unterstützt wird, wird sie im UI deaktiviert und begründet.

## 8. Demo-Modus und Live-Modus

Ohne DataForSEO-Zugangsdaten läuft der Workspace im Demo-Modus.

Wichtig:

- Demo und Live nutzen dieselbe Seitenstruktur
- dieselben Tabs und Unteransichten bleiben sichtbar
- die Demo ist dafür gedacht, den Workflow und die UI zu testen
- Live liefert die eigentliche Datenanreicherung

## 9. Empfohlener Arbeitsablauf

Für eine typische Recherche mit dem Tool empfiehlt sich dieser Ablauf:

1. Nische, Zielgruppe und Monetarisierung sauber definieren.
2. 3 bis 10 klare Seeds eingeben.
3. Modifier, Include und Exclude strategisch setzen.
4. Run starten und in `Matching Terms` die Grundmenge bewerten.
5. Über Cluster-Sidebar und Filterleiste Teilmengen isolieren.
6. `Fragen` für informationsgetriebene Themen prüfen.
7. `Tool-Chancen` separat auf Produkt- oder Lead-Potenzial prüfen.
8. `BID-Vetting` für die priorisierte Shortlist verwenden.
9. `KI-/Brand-Gap` für Wettbewerbs- und Mention-Lücken prüfen.
10. Hero Prompt und priorisierte Listen in den weiteren Content- oder Landingpage-Workflow überführen.

## 10. Grenzen in v1

- Kein automatischer Versand des Hero Prompts an ein LLM
- `Oberthema` ist heuristisch
- `Schwierigkeit` ist eine Approximation
- SERP- und Backlink-Deep-Dives laufen nur für eine Shortlist
- AI-/Brand-Gap ist eine brauchbare Annäherung, keine 1:1-Kopie von Ahrefs Brand Radar
