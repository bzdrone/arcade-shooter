# Preparing a preview release

The project PNG belongs in a versioned GitHub Release. The separately hosted GitHub Pages converter is linked from the introduction; it is not an attached release asset or required for importing and playing the PNG in Arcade.

The creator download list is deliberately small: **arcade-shooter.png** and **INTRO.md** only. The introduction links to optional activities online. Do not attach lesson files, a separate license, checksums, or build records; keep the license in the repository and supporting records locally. GitHub also adds source-code archives automatically; release notes should tell creators to ignore those.

Each release has a descriptor and notes under `releases/<version>.json` and `releases/<version>.md`. The descriptor pins the tested game commit, the PNG's byte count and SHA-256, and handouts to retain in local preparation records (asset name → repository path). Historical release notes describe their original attachments; new release notes must list only the two creator downloads. Preview releases are creator-test candidates, not validated lessons.

## Prepare locally

From the repository root:

```sh
node tools/prepare-release.cjs <version>
```

This dependency-free Node helper stages the candidate under ignored `local/releases/<version>/`. It:

- Checks packaged source against the descriptor's tested game commit. Documentation/tooling may change; game source/assets may not.
- Checks the original PNG's signature, byte count and pinned SHA-256, plus matching local/hosted import evidence. This reuses previous validation; it does not rerun Arcade or independently decode the PNG.
- Stages only the original PNG and `INTRO.md` for upload, alongside release notes to use as the release body.
- Retains the complete PNG, handouts, license, checksums, and provenance manifest under ignored `local/releases/<version>-evidence/`, separate from upload candidates.
- Rejects extra files left in an old upload-staging directory; move that directory aside before rerunning rather than uploading leftovers.
- Does not install, commit, create a tag/repository, push, or publish anything.

Do not change the pinned checksum to bypass a validation failure. A changed game requires compilation/tests, fresh PNG export/import validation, and a reviewed candidate descriptor. See VALIDATION.md.

## Before GitHub publication

1. **Confirm the destination repository and visibility with the owner.** The project is published at `origin` (public). A private repository's releases are not publicly downloadable; choose access intentionally.
2. Review the staged notes and introduction. Check that `INTRO.md` links to the optional activities and license online, and that those pages are available to creators. Handouts are not embedded in the PNG.
3. Obtain approval to commit the preparation changes. Tag the resulting clean commit, which includes the game, handouts, notes and preparation tool, not only the tested gameplay commit.
4. Rerun preparation after that commit; verify `workingTreeDirty` is false and `preparedFromCommit` is the intended tag target in the evidence directory's `release-manifest.json`. Check `SHA256SUMS` from inside that evidence directory (`sha256sum -c SHA256SUMS` in Bash). Confirm the staged PNG and introduction match their evidence copies.
5. Obtain approval to configure/create the destination and push the reviewed commit/tag. Do not assume permission to publish from permission to prepare locally.
6. On GitHub, create a **draft prerelease** for the version's tag, targeting the reviewed preparation commit. Use the prepared release notes as the body and attach only **arcade-shooter.png** and **INTRO.md**. Do not attach `release-notes.md` or anything from the evidence directory.
7. Review the draft. Make clear that creators download the PNG, not GitHub's automatic source archives. Obtain final publication approval before making it available.
8. After publication, download the PNG from the release assets and confirm its checksum matches the validated candidate. Record the release URL/tag in PLAN.md. Do not substitute an image preview or re-encoded copy.

GitHub CLI is available locally, but no `gh` publication or repository-creation command is part of the preparation helper. The GitHub web UI is equally suitable once the destination and permissions are agreed.

## Scope and limits

A release needs no website, new packages, MakeCode share link, or embedded public simulator. Those would be separate decisions. Keep the tested PNG intact, retain separate handouts, and wait for an actual creator before claiming learning effectiveness.
