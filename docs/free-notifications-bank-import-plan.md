# Free notifications and bank transaction import — implementation plan

Branch: `feature/free-notifications-import`

## Scope and safeguards
- No paid open-banking provider, no bank credentials, no scraping, no notification/SMS interception in the web app.
- Never deploy or run production migrations automatically. Keep user consent and RLS isolation.
- Bank imports must preview transactions before confirmation, support CSV initially, and tolerate Arabic numerals and dates where possible.
- Normalize merchant, amount, date and source; do not claim item-level product details from bank statements.
- Dedupe by stable source transaction ID when present, otherwise account fingerprint + date + amount + merchant, with explicit review for collisions.
- Never upload raw statements to third-party analytics or persist full card numbers.
- Goals/commitment reminders: notification preferences, opt-in, local timezone, quiet hours, idempotency and delivery history.
- iOS: installed PWA on home screen with permission, web push support subject to platform constraints. Android: web push; native notification listener requires separate native Android app with explicit permission and clear privacy UX.
- iOS bank notification reading is not available to third-party PWAs; provide CSV import and user-initiated share/shortcut workflow.
- Feature flag incomplete UI; ensure existing flows remain unaffected.

## Implementation order
1. Inspect current domain types, repository abstraction, migrations, tests, PWA service worker.
2. Implement CSV parsing + preview + validation + duplicate detection as pure tested utilities.
3. Add secure, consent-based import confirmation and persistence through repository abstraction.
4. Add goal and commitment notification preferences and in-app reminder center.
5. Add standards-compliant Web Push subscription and server-side scheduled delivery (requires deployment environment and secrets); never put VAPID private key in frontend.
6. Test TypeScript, lint, unit/integration, RLS and browser flows, then review PR before merging.

## Acceptance
- Arabic UI works on iOS and Android.
- Users can preview and cancel an import without modifying their data.
- Duplicate imports do not duplicate expenses.
- No bank credentials or complete card numbers stored.
- Reminder delivery does not repeat already-delivered events.
- Existing finance data remains unchanged until explicit user action.
