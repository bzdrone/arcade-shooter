# Preparing a preview release

The project PNG belongs in a versioned GitHub Release. GitHub Pages is optional future documentation hosting, not required for this milestone.

**Current proposed version:** `v0.1.0-preview.1`. It is a prerelease/learner-test candidate, not a validated lesson. No remote repository, tag, or release has been created by these preparation steps.

## Prepare locally

From the repository root:

```sh
node tools/prepare-release.cjs
```

This dependency-free Node helper stages the candidate under ignored `local/releases/v0.1.0-preview.1/`. It:

- Checks packaged source against the known tested game commit (`a422488`). Documentation/tooling may change; game source/assets may not.
- Checks the original PNG's signature, byte count and pinned SHA-256, plus matching local/hosted import evidence. This reuses previous validation; it does not rerun Arcade or independently decode the PNG.
- Copies the original PNG bytes, introduction, weapon activity and license; generates file checksums and a provenance manifest; stages the release notes separately.
- Does not install, commit, create a tag/repository, push, or publish anything.

The candidate descriptor is `releases/v0.1.0-preview.1.json`; release notes are `releases/v0.1.0-preview.1.md`. Do not change the pinned checksum to bypass a validation failure. A changed game requires compilation/tests, fresh PNG export/import validation, and a reviewed candidate descriptor. See VALIDATION.md.

## Before GitHub publication

1. **Confirm the destination repository and visibility with the owner.** No Git remote is currently configured. A private repository's releases are not publicly downloadable; choose access intentionally.
2. Review the staged notes and handouts. `INTRO.md` references the activity by filename so it works as a separate release download. Handouts are not embedded in the PNG.
3. Obtain approval to commit the preparation changes. Tag the resulting clean commit, which includes the game, handouts, notes and preparation tool—not only the earlier gameplay commit.
4. Rerun preparation after that commit; verify `workingTreeDirty` is false and `preparedFromCommit` is the intended tag target in `release-manifest.json`. Check `SHA256SUMS` from inside the staged directory (`sha256sum -c SHA256SUMS` in Bash).
5. Obtain approval to configure/create the destination and push the reviewed commit/tag. Do not assume permission to publish from permission to prepare locally.
6. On GitHub, create a **draft prerelease** for proposed tag `v0.1.0-preview.1`, targeting the reviewed preparation commit. Use the prepared release notes as the body and attach exactly:
   - `arcade-shooter.png`
   - `INTRO.md`
   - `01-weapon-tuning.md`
   - `LICENSE`
   - `SHA256SUMS`
   - `release-manifest.json`
7. Review the draft. Make clear that learners download the PNG, not GitHub's automatic source archives. Obtain final publication approval before making it available.
8. After publication, download the PNG from the release assets and confirm its checksum matches the validated candidate. Record the release URL/tag in PLAN.md. Do not substitute an image preview or re-encoded copy.

GitHub CLI is available locally, but no `gh` publication or repository-creation command is part of the preparation helper. The GitHub web UI is equally suitable once the destination and permissions are agreed.

## Scope and limits

The first release needs no website, new packages, MakeCode share link, or embedded public simulator. Those would be separate decisions. Keep the tested PNG intact, retain separate handouts, and wait for an actual learner before claiming learning effectiveness.
