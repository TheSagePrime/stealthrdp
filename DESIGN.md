# StealthRDP Web Design Contract

Status: active working contract
Owner: Sage Prime
Implementation owner: Suho / #Builder
Last reviewed: 2026-08-13

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

Use a dark control-room foundation with a restrained electric-gold deployment signal.
Use green only for healthy or online states.
Use orange for warnings, maintenance, and service risk.
Use red for severe failure or destructive actions.
Use neutral gray for unknown or unavailable data.
Use blue only when a future external-system bridge needs a neutral action relationship.

Use Space Grotesk for display hierarchy.
Use Inter for reading and interface text.
Use JetBrains Mono for commands, technical values, timestamps, and status labels.
Keep the type system limited to these self-hosted families.

Use charcoal surfaces, thin borders, deliberate shared edges, and modest radius values.
Use gradients only when they reinforce depth or a state.
Do not use purple-blue gradient chrome, glass orbs, neon decoration, or generic SaaS blobs.
Do not nest cards without a clear information relationship.

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

## Homepage composition decision (2026-08-14)

The Home surface remains `Persuade`, but the homepage is an authored **Stealth Workspace**: an image-led infrastructure artifact makes the product tangible, then an attached decision dock turns that interest into a grounded plan choice.

1. **Artifact-led opening** — a local original SVG shows a remote workspace connected to Windows, Linux, and storage layers. It is explicitly labelled as a concept illustration; it is not live monitoring or fake provisioning.
2. **Attached decision dock** — workload intent → recommended fit → manual plan choice → persistent selection summary → WHMCS handoff. The selector is visually attached to the artifact rather than rendered as a separate dark form panel beside copy.
3. **Concise proposition** — the first viewport prioritises one high-impact proposition, one primary checkout action, a clear secondary route, and a small boundary note.
4. **Proof after fit** — public status, native docs, checkout ownership, and support boundaries appear as evidence for the decision. No fake deployment state, scarcity, testimonial, or invented metric is introduced.
5. **Material system** — the homepage uses a dark navy/graphite shell, deliberate blue-gray depth, a restrained gold deployment signal, and green only for healthy state semantics. It avoids beige editorial styling, generic SaaS cards, glassmorphism, neon decoration, and faux terminal theatre.

The homepage intentionally does not render the former customer-story/testimonial section. Existing product claims remain in the rest of the site and approved SEO metadata; no new customers, uptime, locations, testimonials, prices, or guarantees were introduced.


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

Selected references were accessed on 2026-08-13:

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
