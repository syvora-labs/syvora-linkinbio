# Apple Wallet & Google Wallet integration for tickets

Status: Draft
Date: 2026-05-12
Author: collaborative (Dario + Claude)

## Goal

Let ticket holders add their tickets to Apple Wallet and Google Wallet from:

1. The Stripe-confirmation email sent by `supabase/functions/stripe-webhook/index.ts`
2. The `ViewTicketsView.vue` page (`/tickets/order/:orderId`)

The wallet passes themselves must be on-brand: iris purple (`#6C5CE7`), white text, ECLIPSE BOUNDARIES wordmark, event artwork. The "Add to Apple Wallet" / "Add to Google Wallet" *buttons* embedded in the email and UI must use Apple's and Google's official badge assets per their brand guidelines (cannot be re-skinned in production).

## Non-goals

- Apple Wallet push updates (pass refresh after the pass is in the wallet). Out of scope for v1.
- Google Wallet object updates after issuance (e.g., marking a pass as void on check-in or refund). Out of scope for v1.
- Localised passes. v1 is English only.
- Standalone "wallet only" link sharing (e.g., SMS delivery). v1 only surfaces wallet links inside the email and the existing tickets page.

## User-visible flow

1. Buyer completes Stripe checkout → `stripe-webhook` marks order paid and sends confirmation email.
2. Email lists each ticket. Beneath every ticket row, two badges appear: "Add to Apple Wallet" and "Add to Google Wallet".
3. Tapping the Apple badge downloads a `.pkpass` (iOS recognises and offers "Add to Wallet"). Tapping the Google badge opens `pay.google.com/gp/v/save/...` and the user confirms "Save to Wallet".
4. Same two badges are rendered on `ViewTicketsView.vue` under each ticket's QR code, for buyers who reach the page directly (or want to re-add the pass).

## Architecture

### New edge function: `supabase/functions/wallet-pass/`

Single function, route-discriminated by path:

- `GET /functions/v1/wallet-pass/apple/{ticketId}?token={qr_token}`
  → `Content-Type: application/vnd.apple.pkpass`, body is the signed `.pkpass` binary.
- `GET /functions/v1/wallet-pass/google/{ticketId}?token={qr_token}`
  → `302` redirect to `https://pay.google.com/gp/v/save/{jwt}`.

The `token` query param must equal `tickets.qr_token` for that `ticketId`. This serves as access control: anyone with the QR token (i.e., anyone who legitimately has the ticket) can mint a wallet pass, and nothing else.

Both endpoints read:

- `tickets` (id, qr_token, status, phase_id, order_id)
- `ticket_orders` (id, buyer_name, event_id)
- `events` (title, location, event_date, artwork_url)
- `ticket_phases` (name)

If `status != 'valid'` or the order isn't paid, return `410 Gone`. If the token doesn't match, `403`.

### Apple Wallet generation

Use `npm:passkit-generator@3` (Deno supports npm specifiers in Supabase Edge Functions). The function:

