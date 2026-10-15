# Figure-only public release — 2026-09-08

Requested scope: publish only the Figure layout improvement. Source base 2a6cf41; public base fc1219e. Main Windows development remains ad02b28 and is not deployed.

Baseline verification: rebuilding 2a6cf41 produces the same four JavaScript chunks as the public repository after normalizing line endings and asset filenames. Generated CSS differs in Tailwind output; therefore the published CSS bytes are preserved and only the Figure-preview rules are appended. Existing dependency assets, HTML metadata, analytics, documents and demos are preserved. Entry references and service-worker cache key are updated. Old assets remain for cached pages and rollback.

Only app/page.tsx Figure rendering/preview, app/label-layout.ts Figure-only option, app/figure-layout.ts and preview CSS were ported. No quantification, lane detection, storage schema or other workflow changes. Label spacing is shared by Figure exports; saved physical width and multi-gel horizontal export arrangement remain unchanged.

Validation: 39 tests, app typecheck and Vite production build pass. Full baseline typecheck still lacks the original Cloudflare worker/hosting declarations; no unrelated infrastructure port was performed. Anonymous 24-lane/2-gel actual browser restore, vertical preview and zoom succeed on port 5186. PNG output is byte-identical to the previously verified development export (15879 x 2942). PDF text sequence, page bounds and embedded images equal the verified export. Unit coverage includes 6/12/24 lanes, 1/2 gels, long names, hierarchies, side reversal, aspect preservation and marker spacing.

Current state: isolated release prepared. Remaining limitations: existing public functionality outside Figure layout remains unchanged and is not newly certified. Next step: publish these four static files and verify Pages delivery. No further user approval is required for this explicitly requested limited replacement. Broader development remains local.

Rollback: revert the public release commit on main; old assets are retained. Source branch codex/public-figure-only is independent of codex/windows-reliability. Evidence: ../public-figure-baseline-comparison.json, ../public-figure-tests.log and Downloads layout-24lanes-2gel-figure (1).png / figure-editable-25.5mm (2).pdf.
