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
Keep currency tied to the plan location in visible pricing and structured data.
Record pricing or promotion changes as a business decision.

## Warm Instrument / C homepage contract (2026-08-14)

The Home surface remains `Persuade`. Its job is to explain the private machine, make plan fit easy to judge, and hand the selected plan to secure WHMCS checkout.

The approved visual direction is **Warm Instrument / C**: dark control-room surfaces with warm gold action states, an optional calm light theme, large asymmetrical type, original operating-system marks, and restrained motion. The page must remain compact and product-specific.

### Composition and interaction contract

1. **Direct opening** — “Make room for the work.” Keep one supporting sentence, one primary plan action, one secondary explanation link, and one honest local deployment demonstration. The console must say that it is a demonstration and that it provisions nothing.
2. **Verified proof row** — show Windows + Linux, NVMe storage, full admin rights, and unlimited bandwidth only when those facts match the selected product data.
3. **Decision-led pricing** — show all six real USA plan choices and a selected-plan summary. Each selection updates the baked price, resources, visual bars, badge, and real WHMCS URL.
4. **Operating path** — keep the three-step choose, checkout, and connect journey. WHMCS owns checkout, billing, account access, pricing confirmation, and availability confirmation.
5. **Capabilities** — explain why a private machine helps with remote work, automation, and control. Use concrete StealthRDP language, not generic feature bento cards.
6. **Operating systems** — use verbatim open-source library assets. Devicon supplies Windows Server, Ubuntu, Debian, CentOS, Rocky Linux, AlmaLinux, and Fedora. theSVG supplies FreeBSD and Alpine Linux. Do not hand-assemble brand paths or add wrapper backgrounds.
7. **FAQ and status** — keep the two-column FAQ, native `details` controls, and fail-closed status card. Orange indicates an incident only. Unavailable status remains neutral.
8. **Reviews** — keep the compact OneUptime-style marquee and human-voiced review cards. Duplicate cards may support the visual loop, but clones must stay out of the accessibility tree.
9. **Final handoff** — use one closing CTA that returns to the selected machine list. Do not add duplicate checkout surfaces.

### Material, responsive, and motion rules

- Home uses the approved navy, surface, text, gold, and green tokens. Light mode uses contrast-tested token values.
- Keep the shared status ticker off Home. Retain it on other public pages.
- Keep the header calm and the copy direct. Use the keyword context “Windows and Linux VPS hosting in the USA” in metadata and supporting copy.
- Use self-hosted fonts and SVG assets. Do not add runtime asset CDNs.
- Keep section rhythm compact. Prefer one strong explanation over repeated claims.
- Use scroll reveal, plan-change feedback, console sequencing, and the review marquee only when they improve orientation. Disable non-essential motion under `prefers-reduced-motion`.
- On mobile, preserve the order text → visual → proof → plans. Keep controls at comfortable touch sizes and prevent horizontal overflow.
- Respect visible focus, semantic landmarks, accessible names, and neutral unavailable states.

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
