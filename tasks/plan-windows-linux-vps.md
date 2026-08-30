# Implementation Plan: Windows and Linux VPS SEO Pages

## Overview
Add two prerendered commercial landing pages to the existing static Node frontend: `/windows-vps/` and `/linux-vps/`. Keep `/plans.html` as the shared comparison and checkout hub, preserve its existing WHMCS URLs and OS selector, and use the approved campaign drafts as the content source.

## Architecture decisions

- Extend `build.mjs`; do not add a client-rendered route or framework.
- Emit `windows-vps/index.html` and `linux-vps/index.html` so the public URLs end in `/` and expose content in initial HTML.
- Reuse the existing page shell, CSS primitives, JSON-LD helpers, and external checkout destinations.
- Add directory staging and local-server directory-index handling for preview parity.
- Add contextual links through shared homepage/plans/footer builders and the approved existing VPS articles.

## Tasks and acceptance criteria

1. Add page builders and generated routes.
   - Each route has unique approved title, description, canonical, H1, copy, headings, breadcrumbs, page schema, and useful OS-logo alt text.
   - Each page links to its correct plans anchor, the comparison anchor, the other OS page where relevant, support guidance, and the existing shared checkout.
2. Add internal-link context.
   - Homepage, plans page, desktop/mobile Products footer, Windows/Linux comparison article, RDP performance article, and VPS resource article link to the new pages.
3. Add sitemap and delivery support.
   - Both canonical routes are in generated sitemap; Vercel staging copies both directories; local server returns 200 for slash routes.
4. Extend regression tests.
   - Assert content separation, metadata/schema, links, sitemap entries, checkout URL preservation, and directory-route serving.
5. Verify locally and on preview.
   - Run `npm run seo:check`, `npm test`, `npm run build`, reusable gates, preview crawler, raw HTML checks, and browser/HTTP checks for both routes.
6. Commit, push, and open PR without merging or touching production.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Generated files drift from source | Build before tests and stage only generated output produced by the build. |
| Preview route is served as a directory 404 | Add explicit local directory-index fallback and stage both route directories. |
| Checkout behavior changes accidentally | Keep existing `planUrl`, `plans.html` selector, and exact WHMCS URLs untouched; add regression assertions. |
| Preview is indexed | Keep host-wide preview robots and server-side noindex behavior; verify the deployed host before reporting it. |
| Copy invents commercial facts | Use only facts in the approved brief/drafts and existing verified catalog. |
