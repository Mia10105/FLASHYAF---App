---
name: Firebase Cloud Functions deploys from Replit
description: Why npm lock files generated inside Replit break external CI/Cloud Build, and how to deploy Firebase functions from this workspace
---

# Rule
Any `package-lock.json` generated inside Replit has `resolved` URLs pointing to `http://package-firewall.replit.local/npm/` (forced via `NPM_CONFIG_REGISTRY`, cannot be overridden even with clean cache + env overrides). External builders (Google Cloud Build for Firebase Functions gen2) cannot reach that host, so `npm install` crashes ("npm error Exit handler never called!") — yet the buildpack marks the build SUCCESS and ships a container with no node_modules, causing "Cannot find module" crashes at startup and Cloud Run health-check failures.

**Why:** Hit on FLASHYAF's `functions/` deploy (July 2026); three redeploys + cache purges failed until the lock URLs were rewritten.

**How to apply:** Before any external deploy that runs `npm ci/install` from a Replit-generated lock file, rewrite hosts: `sed -i 's|http://package-firewall.replit.local/npm/|https://registry.npmjs.org/|g' package-lock.json` (integrity sha512 hashes stay valid). Also note: GCF buildpacks cache a poisoned `npm_modules` layer after a failed install — delete the `<function>/cache` package in the `gcf-artifacts` Artifact Registry repo to force a clean rebuild. Firebase CLI auth lives in `.config/configstore/firebase-tools.json`; the CLI skips deploys when source is unchanged, so bump a comment to force rebuild.

# Related facts
- Root `functions/` folder is NOT a pnpm workspace package (not in workspace globs) — it never affects `pnpm run build` or Replit publishing.
- Publish build for flashyaf = `vite build` only (no typecheck), so TS errors don't block publish but syntax errors do.
