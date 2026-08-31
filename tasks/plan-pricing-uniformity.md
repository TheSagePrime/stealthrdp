# Implementation Plan: Uniform VPS pricing

## Verified source

- Authoritative source: the live WHMCS catalog and product configuration pages at `https://dash.stealthrdp.com`.
- USA monthly catalog values were verified on the Standard USA RDP/VPS catalog.
- USA billing totals were verified on each available USA product configuration page.
- Bronze EU monthly and billing totals were verified on its product configuration page.
- Silver EU, Gold EU, Platinum EU, and Diamond EU currently return `Out of Stock` from WHMCS. Their monthly values were verified on the Europe catalog. No unavailable-cycle amount will be invented.

## Architecture decisions

- Replace the split `plans_usa.json` and `plans_eu.json` runtime sources with one `data/plans.json` catalog.
- Store the current monthly amount and exact verified cycle totals in the catalog.
- Keep unverified out-of-stock EU cycle totals absent. Render an explicit checkout-only state.
- Use one UMD `js/pricing.js` helper from both the prerender build and browser runtime.
- Remove the old generic `0.95/0.90/0.80/0.70` multiplier path.
- Remove monthly strike-through values that are not present in the live catalog. Show verified reference totals only for billing cycles where WHMCS exposes them.
- Preserve checkout URLs, analytics events, schema types, routes, llms.txt, robots behavior, and OS-specific copy.

## Acceptance criteria

- Every repeated plan has the same monthly display and monthly JSON-LD Offer price.
- Every displayed billing-cycle amount comes from the catalog.
- Billing labels match the live WHMCS savings labels.
- The Silver USA value is `€18.04` monthly and no stale `€18.05`, `€18.99`, or `€19.00` remains in public pricing surfaces.
- OS pages keep all shared catalog cards and their OS-specific content.
- Regression tests detect card and JSON-LD mismatches.
- `npm run seo:check`, `npm test`, `npm run build`, and preview checks pass.
- A noindex public preview is created without production deployment.

## Verification

- Run focused pricing tests, then the full test suite.
- Run the SEO gate and build.
- Probe the local preview over HTTP.
- Verify the public preview page, robots.txt, hidden sitemap, internal routes, and noindex response.
- Review the final diff and commit SHA. Do not push `main` or deploy production.