1. Loads bundled assets: `assets/icon.png`, `icon@2x.png`, `icon@3x.png`, `logo.png`, `logo@2x.png`, `logo@3x.png`.
2. Fetches event `artwork_url` and resizes/embeds it as `strip.png` (and `@2x`, `@3x`). Resize done via `npm:sharp` or `npm:@jimp/core` — to be validated for Deno compat; fallback is to pre-host the resized artwork in Supabase Storage when an event is created.
3. Constructs a pass JSON with these fields (see "Pass content" below).
4. Signs the pass using cert material from secrets (PKCS#7 detached signature over `manifest.json`).
5. Zips and returns the resulting `.pkpass` buffer.

Required secrets:

- `APPLE_PASS_CERT_P12_BASE64` — base64 of the Pass Type ID `.p12`
- `APPLE_PASS_CERT_PASSWORD` — passphrase for the `.p12`
- `APPLE_WWDR_PEM` — Apple WWDR intermediate certificate as PEM
- `APPLE_PASS_TYPE_ID` — e.g. `pass.com.eclipseboundaries.ticket`
- `APPLE_TEAM_ID` — 10-character Apple Team ID

If any of these secrets are missing at function start, the `/apple/...` route returns `503` and the UI/email hides the Apple badge (see "Feature flag" below).

### Google Wallet generation

Class is created once, manually, via the Google Wallet REST API (one-time setup script in `supabase/functions/wallet-pass/scripts/create-class.ts`, runnable locally with `deno run`). The class ID is stored as a secret.

Per request, the function:

1. Builds an `EventTicketObject` referencing the class, populated with this ticket's fields.
2. Wraps it in a JWT (`typ: savetowallet`, audience `google`, issuer = service account email).
3. Signs RS256 with the service account private key.
4. Redirects `302` to `https://pay.google.com/gp/v/save/{jwt}`.

Required secrets:

- `GOOGLE_WALLET_SA_JSON_BASE64` — base64 of the service account JSON
- `GOOGLE_WALLET_ISSUER_ID` — numeric issuer ID
- `GOOGLE_WALLET_CLASS_ID` — full class resource ID, e.g. `{issuerId}.eclipseboundaries-ticket`

Same `503`-on-missing-secrets policy as Apple.

### Email integration

`stripe-webhook/index.ts → sendConfirmationEmail` already builds a ticket list table. Extend the per-row HTML to include two badge images (linked) below the existing row content. The function URLs go through the public site domain via a reverse-rewrite (or directly to `${SUPABASE_URL}/functions/v1/wallet-pass/...`) — to keep things simple, link directly to the function. Many email clients strip query params less aggressively than path segments, so we keep `?token=...` short.

Badge assets are hosted in `public/wallet/` and referenced from the email by absolute URL using `SITE_URL`.

### Frontend integration

In `ViewTicketsView.vue`, beneath each `.qr-container`:

```html
<div class="wallet-actions">
  <a :href="appleWalletUrl(ticket)" class="wallet-badge">
    <img src="/wallet/apple-wallet-badge.svg" alt="Add to Apple Wallet" />
  </a>
  <a :href="googleWalletUrl(ticket)" class="wallet-badge">
    <img src="/wallet/google-wallet-badge.svg" alt="Add to Google Wallet" />
  </a>
</div>
```

Both helper functions are `import.meta.env.VITE_SUPABASE_URL`-based and build the public function URL with the token query.

A feature flag is read from the backend: `get-order-tickets` returns `wallet: { apple: boolean, google: boolean }` reflecting which providers have secrets configured. The view hides badges accordingly. (For email, the same check runs server-side inside `stripe-webhook` before composing the HTML.)

## Pass content

### Apple (`eventTicket` style)

```jsonc
{
  "formatVersion": 1,
  "passTypeIdentifier": "{APPLE_PASS_TYPE_ID}",
  "teamIdentifier": "{APPLE_TEAM_ID}",
  "organizationName": "ECLIPSE BOUNDARIES",
  "description": "Event ticket",
  "serialNumber": "{ticketId}",
  "backgroundColor": "rgb(108, 92, 231)",
  "foregroundColor": "rgb(255, 255, 255)",
  "labelColor": "rgba(255, 255, 255, 0.7)",
  "barcodes": [{
    "format": "PKBarcodeFormatQR",
    "message": "{qr_token}",
    "messageEncoding": "iso-8859-1",
    "altText": "Show at door"
  }],
  "eventTicket": {
    "headerFields": [{ "key": "date", "label": "DATE", "value": "{eventDateShort}" }],
    "primaryFields": [{ "key": "event", "label": "EVENT", "value": "{event.title}" }],
    "secondaryFields": [
      { "key": "venue", "label": "VENUE", "value": "{event.location}" },
      { "key": "type", "label": "TYPE", "value": "{phase.name}" }
    ],
    "auxiliaryFields": [
      { "key": "doors", "label": "DOORS", "value": "{eventTime}" }
    ],
    "backFields": [
      { "key": "buyer", "label": "Holder", "value": "{order.buyer_name}" },
      { "key": "order", "label": "Order", "value": "#{order.id.slice(0,8)}" },
      { "key": "terms", "label": "Terms", "value": "Non-transferable. Photo ID may be required at entry." }
    ]
  }
}
```

### Google (`EventTicketObject`)

```jsonc
{
  "id": "{ISSUER_ID}.{ticketId}",
  "classId": "{GOOGLE_WALLET_CLASS_ID}",
  "state": "ACTIVE",
  "heroImage": {
    "sourceUri": { "uri": "{event.artwork_url}" }
  },
  "barcode": {
    "type": "QR_CODE",
    "value": "{qr_token}",
    "alternateText": "Show at door"
  },
  "ticketHolderName": "{order.buyer_name}",
  "ticketNumber": "{ticketId}",
  "hexBackgroundColor": "#6C5CE7"
}
```

The class (`EventTicketClass`) carries the shared event metadata (eventName, venue, dateTime, logo) and is created once per event — actually, simpler: one shared class for all ECLIPSE BOUNDARIES events, with event-specific fields living on the object. We'll use a single class.

## Data model

No new tables. No new columns required for v1.

Nice-to-have (not in v1): `tickets.google_wallet_object_id TEXT NULL` so we can later patch the object's state when a ticket is checked in or refunded. Add when push-update is implemented.

## Feature flag / progressive rollout

Apple Developer enrollment + cert wrangling can take days. Plan:

- **Phase 1** (this spec, deliverable now): Google Wallet end-to-end. Apple badge hidden via the feature flag described above. Email + UI render Google only.
- **Phase 2** (once Apple cert is in hand): set Apple secrets, badge auto-appears.

The feature flag is read by both the edge function (to refuse requests cleanly) and by `get-order-tickets` (to tell the frontend what to render). The email branch is decided inside `stripe-webhook` at composition time using the same env-presence check.

## Risks and mitigations

1. **`passkit-generator` in Deno**: Node-crypto compat for PKCS#7 signing inside Supabase Edge Functions is not guaranteed. Mitigation: write a 30-line spike that signs a hard-coded pass and runs `deno test` against it as the first task in the plan. If it doesn't work, fallback is a dedicated Vercel Node function for Apple signing only (the rest of the system stays on Supabase). This is a known risk and the plan should front-load it.

2. **Strip/hero image sizing**: Apple wants strip images at specific dimensions (Apple HIG: 375×123, with @2x and @3x). Event artwork is typically square or 16:9. We crop to fit. If `sharp`/`jimp` aren't viable in the function, fallback is to pre-render strip artwork during event creation and store in Supabase Storage with a known naming convention.

3. **Email client rendering**: Some clients (older Outlook) strip the badge SVGs. Use PNG badges with explicit `width`/`height` attributes and `display:block`.

4. **Token leakage**: The wallet URL contains the QR token. Anyone with that URL can mint a pass. This is acceptable because possession of the QR token *is* the ticket — the pass adds no new attack surface beyond what already exists in the email.

5. **Google class change after issuance**: Class updates propagate to all linked objects. Don't change class fields casually after launch.

## Testing strategy

- Unit: each helper (pass JSON builder, JWT signer) tested in isolation with fixture data.
- Integration: a `deno test` that hits the function locally with `supabase functions serve`, checks `Content-Type` and basic file structure (Apple) / decodes the JWT and validates claims (Google).
- Manual: end-to-end smoke on one real iPhone (Apple) and one real Android (Google) before enabling in production.

## Out-of-scope follow-ups

- Pass update push (Apple webServiceURL / Google class patch on check-in)
- "Add to Wallet" deep-link in a post-purchase SMS
- Multiple-ticket bundling (one wallet pass per order) — v1 is per-ticket
