# Day 22 — V2 release gates

Source baseline: OKComputer Day 21 archive carrying Day 22 MNEMOSYNE, external version card `1f68b32`.
Project status: **V2 candidate / not yet publicly promoted**.

## Core product truth

- LOCAL engine (PROVEN): 8/8 isolated checks before GitHub migration; retest on CI.
- Browser Core Loop (BLOCKED): planting, tending, forgetting, 1,200ms long press, release, ten-second undo, reload, keyboard, real touch still need live operator evidence.
- Persistence (ACTIVE): only browser-local unencrypted localStorage; no guarantee across devices or browser clearing.
- Negative outcomes (ACTIVE): empty flower, full garden, malformed prior state, failed storage, absent Canvas context, permissions/privacy.
- Load-bearing external integration (N/A): no server, no account, no cloud sync, no shared wind.
- Privacy and consent (ACTIVE): sound opt-in, no transfer, deletion/export verification needed.
- Reduced motion / accessibility (ACTIVE): keyboard and real VoiceOver/NVDA checks outstanding.
- Runtime-commit binding (BLOCKED): no public deployment or commit-bound runtime receipts.
- Competitive Novelty / Product Depth / Visual Experience (ACTIVE): evaluate against adjacent living-poetry experiences with real users, not just code screenshots.
- Evidence Integrity: `LOCAL` for isolated tests, `NOT_IMPLEMENTED` for shared backend, `UNKNOWN` for live browser until observed.

## Before merge / promotion

1. Pass GitHub Actions for `npm ci`, `npm run test:engine`, `npm run build`, and `npm run lint`; fix source and lockfile together if necessary.
2. Test zero, one, two and nine memories on 320px/390px mobile, tablet and desktop; full keyboard and touch.
3. Verify exact remembered/released/faded states survive reload, old storage migration is conservative, no ghost care, undo window behaves correctly.
4. Verify WebAudio on iOS Safari, sound opt-in, reduced motion, 2D Canvas failure mode, safe areas, aria-live and focus trap.
5. Publish a separately named preview; record immutable commit SHA, URL, screenshots, limitations, and external comprehension feedback.
6. Review artistic quality and how returning to a quiet garden feels; only then promote production.

No new backend or shared-wind promise. Original version-card `1f68b32` remains distinct.
