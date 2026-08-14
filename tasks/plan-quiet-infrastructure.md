# Implementation Plan: Quiet Infrastructure Homepage

## Overview

Replace the cluttered Stealth Workspace homepage with a clean, original VPS landing page.
Keep the real plan selector and WHMCS handoff, but make them subordinate to a calm product story.
Production stays on `main`; the redesign stays on `redesign/control-room-preview` and preview.antah.de.

## Design direction

- Primary surface: Persuade.
- Material: soft cloud-gray canvas, deep navy surfaces, one restrained gold accent.
- Hero: one direct proposition, one original simplified server illustration, one primary CTA.
- Pricing: a clean horizontal plan rail and one selected-plan summary.
- Proof: three verified product truths and links to native status/docs.
- Rhythm: hero → plan choice → capabilities → operating path → final CTA.
- Remove: ticker on home, artifact annotations, dense workload grid, fake console language, repeated micro-labels, four-step boxed grids, monitoring table from the home surface, and cluttered footer treatment.

## Acceptance criteria

- Homepage looks calm and spacious at 1440px and 390px.
- The first viewport contains one clear proposition, one primary CTA, and one simple visual.
- Plan selection updates the real WHMCS checkout URL.
- Existing routes and shared pages remain stable.
- No fabricated metrics, testimonials, locations, uptime, or deployment claims.
- `npm test`, `npm run check`, `npm run build`, syntax checks, and browser checks pass.

## Files likely touched

- `build.mjs`
- `css/style.css`
- `DESIGN.md`
- `index.html` (generated)
- `test/docs.test.js` only if composition assertions need deliberate updates

## Explicit non-goals

- No framework or dependency changes.
- No WHMCS or VirtFusion changes.
- No production deployment.
- No competitor assets, layout, copy, or visual identity copied.
