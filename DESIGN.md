# StealthRDP Web Design Contract

Status: active working contract
Owner: Sage Prime
Implementation owner: Suho / #Builder
Last reviewed: 2026-08-14

## Product truth

StealthRDP sells Windows and Linux VPS/RDP services.
The public website helps a buyer understand the service, compare plans, read operational guidance, and move to WHMCS checkout.
The website does not replace WHMCS or VirtFusion.
WHMCS owns login, billing, checkout, and client account flows.
VirtFusion owns server operations and client-side infrastructure controls.

## Design objective

Make StealthRDP feel like one credible infrastructure company across different systems.
Do not force fixed WHMCS or VirtFusion layouts to match this site.
Use the public website as the authored product surface.
Use links, language, brand tokens, and status semantics as the bridge to external systems.

## Surface modes

| Surface | Primary mode | User job | Composition |
|---|---|---|---|
| Home | Persuade | Decide whether StealthRDP fits the workload | Narrative proof, deployment promise, one clear action |
| Plans | Compare | Select a plan and location | Aligned options, visible differences, direct checkout actions |
| Docs index | Explore | Find the right guide | Search first, task categories, recent and popular paths |
| Docs article | Read | Complete a server task safely | Article measure, metadata, contents, code, next step |
| Status | Monitor | Check current service state | Current summary, component state, incident context |
| FAQ and policy | Read | Resolve a trust or account question | Calm text hierarchy and clear support path |

## Central idea

The public site expresses a server journey:

`choose → provision → connect → operate`

Use deployment language when it explains the service.
Do not turn the whole site into a fake terminal.
The terminal motif belongs to deployment, status, commands, and technical evidence.

## Visual direction

Use a soft cloud-gray/light canvas on the homepage only, with deep navy product surfaces and one restrained gold accent.
Keep the shared pages practical and dark where their current operational context benefits from it.
Use green only for healthy or online states, orange for warnings, and neutral gray for unknown data.

Use Space Grotesk for display hierarchy.
Use Inter for reading and interface text.
Use JetBrains Mono sparingly for technical values and status labels, not as decorative chrome.
Keep the type system limited to these self-hosted families.

On Home, favour whitespace, alignment, a calm light header, and one simple local server/workspace visual.
Use borders only to separate real relationships: the proof rail, plan rail, operating path, and support links.
Use a deep navy surface for the selected-plan summary and final handoff.
Do not use a ticker, grid wallpaper, beige editorial styling, gold shadows, nested card stacks, pills, fake terminal output, dashboard theatre, fake metrics, testimonials, or generic SaaS bento grids on Home.
Do not copy a reference brand's identity, exact layout, assets, copy, or claims.

## Composition rules

The first viewport must answer three questions:

1. What does StealthRDP provide?
2. Why should the buyer trust it?
3. What is the next action?

The homepage may use one technical console as a product explanation.
The plans page must prioritise comparison over atmosphere.
The docs index must prioritise search and task selection over marketing copy.
An article must prioritise reading and safe execution over decoration.
The status page must prioritise current state over promotional claims.

Every major page needs one primary action.
Secondary actions must remain visually subordinate.
Use repeated sections only when they support a different decision step.

## Native knowledge base

The native knowledge base replaces the Chatwoot-hosted documentation surface.
Use `/docs.html` for the index and `/docs/<slug>.html` for articles.
Migrate only verified source content from the current StealthRDP documentation.
Preserve article meaning, commands, links, and update dates.
Do not invent missing steps, screenshots, testimonials, or guarantees.

Every article needs:

- Category and breadcrumb.
- Source title.
- Last updated date when known.
- Short task summary.
- Article contents when headings exist.
- Readable code blocks with copy actions.
- Related or next articles when known.
- A support action that links to WHMCS.
- A clear warning when a step can erase data or requires a fresh server.

Use searchable category labels based on user tasks:

- Getting started.
- Windows.
- Linux.
- VPN and networking.
- Web panels.
- Server management.
- Account and billing.
- Terms and policies.

## Truth and evidence rules

Do not show a rolling client-local countdown as proof of a real offer expiry.
Do not call simulated deployment data live.
Label demonstrations as demonstrations.
Use live status claims only when the runtime data path succeeds.
Keep the server-side status response redacted to logical components and regions.
Do not expose raw IP addresses, ports, monitor IDs, or upstream hostnames.

Keep approved product data from the existing repository unless Bhuvan changes it.
Do not silently resolve the existing currency mismatch between homepage copy and plan cards.
Record pricing or promotion changes as a business decision.

## Quiet Infrastructure homepage contract (2026-08-14)

The Home surface remains `Persuade`, but its job is intentionally quiet: explain the machine, make plan fit easy to judge, and move the selected plan to secure WHMCS checkout without theatre.

### Dated reference synthesis

The following live references were reviewed on 2026-08-14 for conversion structure, pacing, and product-family clarity. They are not visual templates:

