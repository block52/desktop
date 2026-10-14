# Going public: runbook

Do these in order. Everything here is done in the GitHub web UI or with `gh` by the repository owner; none of it
needs a code change except step 7 (optional).

Time needed: about 45 minutes, plus one release build.

## 0. Before you start

- [ ] Decide the Alchemy key question (restrict it in the Alchemy dashboard, or deploy `tools/nft-proxy` and set
      `VITE_PROFILE_NFT_INDEXER_URL` so no key ships in the app). The key is baked into each installer at build time, so settle
      this before the release you intend to publish.
- [ ] Make sure `main` here is the commit you want to publish: `git log --oneline -5`, and `yarn lint && yarn test`
      are green.
- [ ] Back up the current history: `git bundle create ~/poker-desktop-backup.bundle --all`.

## 1. Check the history for secrets and personal data

The history was rewritten once (author email replaced with the GitHub noreply address, personal paths removed).
Check again before it becomes world-readable:

```bash
# personal email and local paths must not appear anywhere in history
git log --all --format='%ae %ce' | sort -u
git log --all -p | grep -n -i -E '/Users/[a-z]+|@gmail\.com' | head

# secrets: any scanner works; gitleaks is one option
brew install gitleaks
gitleaks detect --source . --log-opts="--all"
```

Fix anything it finds with `git filter-repo` (not `filter-branch`) before going on, and rotate any credential that
was ever committed, even if you remove it from history.

## 2. Recreate the repository

A new repository drops the old private history, issues, PRs, draft releases and Actions logs, which is what you want.

1. Create the new repository under your account: **no** README, licence or `.gitignore` (the repo already has them).
   Choose **private** first; flip it to public in step 9.
