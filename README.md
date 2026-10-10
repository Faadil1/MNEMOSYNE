# MNEMOSYNE — Day 22 / V2

A private garden of memories. A sentence becomes a flower of living type. Nearness is care; time brings entropy; letting go is a choice. The application runs on React, TypeScript, Vite, Canvas 2D and synthesized WebAudio. No backend and no sound/image assets are required.

## Develop

```bash
npm ci
npm run dev
npm run build
npm run lint
npm run test:engine
```

Requirements: Node.js 20+ and normal access to npm. `tests/run-engine-check.sh` uses the `tsc` CLI (installed by `npm ci`). The simulation test suite can run offline when TypeScript is already available globally.

## What changed since V1

- Exact state is persisted in `mnemosyne.garden.v2`: petals, detached/gone state, released/faded memorials, positions, birth time and stable random seeds. A V1 record is migrated **as accurately as V1 permits**; individual letters lost in V1 cannot be reconstructed because V1 kept only average vitality.
- Intentional pointer care ends on leaving/cancel/blur/hidden tab. Touch tends while held; journal buttons provide keyboard care.
- Long-press release requires 1,200ms without moving >15px, displays an anchored progress ring, can be undone for 10 seconds. Alternatively use the journal's explicit release dialog.
- Nine flowers are laid out on an adaptive grid; the previous impossible single-row spacing is gone.
- `Intl.Segmenter` counts full Unicode graphemes. The UI declares a maximum of 42 visible petals before planting. It does not silently truncate.
- Time spent away **does not** erode memories. Returning is a welcome, never a penalty. While the tab is visible, decay remains an ambient metaphor.
- The journal contains keyboard-operable actions, private JSON export, and confirmed total erasure. No automatic uploads or shared wind.
- Audio is off until the user enables it; tending and wind changes are rate-limited.

## Privacy and meaning

All memory text is stored unencrypted in this browser's `localStorage`, not in a cloud account. Other people with access to the same browser profile could inspect it. Browser storage can be cleared or unavailable (private mode, policies, quota). Export a JSON backup if your memories matter to you. Exported JSON also contains the memories in plaintext.

Released and faded memories are retained as readable journal entries and as visual memorials while displayed. They do not consume the nine growing places. The app contains no community-sharing, authentication or sync.

## Evidence boundary

- `npm run test:engine` validates deterministic geometry, persistence, old-save migration, grapheme handling and offline engine behavior.
- Browser runtime, mobile touch, real WebAudio, screen reader navigation and production deployment MUST be verified separately after dependency installation. An offline test does not prove those integrations.
- The attached `../V2_RELEASE_NOTES.md` describes exact validations and remaining gates.

## Release criteria

`npm ci`, `npm run build`, `npm run lint`, desktop and mobile journeys (especially 320/390px), keyboard/VoiceOver, reduced-motion, back/forward and actual localStorage migration. Record a deployment URL plus revision before promoting a public claim.
