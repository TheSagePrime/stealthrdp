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
- Retired docs host safety verification command.

## External / production-owned checks

- `docs.stealthrdp.com` is a retired legacy host. It does not need to redirect if it is unreachable or returns 404/410.
- A direct 301/308 to the matching `www.stealthrdp.com/docs/...` URL is still preferable when old backlinks or indexed URL equity are worth preserving.
- `npm run docs:migration-check` verifies that the retired host is not serving competing indexable documentation again.
- Lighthouse is lab data. Real-user Core Web Vitals should still be monitored through GSC/CrUX or equivalent field data.
- Keyword values in `seo/keyword-map.json` remain intentionally empty until Senku/OpenSEO/DataForSEO research supplies evidence.
