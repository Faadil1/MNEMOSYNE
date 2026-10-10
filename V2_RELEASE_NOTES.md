# MNEMOSYNE V2 — Implemented repair and evidence report
Date: 2026-10-09
Baseline: supplied OKComputer_Day_21_Creative_Autonomy.zip (contains Day 22 MNEMOSYNE code). Original baseline remains unchanged.

## Changes implemented in source
- P0 pointer care deactivates on leave, cancel, blur, hidden; stopped long-press timer on blur.
- P0 versioned exact-state persistence including released, faded, individual letter states and timestamps; V1 average-only migration truthful.
- P0 readable journal with keyboard tending and deliberate release, confirmation, ten-second undo.
- P1 adaptive 1/2/4/9 responsive geometry for the active plots; persistent ghosts in archive.
- P1 Unicode grapheme handling with declared 42-petal limit, no silent cut.
- P1 explicit time-away rule: no background decay or offline catchup.
- P1 consent-by-default sound, throttled tend sound and wind parameter scheduling.
- P1 privacy messaging, export and confirmed deletion.
- P2 product README and a reproducible offline regression suite.

## Local evidence
- `tsc --strict --noEmit --noUnusedLocals --noUnusedParameters` on engine, layout, renderer, audio and storage: PASSED.
- `bash tests/run-engine-check.sh`: 8/8 PASSED for Unicode, reproducible petals, released persistence, faded persistence, intentional care, geometry at 320x568/320x844/390x844/768x1024/1440x900 with 1/2/4/9 flowers, old save migration, reset.
- `npm ci` FAILED: registry.npmjs.org returned `EAI_AGAIN` for `kimi-plugin-inspect-react`; therefore full React/Vite build, lint, runtime, mobile and WebAudio verification are BLOCKED, not claimed.
- An independent Chromium visual screenshot attempt was blocked by the local browser runtime (timeout). It is not used as evidence of browser behavior.

## Outstanding gates before public promotion
- Real React+Vite build and lint.
- Browser flow 0→1→2→9 plants; release/undo, reload before/after release, fullscreen/mobile, touch/pointer/multi-touch.
- VoiceOver/NVDA: keyboard journal, modal focus trap, screen-reader updates. Reduced-motion in an actual browser.
- iOS WebAudio, sound toggle, suspend/resume and performance.
- Validate actual visual expression: 9-flower overlap including sway and focus header/footer across screen sizes.
- External comprehension tests: user recognizes plant, tend, release without instruction.
- Full deployment + hash binding. No GitHub push, PR, version-card replacement or production changes were performed.

## Operational constraints
- Browser-local only. Save is plain text and not guaranteed durable.
- Release undo is a 10-second in-session action. Reload preserves the released state; undo timer is not preserved.
- No backend, social sharing, or shared wind in this version. Any later shared wind requires separate consent, policy and abuse-design review.
