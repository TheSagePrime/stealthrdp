# StealthRDP UX + Behavioral Design Specification

Status: preview implementation contract
Scope: visual hierarchy, information architecture, interaction and conversion behavior
Copy rule: do not rewrite existing marketing, SEO, pricing, legal or FAQ copy

## Product experience goal

StealthRDP must feel calm, credible and operational. The user should always understand:

1. What is being offered.
2. What choice is required now.
3. What happens after that choice.
4. Where supporting detail is available.

The interface must reduce cognitive load rather than expose every available fact at the same visual weight.

## Behavioral principles

### Hick's Law
Reduce the number of simultaneous choices. Show a small decision set first. Keep alternatives available without presenting all of them as equally important.

### Progressive disclosure
Primary purchase information is visible immediately. Technical and SEO reference material remains in server-rendered HTML but is visually staged one topic at a time.

### Von Restorff effect
Only one plan or action receives dominant visual emphasis in a decision group. Avoid multiple "recommended" surfaces.

### Fitts's Law
Primary actions must be easy to identify and hit. Small secondary controls must not compete with the primary CTA.

### Cognitive fluency
Use repeated layouts, familiar controls, short line lengths, clear grouping, restrained color and predictable navigation.

### Goal-gradient effect
The buying journey should feel sequential: environment -> region -> resources -> checkout. Progress is communicated through page position and active states, not fake completion percentages.

### Information scent
Navigation labels must come from the user's visible destination headings. The user should know what each interaction reveals before selecting it.

### Social proof placement
Customer proof belongs near evaluation and purchase decisions. Do not scatter proof randomly across unrelated sections.

## Ethical boundaries

Do not add:

- fake scarcity
- fake countdowns
- fake viewer or purchase counters
- deceptive defaults
- hidden costs
- forced continuity
- misleading urgency
- obstructive cancellation patterns

## Visual system

- Cobalt is the brand accent, not a decoration layer.
- Status colors remain semantic only.
- Use thin borders and restrained surfaces.
- Avoid generic glowing SaaS cards.
- Avoid large decorative gradients.
- Avoid card-per-paragraph layouts.
- Motion must communicate state change only.
- Respect reduced-motion preference.
- Use readable line lengths for long-form material.

## Page hierarchy

### Homepage

1. Hero: product + primary action.
2. Trust/proof strip.
3. Main buying/plan decision.
4. Infrastructure/product evidence.
5. Workloads/use cases.
6. Customer proof.
7. FAQ/objection handling.
8. Final CTA.

Only the hero and current decision zone should command high visual contrast.

### Windows VPS / Linux VPS

1. Product hero.
2. Plan decision.
3. OS/version decision.
4. Technical guide, one topic visually active at a time.
5. FAQ.
6. Final CTA.

All SEO/reference sections remain in HTML and keep their original text.

### Plans

- Reduce simultaneous comparison burden.
- Present a focused viewport of plans.
- Keep all plans accessible.
- One recommended plan only.
- Region and billing controls stay close to the plan set they change.

### Docs / Blog / FAQ / Status

- Docs: task navigation first.
- Blog: editorial hierarchy, not a uniform card wall.
- FAQ: objection categories and accordions, not 20+ answers simultaneously.
- Status: current state first, history second.

## Interaction rules

### Plan rail

- Show up to three plans in the main viewport on desktop.
- Preserve every plan in the DOM.
- Use previous/next controls and scroll snapping.
- Region filters continue to work.
- Gold receives the single visual priority state.

### Journey rail

- Build navigation from existing page headings.
- Keep it compact and sticky on desktop.
- Active state follows the section currently in view.
- On mobile it becomes a horizontal scrollable rail.

### Technical guide

- Keep every original section in the source HTML.
- Show one topic visually at a time.
- Topic labels are generated from existing h2 text.
- Direct URL hashes must activate the correct topic.

### FAQ

- Keep accordions collapsed by default except the first useful item.
- Opening one item closes peers in the same group.

## Success criteria

A new visitor should be able to answer these in seconds:

- What does StealthRDP sell?
- Which action should I take next?
- Which plan is the obvious default to inspect?
- How do I see more options?
- Where do I find technical details?

The page should feel easier as more content is added, not more crowded.
