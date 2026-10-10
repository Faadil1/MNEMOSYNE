# Cloudflare Pages — MNEMOSYNE V2 preview

Status: **NOT DEPLOYED**. This document prepares a Git-integrated preview; it does not assert Cloudflare access or a successful runtime.

## Target and constraints

- Source repository: `Faadil1/MNEMOSYNE`
- Tested commit prior to Cloudflare setup: `86bd2aea82a7333e176993e593dbef1e6ffdb7e2` (GitHub Actions passed)
- Candidate branch: `build/mnemosyne-v2-reliability` (Draft PR #1)
- Keep `main` unchanged. At present, `main` contains only a README and is **not deployable** as the React application.
- Preview is public and separate from the eventual production site. Browser memories remain in unencrypted, browser-local `localStorage`.

## Cloudflare dashboard setup — Git integration, no API token

1. Open Cloudflare Dashboard → **Workers & Pages** → **Create application** → **Pages** → **Import an existing Git repository**.
2. Authorize the Cloudflare GitHub app for `Faadil1/MNEMOSYNE` if needed. Select the repository.
3. Create a **separate temporary preview project**, suggested name `mnemosyne-day22-preview` (subject to availability).
4. For this dedicated preview-only Pages project, select **Production branch** = `build/mnemosyne-v2-reliability`. This means Cloudflare's primary URL for *this isolated preview project* serves the candidate branch; it is **not** a merge to GitHub `main` and is not an approved production release.
5. Set framework **React (Vite)**, build command `npm run build`, build output directory `dist`, root `/` (repository root). Use Pages **build system v3**, Node.js 22; if the image is older, set environment variable `NODE_VERSION=22`.
6. Click **Save and Deploy**. Obtain the exact deployment URL and check that it resolves and runs.
7. Do **not** add Cloudflare access tokens to the Git repository or commit secrets. Git integration is sufficient.

If Cloudflare automatically selects `main`, change the production branch to the V2 candidate **before triggering the first build**. A build from `main` will fail until application code has been reviewed and merged. An alternative long-term setup is a production project tracking `main` with preview deployments for nonproduction branches, but it cannot currently build the README-only `main` branch.

## Browser audit / release gate

- Desktop 1440×900, mobile 390×844 and 320 px: no overflow, nine flowers in responsive rows, readable controls.
- Plant one memory; tend by pointer, touch, and journal keyboard button; care must stop after pointerleave, cancel, window blur and hidden tab.
- Release one bloom by long-press; undo within 10 seconds; after expiry, reload and verify memorial remains.
- Let a bloom erode to fading and reload; ensure it does not respawn.
- Reload and return after closing browser; confirm deliberate no-offline-decay rule.
- Test grapheme input, 42-grapheme guard, empty message handling, export, clear and V1 migration.
- Test mute/audio unlock and Safari limitations, reduced-motion, keyboard-only and screen reader announcements.
- Compare the deployed revision to a known Git commit SHA and attach screenshots, failures and fixes to PR #1.

No promotion until these observed tests pass. `LOCAL`/CI verification is not `LIVE` evidence.

## References

- https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/
- https://developers.cloudflare.com/pages/configuration/git-integration/
- https://developers.cloudflare.com/pages/configuration/build-configuration/
