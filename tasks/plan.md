# Implementation Plan: StealthRDP Native Knowledge Base and Trust Pass

## Overview

Extend the existing StealthRDP v2 static Node site into the controlled public product surface.
Add a native knowledge base from verified StealthRDP documentation.
Remove the Chatwoot dependency from public navigation and footer links.
Repair trust and data-state defects without changing WHMCS or VirtFusion layouts.

## Architecture decisions

- Keep the existing zero-runtime-dependency Node server and prerendered HTML architecture.
- Keep WHMCS checkout, login, and support URLs as external destinations.
- Keep VirtFusion outside this repository and unchanged.
- Store migrated article content in repository JSON so the build remains reproducible.
- Render article Markdown with a small local renderer instead of adding a runtime framework.
- Keep the existing self-hosted fonts and control-room visual language.
- Replace the client-local countdown with a non-expiring promotion label.
- Label the hero console as a demonstration, not live deployment proof.
- Keep server-side UptimeRobot redaction and fail-closed behaviour.

## Task list

### Phase 1: Source and decision layer

- [x] Add `DESIGN.md` with the product-specific contract.
- [x] Add verified source documentation data with categories, dates, slugs, and article bodies.
- [x] Record source URLs and migration boundaries.

### Phase 2: Native documentation surface

- [x] Add a prerendered `/docs.html` index.
- [x] Add prerendered `/docs/<slug>.html` article routes.
- [x] Add search and category filtering over baked article metadata.
- [x] Add breadcrumbs, article metadata, contents, code copy controls, related articles, and support links.
- [x] Replace public Chatwoot documentation and terms links with native routes.
- [x] Keep old blog and FAQ routes stable until their migration is separately verified.

### Phase 3: Trust and runtime correctness

- [x] Remove the rolling client-local countdown.
- [x] Make the deployment console explicitly demonstrational.
- [x] Fix baked status counts when fixture status values use `up` strings.
- [x] Keep live status failure visibly distinct from healthy status.
- [ ] Preserve status target redaction.

### Phase 4: Verification

- [ ] Extend SEO and route tests for docs index and all article pages.
- [ ] Test search, category filtering, code-copy fallback, and reduced-motion behaviour.
- [ ] Run `npm test`, `npm run check`, and `npm run build`.
- [ ] Start the real Node server and verify key routes with HTTP requests.
- [ ] Run desktop and mobile browser checks when a browser runtime is available.
- [ ] Review for fake proof, stale Chatwoot links, generic sections, and content overflow.

## Acceptance criteria

- `/docs.html` returns `200` and contains all migrated article titles in initial HTML.
- Every migrated article route returns `200` and contains its title, category, source date, body, and support path.
- Search and category filtering work without a backend request.
- No public HTML source contains `docs.stealthrdp.com` or Chatwoot documentation links.
- The site contains no rolling client-local offer countdown.
- The hero console does not claim that a simulated deployment is live.
- Status fixture data renders its actual `up` state in initial HTML.
- Existing purchase URLs remain pointed at `dash.stealthrdp.com`.
- Existing SEO, security, and no-raw-IP tests remain green.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Source article formatting varies | Medium | Use a constrained Markdown renderer and preserve raw source snapshots. |
| Some source articles are incomplete | High | Label gaps and do not invent missing instructions. |
| Old blog URLs are indexed | Medium | Keep routes stable and migrate them in a later content pass. |
| Live status API is unavailable locally | Medium | Use honest fixture state in development and fail closed in production. |
| New docs CSS creates unrelated regressions | Medium | Scope docs styles and run the full existing test suite. |

## Explicit non-goals

- No WHMCS layout redesign.
- No VirtFusion layout redesign.
- No new authentication system.
- No Chatwoot replacement chat widget.
- No fabricated customer proof, infrastructure metrics, or article content.
- No framework migration.