2. Point your local clone at it and push only `main` and the tags you intend to keep:

   ```bash
   git remote rename origin old-origin
   git remote add origin git@github.com:<you>/<new-repo>.git
   git push -u origin main
   ```

   Push release tags only if the matching releases will exist; otherwise leave them out (`v1.0.3` etc. were built by
   the old repository's workflow).
3. Set a **noreply** commit identity so new commits don't expose your email:
   GitHub → Settings → Emails → *Keep my email addresses private* and *Block command line pushes that expose my
   email*, then `git config user.email "<id>+<user>@users.noreply.github.com"`.
4. Check the repository: Insights → Network shows only `main`; Code → no `.env`, no `*.bundle`, no `.reviews/`.

## 3. Repository settings

Settings → General:
- [ ] Features: turn off Wikis and Projects if unused; leave Issues on only if you will triage them.
- [ ] Pull requests: *Allow squash merging* only (optional), *Automatically delete head branches*.

Settings → Actions → General:
- [ ] Actions permissions: **Allow select actions**. Allow GitHub-created actions plus the exact third-party
      actions the workflows use (every one is pinned to a commit SHA).
- [ ] Workflow permissions: **Read repository contents** by default. Do not tick *Allow GitHub Actions to create
      and approve pull requests*. (Workflows that need more request it per job.)
- [ ] Fork pull request workflows: **Require approval for all outside collaborators**, and do not send secrets to
      fork PRs.

Settings → Code security:
- [ ] **Secret scanning**: on. **Push protection**: on.
- [ ] **Dependabot alerts** and **Dependabot security updates**: on (version updates come from
      `.github/dependabot.yml`).
- [ ] **Code scanning**: nothing to enable by hand; the CodeQL workflow starts running as soon as the repo is public
      (it is gated on `github.event.repository.private == false`).
- [ ] **Private vulnerability reporting**: on. `SECURITY.md` tells people to use it.

## 4. The `release` environment

Settings → Environments → **New environment** → `release`:
- [ ] Deployment branches and tags: **Selected branches and tags** → add `main` and the tag pattern `v*`.
- [ ] Required reviewers: add yourself (and a second person if you have one). Tick *Prevent self-review* only if
      there is another reviewer.
- [ ] Environment secret: `VITE_MAINNET_RPC_URL` (the Alchemy key, if you still ship one). Put it here, not as a
      repository secret, so only approved release runs can read it.

## 5. Repository variables

Settings → Secrets and variables → Actions → **Variables**. These end up inside every installer, so they are not
secret; leave a variable unset to use the app's default:

| Variable | Purpose |
|---|---|
| `VITE_PROJECT_ID` | WalletConnect / Reown project id |
| `VITE_INDEXER_URL` | Indexer (hands, players), default `https://indexer.block52.xyz` |
| `VITE_PAYMENT_PROXY_URL` | Crypto deposit payment proxy |
| `VITE_SNG_SCHEDULE_URL` | Sit & Go schedule JSON |
| `VITE_TREASURY_WALLET_ADDRESS` | Treasury address used for deposits |
| `VITE_PROFILE_NFT_INDEXER_URL` | NFT source template with `{owner}` and `{chainId}` (use instead of an Alchemy key) |

Add the secret `VITE_MAINNET_RPC_URL` **only** in the `release` environment (step 4).

## 6. Protect `main`

Settings → Rules → Rulesets → **New branch ruleset** → name `main`, enforcement **Active**, target `main`:
- [ ] Restrict deletions.
- [ ] Block force pushes.
- [ ] Require a pull request before merging (0 or 1 approval, as you prefer for a one-person repo).
- [ ] Require status checks to pass: `lint`, `typecheck`, `test`, `package`. (`audit` is informational and fails
      only on moderate and above.) The names only appear in the picker after CI has run once on the new repo.
- [ ] Require linear history (optional).

Bypass list: add yourself (Repository admin role), so you can still fix things in an emergency.

## 7. Let the release workflow commit to `main`

**Cut release** commits the version bump straight to `main` and pushes a tag. A ruleset that requires pull
requests blocks that push, and the default `GITHUB_TOKEN` of a workflow cannot be added to a bypass list. Pick one:

- **A. A token you own (simplest).**
  1. Create a fine-grained personal access token for this repository only, permission **Contents: Read and
     write**, expiry 90 days.
  2. Save it as the repository secret `RELEASE_PUSH_TOKEN`.
  3. In `.github/workflows/cut-release.yml`, give the checkout step `token: ${{ secrets.RELEASE_PUSH_TOKEN }}`
     (the later `git push` then uses it). Your account is in the ruleset's bypass list, so the push is allowed.
  4. Put a calendar reminder to rotate it.
- **B. Release through a pull request.** Change Cut release to push a `release/vX.Y.Z` branch and open a PR, then tag
  after you merge it. More steps per release, no long-lived token.
- **C. Leave `main` unprotected against admin pushes.** Not recommended for a public repo.

Ask for the workflow edit for A or B once you have decided.

## 8. Verify before flipping to public

- [ ] Open a throwaway PR: CI runs, a failing check blocks merge, a direct push to `main` is refused.
- [ ] Run **Actions → Cut release** (patch). Expect: the `release` environment asks for your approval, three
      installers build (macOS arm64, Windows, Linux), a **draft** release appears.
- [ ] Download each installer you can test. Check the app launches, the lock screen and Touch ID work, and a
      wallet can be created and imported.
- [ ] Delete the test release and tag if you don't want to keep it.
- [ ] Review the draft release notes. The installers are **not code-signed**, so say so in the notes.

## 9. Flip to public

Settings → General → Danger zone → **Change visibility** → Public.

Immediately after:
- [ ] Actions → **CodeQL** runs for the first time; check it completes and its alerts (Security → Code scanning).
- [ ] Security → Overview shows secret scanning and push protection as enabled.
- [ ] Add repository description, topics, and a link to the latest release.
- [ ] Publish the draft release when you are happy with it.

## 10. Afterwards

- [ ] Delete the old private repository (or archive it) once nothing references it.
- [ ] Update any links to the old repo (Block52 docs, the web app's download page).
- [ ] Rotate the Alchemy key if it ever lived in a public place.
- [ ] Optional: sign and notarize the installers (Apple Developer ID, Windows code-signing certificate).
