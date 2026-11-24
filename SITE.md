# Converter website

The Arcade repository owns the converter, its tests, and its static-site artifact. The prepared deployment target is GitHub Pages; the same artifact can be served by another static host without rebuilding for a particular domain or base path. No backend, credentials, or Arcade toolchain is required to build it. Nothing is uploaded when a creator converts a PNG.

## Build and preview

With Node.js 24:

```sh
node --test tests/site-build.test.mjs
node tools/build-site.mjs
python -m http.server 8000 --bind 127.0.0.1 --directory local/site
```

Open `http://localhost:8000/`. The Python server is an optional preview tool, not a build dependency. Do not open the HTML using `file://`: browser modules need HTTP.

`local/site/` is an ignored, disposable output directory, cleaned by each build. It contains only the page, styles, browser modules, the Portal runtime source needed by conversion, and `.nojekyll`. Do not put hand-authored files there. No PNGs, local evidence, or repository documentation are packaged. Resource URLs are relative so the artifact also works under a project subpath.

For the real-browser check of the built artifact, using the existing sibling browser toolchain and a local exported PNG:

```sh
ARCADE_SITE_DIR=local/site node tests/portal-site.cjs
```

This serves the converter under `/arcade-shooter/`, checks desktop and phone conversion, and compares downloads with the command-line converter. See VALIDATION.md for prerequisites.

## GitHub Pages deployment

`.github/workflows/pages.yml` is manual-only (`workflow_dispatch`); it does not deploy on push or pull request. Its build job checks packaging and uploads only `local/site/`. Its separate deployment job has Pages/OIDC permissions and uses the `github-pages` environment. It does not use AWS or the separate hosting project's deployment pipeline.

The live converter is [Arcade to Portal](https://bzdrone.github.io/arcade-shooter/). Pages uses the GitHub Actions source with HTTPS enforced. The `github-pages` environment restricts deployment to the `main` branch. No required-reviewer gate is configured; manual workflow dispatch is the publication step, not an additional approval gate. The hosted page has passed desktop and phone conversion checks using a compound gun-game PNG, with output matching command-line conversion using the deployed runtime bytes.

For future changes, obtain explicit commit/push/publication approval before deploying:

1. Commit and push the reviewed changes to the default branch.
2. In the repository's **Settings → Pages**, choose **GitHub Actions** as the build/deployment source.
3. Configure the `github-pages` environment to restrict deployment to the default branch and, where supported, require approval.
4. In **Actions**, manually run **Deploy converter to GitHub Pages** from the approved default-branch revision. This publishes the artifact; it is not a preview-only build.
5. Use the URL reported by the deployment, check conversion there, then link the verified URL from README.md and INTRO.md.

The site is experimental: a focused live Portal playtest confirmed compound gun-game weapon progression and readable scores. Respawn persistence, the final knife-elimination win, and broader Builder instructions remain unverified. Packaging checks and browser conversion tests do not prove that generated files work in Portal. No custom domain or DNS changes are needed for the default Pages URL.
