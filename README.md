# LexExtract Web

Shared, hosted version of LexExtract. Everyone on the team signs in with one passcode,
works on the same live data, and every edit is stamped with the editor's name.

## What's here

```
netlify.toml              Netlify config (publish dir + functions)
package.json              One dependency: @netlify/blobs
netlify/functions/api.mjs Serverless API: passcode check, shared state, Claude proxy
public/index.html         The whole app
```

Nothing is bundled or compiled on your machine — Netlify builds the function on deploy.

## One-time setup

1. **Create a GitHub repo** and push these files. (Drag-and-drop deploys will not work:
   the function needs Netlify to install `@netlify/blobs`.)
2. In Netlify: **Add new site → Import an existing project**, pick the repo, accept the
   detected settings (publish `public`, functions `netlify/functions`), deploy.
3. **Project configuration → Environment variables**, add:
   - `TEAM_PASSCODE` — the shared passcode you give the team. That is the only one needed;
     there is no API key, because extraction happens in LexExtract Studio, not here.
4. **Trigger a redeploy** so the new variables are picked up (Deploys → Trigger deploy).
5. Open the site, sign in, and either import your firms workbook or restore a JSON backup
   from the artifact version (Data → Restore from backup).

Optional but recommended: **Domain management** → rename the site to something memorable,
then pin it as a tab in your Teams channel.

## The two halves

**LexExtract Studio** (a Claude artifact, run by you and your co-drafter) does extraction,
Solomonic reconciliation, review and email drafting — the steps that need the Claude API,
which is free inside Claude. It produces a *cycle package* (a JSON file).

**This site** owns the leads. Import the cycle package and the whole team works on the
same live data: claiming leads, logging outreach, reading email drafts, reporting.

Each cycle: sync Studio from a site backup → extract and publish → generate email drafts →
export the cycle package → import it here.

## How it works day to day

- **Sign in**: passcode plus your name. The name is stored in your browser and stamped on
  every edit you make. It is an honour system — there are no individual accounts.
- **Saving**: automatic. Structural changes (extraction, publishing, firms) save the whole
  document with a version check; if someone else saved first you are shown their version
  and asked to re-apply. Lead edits (outreach, status, result, notes, claiming) are applied
  field-by-field on the server, so two people logging different leads never clobber each
  other. The sidebar shows the current version number.
- **Refreshing**: the app polls for other people's changes every 25 seconds while you are
  idle, and there is a manual "Refresh from server" button in Data.
- **Claiming**: any unassigned lead shows "Claim this lead for <your name>" — one click,
  no approval step.

## Backups

Data → "Download backup (JSON)". Take one before each cycle and keep it on SharePoint.
"Restore from backup" overwrites the shared data for everyone, so use it deliberately.

## Costs and limits

- Netlify: functions and Blobs are included on the free tier at this volume.
- No Anthropic API billing: extraction and email drafting run inside Claude in Studio.
- The passcode is a shared secret in an environment variable. Anyone with the passcode can
  edit everything, including deleting leads. There are no per-person permissions.

## If something breaks

- "TEAM_PASSCODE is not set" — the environment variable is missing, or the site has not
  been redeployed since it was added.
- Import says "not a valid cycle package" — you exported the wrong file. The package is
  produced by Studio under Data → Export cycle package.
- Everything else: take a backup first, then check the Netlify function logs
  (Logs & metrics → Functions).
