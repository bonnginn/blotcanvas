# Source matching the published BlotCanvas beta

Status: source-only draft proposal for the published beta. The deployed application remains unchanged. A fresh locked source build is blocked: the Windows frozen-pnpm install stopped on EPERM realpath. Exact compiled-hotfix reconstruction is independently verified; it does not establish a fresh source build.

The published application is bonnginn/blotcanvas commit b5ad224cc786a0026984c3c22cdcd4f1dd4bd923. The development snapshot here is historical source commit 47fd77e7e0eedab07e0a6015ee77fb228c4ef78c, version 0.2.19-beta.1. It contains the same Safari Blob-download change as the deployed compiled helpers. Private Ver.1 and later Windows/Mac evaluation changes are outside this package.

Source provenance and exclusions are in SOURCE_PROVENANCE.json. All 75 included source files are exact Git blob bytes. Historical SOURCE_BASELINE.json is omitted because it contains a private source path. package-lock.json is omitted because its root dependency declarations are older than package.json; pnpm-lock.yaml matches every current source-manifest specifier and is the authoritative lock for this snapshot. Do not regenerate the lock or use an unlocked npm install.

## Inspect and build the developer source

The package requires Node >=22.13.0. Its 42 source tests were run with Node 24.19.0. The historical pnpm CLI version has not been independently recovered. A fresh verification attempt used Node 24.19.0 and pnpm 11.22.0 with the original pnpm lock and --frozen-lockfile, but installation stopped on Windows EPERM realpath in the scoped recovered-source directory. No alternate-path, ACL/owner change or dependency-overlay workaround was used. Fresh locked source build/type acceptance remains unverified. The byte-matching compiled postprocessor below was verified separately.

From development/:

    pnpm install --frozen-lockfile
    node --experimental-strip-types --test tests/condition-grid.test.ts tests/display-adjustment.test.ts tests/download-blob.test.ts tests/figure-label-regression.test.ts tests/figure-layout.test.ts tests/gel-geometry.test.ts tests/label-layout.test.ts tests/project-storage.test.ts tests/region-order.test.ts
    pnpm exec tsc --project tsconfig.app.json
    pnpm run github:build

The old package's default npm test/Vinext starter test is not the static application acceptance command. Full historical infrastructure typing was already incomplete in FIGURE_ONLY_RELEASE.md; do not present that legacy full type gate as newly passing.

## Reproduce the exact deployed asset

Deployment was assembled in stages: historical source 5ce73299bacc22f2c262120d2a64ac833934008b added the Figure-only layout; published CSS was retained and the scoped Figure-preview rules were appended to avoid unrelated Tailwind differences. The later b5ad224 deployment changed only the compiled save/saveBlob helpers, HTML entry reference and service-worker cache label. The corresponding developer-source Safari change is recorded in safari-source-fix.patch.

scripts/reproduce-safari-asset.mjs is a newly reconstructed reference postprocessor. It checks the full input SHA256, replaces one exact two-helper region and checks the full output SHA256. It does not accept a different or newer build and refuses to overwrite an output. It was verified to reproduce all 408,979 public JS bytes from the retained pre-Safari Figure asset. This is a compiled-asset reconstruction, not a claim that a fresh source build was completed today.

    node scripts/reproduce-safari-asset.mjs INPUT_index-figure-6a03436dc6cb.js NEW_OUTPUT_index-safari-save-b65c83b0e71c.js

Input SHA256: 6a03436dc6cb632f13757399ccafd86b6bc2e9a61ea82bf22b7cc5518536c72a
Output SHA256: b65c83b0e71c457e8c9c82313b2504e8affb18298b867399f5eb8e842118122b

Before publishing, rebuild the pre-Safari Figure source under its exact old lock, compare the expected JS chunks, reconstruct the retained-CSS append process, and compare HTML/SW/assets with b5ad224. The original historical release/verification scripts and their deployed-byte verification record are included in historical-safari-records/. They were read from separately authorized sibling tools/records, not from the denied OneDrive checkout. Do not run the historical mutator in a working checkout: it writes HTML/SW/assets relative to its old layout. The portable reference script above reproduces only the pinned JS asset in a new output. Do not quietly substitute a direct build of the private latest source or publish an unexplained generated CSS change.

## Publication boundary

The intended repository addition is a versioned source namespace; root application assets, entry HTML and SW remain byte-identical. The current main branch uses GitHub Pages' dynamic Jekyll source=. build, so even source/document additions cause a Pages deployment. Check the staged file whitelist and deploy behavior before applying it. Generated output, dependency directories, raw research data, credentials, historical private paths and later unpublished candidates must remain outside the public tree.

Existing LICENSE, THIRD_PARTY_NOTICES.md and public/fonts/OFL.txt are retained. Review exact runtime/transitive dependency notices before publication; package-lock.json is not a reliable runtime inventory for this snapshot. Native Safari/Windows file dialogs and a fresh source build remain unverified.