- Cloudzy — https://cloudzy.com — clear proposition, whitespace, one primary action, and restrained dark atmosphere. We keep the hierarchy and omit the star field, copy, and identity.
- Latitude.sh — https://latitude.sh — premium type scale, negative space, and one hero object. We keep the restraint and omit its layout, imagery, and brand language.
- Render — https://render.com — light canvas, readable headline, simple action pair, and product-led proof. We keep the calm canvas and omit its product screenshots and composition.
- Kinsta — https://kinsta.com — off-white calm, strong proof, and a direct CTA. We keep the pacing and omit the editorial style, claims, and imagery.
- Hetzner Cloud — https://hetzner.com/cloud — practical plan clarity and useful infrastructure explanation. We keep the comparison discipline and omit its identity and illustrations.
- Kamatera — https://kamatera.com — small set of feature proofs around a direct proposition. We keep the proof count and use only verified StealthRDP facts.
- UpCloud — https://upcloud.com — product-family clarity and restrained section rhythm. We keep the grouping principle and omit its visual system.
- Scaleway — https://scaleway.com — infrastructure-specific product grouping. We keep the product-first reading path and omit its copy, assets, and brand treatment.
- Cherry Servers — https://cherryservers.com — direct server categories and operational clarity. We keep the plainness and omit its layout and claims.
- DigitalOcean — https://digitalocean.com — accessible product grouping and clear getting-started flow. We keep the task-first conversion path and omit its identity.
- Runpod — https://runpod.io — workload-led product framing. We keep the intent-to-fit relationship and omit its imagery, language, and visual energy.
- Vultr — https://vultr.com — compact product choice and infrastructure specificity. We keep the directness and omit its layout and claims.

### Composition and interaction contract

1. **Direct opening** — “Your own Windows or Linux VPS.” One supporting sentence, one primary WHMCS CTA, one secondary text link, and one original local server/workspace visual. No annotations, fake terminal, live console, or status dashboard.
2. **Verified proof row** — exactly three facts: Windows + Linux VPS, NVMe storage, and full admin / root access. No fabricated numbers, customer counts, uptime, or urgency on the Home surface.
3. **Decision-led pricing** — “Start with the right machine.” Keep four real USA plan choices in a horizontal rail and a selected-plan summary. The workload control is compact and optional; every plan selection updates the existing `desk-plan-choice`, `desk-intents`, `desk-plan-choices`, `selectorCta`, `deskTopCta`, and `closePurchaseLink` path to a real `https://dash.stealthrdp.com` URL.
4. **Capabilities** — three calm columns: remote desktop, services and hosting, development and automation. Use verified product language, not generic feature bento cards.
5. **Operating path** — one quiet three-step line: choose, check, continue. WHMCS owns checkout, billing, and account access.
6. **Proof/support** — three links only: public status, native docs, and pre-sales support. Status data stays on `/status.html`; the Home surface has no monitoring table.
7. **Final handoff** — one deep navy band showing the selected plan and one button. No duplicate action grid.

### Material and responsive rules

- Home uses a soft cloud-gray canvas, deep navy selected-plan/final surfaces, and one restrained gold accent.
- Hide the shared status ticker on Home; retain it on other public pages.
- Keep the header light and calm. Reduce decorative micro-labels by at least 60% versus the rejected preview.
- Avoid beige editorial styling, gold shadows, grid wallpaper, dense borders, nested cards, pills, fake metrics, testimonials, dashboard theatre, and generic SaaS bento grids.
- On mobile, preserve the order text → visual → proof → plan rail, use comfortable controls, stack the three intent choices, and prevent horizontal overflow.
- Respect visible focus, reduced motion, and semantic landmarks.

The Home surface is not WHMCS or VirtFusion. It explains the product and hands off clearly; WHMCS remains the source of truth for checkout, billing, login, support, pricing, and availability.

WHMCS layout remains unchanged.
VirtFusion layout remains unchanged.
Only permitted colour overrides, labels, and links may change there.
The public site must make external transitions clear without pretending the systems are identical.

## Accessibility and responsive contract

Use semantic landmarks and accessible names.
Keep visible `:focus-visible` styles.
Do not use colour as the only status signal.
Respect reduced motion.
Keep controls at comfortable mobile sizes.
Prevent unintended horizontal overflow.
Test long article titles, long code lines, missing live data, empty results, and failed status calls.

## Research record

Selected references were accessed on 2026-08-13 and 2026-08-14:

- FlashRDP: https://flashrdp.com/ — use the tangible remote-workspace artifact and early plan decision; do not copy its claims, brand, or visual identity.
- RDP.sh: https://rdp.sh/ — use the cinematic hero rhythm, attached price/deploy dock, and infrastructure section pacing; do not copy its imagery, layout, or claims.
- StealthRDP current site: https://www.stealthrdp.com/
- StealthRDP proposed public design: https://stealthrdp.antah.de/
- DigitalOcean Droplet getting started: https://docs.digitalocean.com/products/droplets/getting-started/
- Hetzner server creation guide: https://docs.hetzner.com/cloud/servers/getting-started/creating-a-server/
- Vultr documentation index: https://docs.vultr.com/
- Statuspage API and incident model: https://developer.statuspage.io/

### Translation into StealthRDP

- DigitalOcean: keep a task-first quickstart path; do not copy its branding or layout.
- Hetzner: expose prerequisites, destructive consequences, and the next connection step.
- Vultr: organise the index by product task and surface search before browsing depth.
- Statuspage: separate current component state from incident updates and history.

## Review gate

A change is not complete until:

- The real repository and build path were exercised.
- The relevant source data is verified.
- Objective checks pass.
- Desktop and mobile browser evidence exists, or the gap is stated.
- Visual review confirms product specificity and restrained use of the control-room motif.
- No Chatwoot documentation link remains in the public site.
- No fabricated live proof or fake urgency remains.
