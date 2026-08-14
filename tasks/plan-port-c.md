# Implementation Plan: Port Approved C Design into the Real Frontend

## Overview
Port the approved direction C (Warm Instrument, stable hosted brand colors,
dark/light theme toggle) from the revamp.antah.de prototype into the real
StealthRDP frontend on the preview branch `redesign/control-room-preview`.
Production `main` stays untouched. Deliverable: preview.antah.de shows the new
homepage with working plan selection and real WHMCS checkout.

## Architecture Decisions
- Keep the zero-dependency static architecture (build.mjs prerenders, server.js serves).
- Keep the real plan data (`data/plans_usa.json`) and real checkout URLs (`planUrl()`).
- Use CSS custom properties for the theme: `:root` = dark (brand), `:root[data-theme="light"]` = warm paper.
- Theme init runs in `<head>` to prevent flash; persistence via localStorage; default follows system preference.
- Homepage composition = approved C: centered hero + machine SVG, proof strip,
  plan rail with 6 USA plans + detail card, why section, details, close band.
- Other pages (plans, features, status, docs, blog, faq) keep their existing
  layout but inherit the theme tokens so the toggle works site-wide.
- Tests are updated to the new composition markers; the old decision-desk markers
  are removed with the old homepage.

## Task List

### Phase 1: Theme system
- [ ] Task 1: Add light theme token block + theme toggle CSS + machine SVG var() fills in css/style.css
- [ ] Task 2: Add theme init inline script in build.mjs `head()` and theme toggle button in `headerHtml()`
- [ ] Task 3: Add theme toggle + plan selection JS in js/main.js; remove dead desk code

### Phase 2: Homepage composition
- [ ] Task 4: Replace `buildIndex()` body with approved C design (hero, machine, proof, plan rail, detail card, why, details, close)

### Phase 3: Tests + gate
- [ ] Task 5: Update test/docs.test.js homepage assertions to new markers
- [ ] Checkpoint: npm test, npm run check, npm run build, node --check, git diff --check

### Phase 4: Deploy + verify
- [ ] Task 6: Commit, push to preview branch, wait for webhook deploy
- [ ] Task 7: Live verify: markers, routes, browser probes (both themes, desktop+mobile), production unchanged

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Existing CSS class collisions | Med | Use `cq-` prefix for new homepage classes |
| Theme flash on load | Low | Inline init script in `<head>` before CSS paint |
| Test pins old markers | Med | Update tests deliberately to new markers |
| Docs/status pages inherit light theme poorly | Low | Tokens map to existing vars; verify visually |
