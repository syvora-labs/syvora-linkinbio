# Legal Pages — Design

**Date:** 2026-05-28
**Status:** Draft, awaiting review

## Context

The site now sells tickets via Stripe Checkout, which makes it a commercial offering under Swiss law (UWG Art. 3 lit. s) and brings it within the scope of the revised Federal Act on Data Protection (revDSG, in force since 2023-09-01) and GDPR for EU visitors. Three legal pages are required:

- **Impressum** — operator identification, required for any commercial Swiss website
- **Datenschutzerklärung** — privacy policy covering all processors (Supabase, Stripe, Resend, Vercel)
- **AGB** — contractual terms for the ticket sale itself

An AGB acceptance checkbox at checkout records explicit consent before each purchase.

> **Disclaimer:** The drafts below are written to be defensible and follow common Swiss practice for small-scale event organisers, but they are not legal advice. Have them reviewed by a Swiss lawyer before going live, especially the AGB.

## Operator details (used throughout)

- **Operators:** Dario Krieger und Fabian Boldini (einfache Gesellschaft nach Art. 530 ff. OR), handelnd unter dem Namen **ECLIPSE BOUNDARIES**
- **Adresse:** Röschmatte 7, 6204 Sempach
- **E-Mail:** dario@eclipseboundaries.ch
- **MwSt.:** Nicht mehrwertsteuerpflichtig (Jahresumsatz unter CHF 100'000)
- **Refund policy:** Keine Rückerstattung, Tickets nicht übertragbar

## Architecture (Approach A — markdown-based)

```
src/
  components/
    SiteFooter.vue          # new — legal links, copyright
  views/
    LegalView.vue           # new — slug-driven markdown renderer
  router/
    index.ts                # add /legal/:slug route
public/
  legal/
    impressum.md            # new
    datenschutz.md          # new
    agb.md                  # new
supabase/
  migrations/
    YYYYMMDDHHMMSS_add_agb_accepted_at.sql  # new
  functions/
    create-checkout/
      index.ts              # reject missing agb_accepted_at; persist on order
```

### Routing

One route handles all three pages via a slug param:

```ts
{
  path: '/legal/:slug(impressum|datenschutz|agb)',
  name: 'legal',
  component: () => import('@/views/LegalView.vue'),
}
```

Routes resolve to `/legal/impressum`, `/legal/datenschutz`, `/legal/agb`. The regex constraint prevents arbitrary slugs from rendering an empty page.

### `LegalView.vue` behaviour

1. Read `route.params.slug`.
2. Fetch `/legal/{slug}.md` via `fetch()`.
3. Render with `marked` inside a scoped container styled to match the existing dark gradient aesthetic.
4. Show a minimal loading state during fetch; show a "Seite nicht gefunden" message on 404.
5. Set `document.title` from the first `# heading` in the markdown.
6. Watch `route.params.slug` to support client-side navigation between legal pages.

### Footer (`SiteFooter.vue`)

Sits in `App.vue` below `<RouterView />`, so it appears on every route including the ticket shop and detail views. Three router-links plus a copyright line:

```
Impressum  ·  Datenschutz  ·  AGB

© 2026 ECLIPSE BOUNDARIES
```

Styling: low-contrast white-on-dark, small font (~13 px), centred, ~24 px vertical padding.

### Dependency

Add `marked` to `package.json` dependencies. ~10 KB gzipped, zero runtime dependencies, actively maintained.

## AGB checkbox at checkout

### UI (TicketShopView.vue)

Just above the "Kostenpflichtig bestellen" / pay button:

```
☐  Ich habe die AGB und die Datenschutzerklärung
   gelesen und akzeptiere sie.
```

The words "AGB" and "Datenschutzerklärung" are inline links opening `/legal/agb` and `/legal/datenschutz` in a new tab (`target="_blank" rel="noopener noreferrer"`).

**Rules:**

- Unchecked by default. Pre-checked boxes are invalid consent under both revDSG and GDPR (CJEU *Planet49*, C-673/17).
- Submit button stays `disabled` until the box is checked.
- On submit, the current ISO timestamp is captured and sent to `create-checkout` as `agb_accepted_at`.

### Database migration

```sql
ALTER TABLE ticket_orders
  ADD COLUMN agb_accepted_at TIMESTAMPTZ;
```

Nullable. Existing rows stay NULL (acceptance pre-dates this feature).

### Edge function changes (`create-checkout`)

- Accept `agb_accepted_at` in the request body. Required for new orders.
- Reject with HTTP 400 if missing, malformed, or older than 1 hour (prevents replay of an old timestamp from a long-open browser tab).
- Persist `agb_accepted_at` on the inserted `ticket_orders` row.

### Why server-side, not just UI gating

A disabled button can be bypassed via devtools. Storing the acceptance timestamp on the order row gives a defensible audit trail tied 1:1 to the purchase, which is what matters in a dispute.

## Legal text drafts

### `public/legal/impressum.md`

```markdown
# Impressum

## Anbieter

Dario Krieger und Fabian Boldini
in einfacher Gesellschaft nach Art. 530 ff. OR,
handelnd unter dem Namen **ECLIPSE BOUNDARIES**.

Röschmatte 7
6204 Sempach
Schweiz

E-Mail: dario@eclipseboundaries.ch

## Vertretungsberechtigte Personen

Dario Krieger, Fabian Boldini (einzelzeichnungsberechtigt für die einfache Gesellschaft).

## Haftungsausschluss

Die Inhalte dieser Website werden mit grösstmöglicher Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte wird jedoch keine Gewähr übernommen. Die Nutzung der abrufbaren Inhalte erfolgt auf eigenes Risiko der Nutzerin oder des Nutzers.

## Externe Links

Diese Website enthält Verweise auf Websites Dritter. Auf deren Inhalt haben wir keinen Einfluss. Für den Inhalt der verlinkten Seiten ist ausschliesslich der jeweilige Anbieter verantwortlich.

## Urheberrecht

Sämtliche auf dieser Website veröffentlichten Inhalte (Texte, Bilder, Grafiken, Logos) sind urheberrechtlich geschützt. Eine Verwendung — insbesondere Vervielfältigung, Verbreitung oder Bearbeitung — bedarf der vorgängigen schriftlichen Zustimmung der Anbieter.
```

### `public/legal/datenschutz.md`

```markdown
# Datenschutzerklärung

Stand: 28. Mai 2026

## 1. Verantwortliche Stelle

Verantwortlich für die Bearbeitung personenbezogener Daten im Sinne des Schweizer Datenschutzgesetzes (revDSG) und der EU-Datenschutz-Grundverordnung (DSGVO) sind:

Dario Krieger und Fabian Boldini
(einfache Gesellschaft, ECLIPSE BOUNDARIES)
Röschmatte 7, 6204 Sempach, Schweiz
E-Mail: dario@eclipseboundaries.ch

## 2. Welche Daten wir bearbeiten

Beim Besuch der Website werden technische Daten (IP-Adresse, Browsertyp, Zugriffszeit) durch unseren Hosting-Anbieter automatisch in Logfiles gespeichert. Diese Daten werden nicht mit anderen Datenquellen zusammengeführt.

Beim Ticketkauf bearbeiten wir zusätzlich:

- Vor- und Nachname
- E-Mail-Adresse
- Bestell- und Zahlungsdaten (Ticketkategorie, Betrag, Zahlungsstatus)
- Zeitpunkt der Zustimmung zu den AGB
- bei Bedarf weitere Angaben, die Sie freiwillig im Bestellprozess machen

## 3. Zwecke der Bearbeitung

Wir bearbeiten Ihre Daten zur Abwicklung des Ticketkaufvertrags, zur Zustellung der Tickets, zur Einlasskontrolle am Veranstaltungsort, zur Kommunikation im Zusammenhang mit der Veranstaltung (z. B. Absage, Verschiebung) sowie zur Erfüllung gesetzlicher Aufbewahrungspflichten.

## 4. Rechtsgrundlage

Die Bearbeitung erfolgt zur Erfüllung des Vertrags mit Ihnen (Art. 31 Abs. 2 lit. a revDSG, Art. 6 Abs. 1 lit. b DSGVO), zur Erfüllung gesetzlicher Pflichten (Art. 31 Abs. 2 lit. c revDSG, Art. 6 Abs. 1 lit. c DSGVO) sowie auf Grundlage Ihrer Einwilligung, wo eine solche eingeholt wird.

## 5. Auftragsbearbeiter und Drittanbieter

Wir setzen folgende Anbieter ein, die in unserem Auftrag Daten bearbeiten:

- **Vercel Inc.**, USA — Hosting der Website. Datenübermittlung in die USA auf Grundlage von Standardvertragsklauseln (SCC).
- **Supabase Inc.**, betrieben in der EU (Irland) — Datenbank und serverseitige Logik (Edge Functions). Speicherung der Bestelldaten.
- **Stripe Payments Europe Ltd.**, Irland (mit Konzerngesellschaft in den USA) — Zahlungsabwicklung. Stripe erhält die zur Zahlung notwendigen Daten direkt. Es gelten die Datenschutzbestimmungen von Stripe: https://stripe.com/de-ch/privacy
- **Resend Inc.**, USA — Versand von Transaktions-E-Mails (Bestellbestätigung, Tickets). Datenübermittlung in die USA auf Grundlage von Standardvertragsklauseln (SCC).

Eine Weitergabe an andere Dritte erfolgt nur, soweit dies zur Vertragserfüllung notwendig ist oder wir gesetzlich dazu verpflichtet sind.

## 6. Aufbewahrungsdauer

Bestell- und Buchhaltungsdaten bewahren wir während zehn Jahren auf (Art. 958f OR). Nicht buchhaltungsrelevante Daten löschen wir, sobald sie für die ursprünglichen Zwecke nicht mehr benötigt werden.

## 7. Cookies

Unsere Website setzt keine Tracking- oder Analyse-Cookies ein. Beim Bezahlvorgang werden durch Stripe Checkout funktional notwendige Cookies gesetzt, ohne die der Zahlungsvorgang nicht durchgeführt werden kann.

## 8. Ihre Rechte

Sie haben das Recht auf Auskunft über die zu Ihrer Person bearbeiteten Daten, auf Berichtigung unrichtiger Daten, auf Löschung und auf Einschränkung der Bearbeitung. Sie können einer Bearbeitung widersprechen und unter den Voraussetzungen der DSGVO Ihre Daten in einem gängigen Format erhalten (Datenportabilität).

Anfragen richten Sie bitte an dario@eclipseboundaries.ch.

Beschwerden können Sie bei der zuständigen Aufsichtsbehörde einreichen — in der Schweiz beim Eidgenössischen Datenschutz- und Öffentlichkeitsbeauftragten (EDÖB), https://www.edoeb.admin.ch.

## 9. Änderungen

Wir behalten uns vor, diese Datenschutzerklärung anzupassen. Massgeblich ist die jeweils zum Zeitpunkt des Vertragsschlusses gültige Fassung.
```

### `public/legal/agb.md`

```markdown
# Allgemeine Geschäftsbedingungen (AGB)

Stand: 28. Mai 2026

## 1. Geltungsbereich

Diese Allgemeinen Geschäftsbedingungen gelten für sämtliche Ticketkäufe, die über die Website von ECLIPSE BOUNDARIES (eclipseboundaries.ch) abgeschlossen werden. Veranstalter und Vertragspartner ist die einfache Gesellschaft Dario Krieger und Fabian Boldini, Röschmatte 7, 6204 Sempach (nachfolgend "Veranstalter").

Mit dem Abschluss einer Bestellung erklären Sie sich mit diesen AGB einverstanden. Abweichende Bedingungen der Käuferin oder des Käufers werden nicht anerkannt, sofern der Veranstalter ihnen nicht ausdrücklich schriftlich zustimmt.

## 2. Vertragsschluss

Die Darstellung der Tickets auf der Website stellt kein verbindliches Angebot dar. Durch Anklicken der Schaltfläche "Kostenpflichtig bestellen" und erfolgreichen Abschluss des Zahlungsvorgangs geben Sie ein verbindliches Angebot zum Kauf der ausgewählten Tickets ab. Der Vertrag kommt mit der Zustellung der Bestellbestätigung per E-Mail zustande.

## 3. Preise und Zahlung

Alle Preise verstehen sich in Schweizer Franken (CHF) und sind Endpreise. Der Veranstalter ist nicht mehrwertsteuerpflichtig; es wird keine Mehrwertsteuer ausgewiesen.

Die Bezahlung erfolgt über den Zahlungsdienstleister Stripe. Es gelten die jeweils auf der Bestellseite angezeigten Zahlungsmittel. Mit Abschluss des Zahlungsvorgangs ist der gesamte Ticketpreis sofort fällig.

## 4. Ticketzustellung

Tickets werden ausschliesslich elektronisch zugestellt. Nach erfolgreicher Zahlung erhalten Sie eine Bestellbestätigung sowie Ihre Tickets mit QR-Code per E-Mail an die im Bestellprozess angegebene Adresse. Sie sind verpflichtet, eine gültige E-Mail-Adresse anzugeben und Ihren Spam-Ordner zu prüfen, falls die Zustellung verzögert erscheint.

## 5. Personengebundenheit, keine Übertragung

**Tickets sind personengebunden und nicht übertragbar.** Sie lauten auf den im Bestellprozess angegebenen Namen. Der Veranstalter behält sich vor, am Einlass einen amtlichen Lichtbildausweis zu kontrollieren und den Zutritt zu verweigern, wenn der Name auf dem Ticket nicht mit demjenigen auf dem Ausweis übereinstimmt.

Der gewerbliche Weiterverkauf von Tickets sowie der Verkauf zu einem höheren als dem auf dem Ticket aufgedruckten Preis sind ausdrücklich untersagt. Tickets aus solchen Quellen verlieren ihre Gültigkeit ohne Anspruch auf Rückerstattung.

## 6. Kein Rückgabe- oder Widerrufsrecht

Für Veranstaltungstickets besteht nach Schweizer Recht **kein gesetzliches Widerrufs- oder Rückgaberecht**. Auch freiwillig gewährt der Veranstalter weder Rückerstattung noch Umtausch, gleich aus welchem Grund die Käuferin oder der Käufer die Veranstaltung nicht besuchen kann (Krankheit, Verhinderung, verpasster Anreiseweg, Ausweisverlust, Nichterhalt der E-Mail aus selbst verschuldeten Gründen usw.).

Ausnahmen gelten ausschliesslich bei Absage oder erheblicher Verschiebung der Veranstaltung durch den Veranstalter (vgl. Ziff. 7).

## 7. Absage oder Verschiebung der Veranstaltung

Muss eine Veranstaltung aus Gründen abgesagt werden, die der Veranstalter zu vertreten hat, erhalten Käuferinnen und Käufer den Ticketpreis vollumfänglich zurückerstattet. Allfällige Bearbeitungs- oder Zahlungsgebühren von Drittanbietern (z. B. Stripe) werden nicht erstattet.

Bei höherer Gewalt (insbesondere behördliche Anordnungen, Naturereignisse, Pandemie-Massnahmen, Stromausfall am Veranstaltungsort) bemüht sich der Veranstalter um eine Verschiebung der Veranstaltung. Eine Rückerstattung erfolgt in diesen Fällen nur, wenn keine Verschiebung möglich ist. Weitergehende Ansprüche der Käuferin oder des Käufers (insbesondere Ersatz von Reise-, Übernachtungs- oder Folgekosten) sind ausgeschlossen.

Wird die Veranstaltung verschoben, behalten gekaufte Tickets ihre Gültigkeit für den neuen Termin.

## 8. Hausrecht und Einlass

Der Veranstalter übt am Veranstaltungsort das Hausrecht aus. Er ist berechtigt, den Zutritt ohne Angabe von Gründen zu verweigern oder Personen des Geländes zu verweisen, insbesondere bei:

- offensichtlich erheblicher Alkohol- oder Drogenintoxikation
- Mitführen von Waffen oder gefährlichen Gegenständen
- Mitführen von Betäubungsmitteln
- aggressivem oder belästigendem Verhalten gegenüber anderen Gästen oder Mitarbeitenden

Ein Anspruch auf Rückerstattung des Ticketpreises entsteht in solchen Fällen nicht.

Es gilt ein generelles Drogenverbot. Der Veranstalter haftet nicht für Schäden, welche Gäste unter dem Einfluss von Alkohol oder Drogen sich selbst oder Dritten zufügen.

## 9. Haftung

Der Veranstalter haftet für Schäden nur bei Vorsatz oder grober Fahrlässigkeit. Eine Haftung für leichte Fahrlässigkeit, Hilfspersonen und Folgeschäden ist im gesetzlich zulässigen Rahmen ausgeschlossen.

Für mitgebrachte persönliche Gegenstände (Kleidung, Wertsachen, elektronische Geräte) wird keine Haftung übernommen. Die Nutzung einer allfälligen Garderobe erfolgt auf eigenes Risiko.

Der Besuch der Veranstaltung erfolgt grundsätzlich auf eigene Verantwortung. Insbesondere wird darauf hingewiesen, dass elektronische Musikveranstaltungen mit hoher Lautstärke und Lichteffekten (inkl. Stroboskop) verbunden sind.

## 10. Datenschutz

Die Bearbeitung personenbezogener Daten richtet sich nach der separaten Datenschutzerklärung, abrufbar unter eclipseboundaries.ch/legal/datenschutz.

## 11. Anwendbares Recht und Gerichtsstand

Auf diese AGB und sämtliche Streitigkeiten aus oder im Zusammenhang mit dem Ticketkaufvertrag findet ausschliesslich Schweizer Recht Anwendung, unter Ausschluss des UN-Kaufrechts (CISG) und der Kollisionsnormen des IPRG.

Ausschliesslicher Gerichtsstand ist Sempach, Kanton Luzern. Vorbehalten bleiben zwingende gesetzliche Gerichtsstände, insbesondere am Wohnsitz von Konsumentinnen und Konsumenten gemäss Art. 32 ZPO.

## 12. Salvatorische Klausel

Sollten einzelne Bestimmungen dieser AGB ganz oder teilweise unwirksam sein oder werden, berührt dies die Wirksamkeit der übrigen Bestimmungen nicht. An die Stelle der unwirksamen Bestimmung tritt eine wirksame Regelung, die dem wirtschaftlichen Zweck der unwirksamen Bestimmung möglichst nahekommt.

## 13. Änderungen der AGB

Massgebend ist die zum Zeitpunkt des Vertragsschlusses geltende Fassung dieser AGB.
```

## Implementation order

1. Add `marked` dependency.
2. Create the three markdown files in `public/legal/`.
3. Build `LegalView.vue` and add the route.
4. Build `SiteFooter.vue` and mount it in `App.vue`.
5. Write migration adding `agb_accepted_at` to `ticket_orders`, apply locally and to production.
6. Update `TicketShopView.vue` with the checkbox + disabled submit logic.
7. Update `create-checkout` edge function to require, validate, and persist `agb_accepted_at`.
8. Deploy.

## Out of scope

- Translation into English/French/Italian (current site is English; legal pages in German is standard practice in Switzerland and most defensible).
- Cookie banner (no tracking cookies in use).
- Right-of-withdrawal banner at checkout (no withdrawal right exists for dated events under Swiss law; the AGB clause is sufficient).
- Legal review by a Swiss lawyer (strongly recommended before going live, but outside the scope of this implementation task).
