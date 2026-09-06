# SEO Operations

- `keyword-map.json`: Senku-owned keyword and intent map. Populate only from OpenSEO/DataForSEO evidence.
- `docs-migration.json`: migration contract for consolidating the legacy docs subdomain into `/docs`.
- `TECHNICAL-SEO-STATUS.md`: current automated coverage and external boundaries.

Technical flow:

`source gate -> build -> bake production URLs -> build Markdown -> stage public artifact -> final artifact gate -> deploy -> preview/live crawl -> Lighthouse -> monitor`
