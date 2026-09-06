# StealthRDP Technical SEO Status

## Automated in this repository

- Source SEO gates before build.
- Final staged Vercel artifact audit after URL baking and staging.
- Exact canonical-to-file parity checks.
- Sitemap-to-indexable-page parity checks.
- Unresolved SEO base token detection.
- Redirect, robots, metadata, headings, schema, internal-link and AI-discovery checks.
- Automatic preview SEO crawl on successful preview deployment events.
- Automatic production SEO smoke check on successful production deployment events.
- Lighthouse lab-performance checks for preview, production deploys, and weekly production monitoring.
- Keyword ownership map for Senku/OpenSEO/DataForSEO research without invented metrics.
- Legacy docs migration verification command.

## External / production-owned checks

- `docs.stealthrdp.com` must be redirected at the old host, DNS, proxy, or edge layer. This repo cannot redirect traffic that never reaches it.
- Run `npm run docs:migration-check` after the old docs host redirect is configured.
- Lighthouse is lab data. Real-user Core Web Vitals should still be monitored through GSC/CrUX or equivalent field data.
- Keyword values in `seo/keyword-map.json` remain intentionally empty until Senku/OpenSEO/DataForSEO research supplies evidence.
