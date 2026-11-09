# Tiled Pixel Art refinement

Use this technique when composition is already approved and the user wants finer synthesized detail. The shipped tools handle pixels, coordinates and files; do not invent a replacement crop/merge script. The existing text model chooses the brief/style, confirms paid requests and reviews the image.

## 1. Prepare locally before any paid call

Use the user's selected original PNG. If an initial generation is needed, obtain separate approval and let the user accept its composition first. Resolve `<skill-root>` from the actual loaded skill path.

```bash
node "<skill-root>/scripts/image-gen.mjs" techniques prepare pixel-art-detail --image "original.png" --work-dir "pixel-job" --scale 3 --tile-size 1024x1024 --overlap 0.25 --json
```

This command sends **zero API requests**. It writes a private source snapshot, `job.json`, nearest-neighbor input tiles, per-tile Edit specs and an empty `edited/` directory. Origins align to the source pixel grid; right/bottom padding is transparent and recorded by the valid region. Fully transparent or fully protected tiles are skipped. A work directory must be new; the original is never overwritten.

- `scale` multiplies each side: 1024² at scale 3 becomes 3072², not a six-times-wide square. Overlap determines the real tile count.
- Choose a tile size actually supported by the selected Edit API. 1024² is a default, **not** a claim that every model/profile accepts it. Smaller source images can use a single padded tile.
- Inputs must be single-frame, non-interlaced, 8-bit PNGs. Limits: 32 MiB/input, 16 megapixels/source and target, 2048/side per tile, 64 tiles. At the maximum target, the merge accumulator alone uses 320 MiB, plus image and blur buffers; these limits do not guarantee low memory use. Explicitly convert an approved copy if needed; do not silently re-encode an API result.
- Optional `--mask protection.png` has the source dimensions: alpha 255 preserves original pixels, alpha 0 permits edits, intermediate alpha blends. It also creates matching API masks; never guess a pink/other colour key.
- `--color-sigma 2` sets the low-frequency radius in source pixels; 0 disables colour restoration. `--preserve-alpha true` is the default; false uses edited alpha where edits exist.
- `--prompt TEXT` adds the user's selected style/detail direction to the built-in preservation prompt. Styles and techniques remain independent.

## 2. Approve and edit using the existing client

Report `requestCount`, target dimensions, model, endpoint/method and intended two outputs. Confirm the complete paid sequence once; if count/endpoint changes, confirm that delta. Preparation is not authorization for paid inference.

For each path in the preparation result's `specs`, run the **existing** Edit CLI:

```bash
node "<skill-root>/scripts/image-gen.mjs" edit --spec "pixel-job/specs/r00_c00.json" --dry-run --json
node "<skill-root>/scripts/image-gen.mjs" edit --spec "pixel-job/specs/r00_c00.json" --yes --json
```

These are independent image requests, not new chats. The spec supplies the input, exact output filename under `edited/`, size, count 1 and preservation prompt. Ordinary model/config/endpoint overrides still apply; never override input/output geometry casually. Specs contain no API key and cannot supply `--yes`.

Keep the returned Task handle for each submitted tile. On `pending`, `outcome_unknown` or `save_failed`, use `resume --handle FILE` for that exact operation/result. Do not blindly rerun `edit`, switch transport or create a queue/batch API client. If the API returns JPEG/WebP despite PNG intent, saving fails rather than disguising the bytes as PNG; recover the same result before explicitly converting an approved copy if necessary.

## 3. Check, then merge deterministically

```bash
node "<skill-root>/scripts/image-gen.mjs" techniques check --job "pixel-job/job.json" --json
node "<skill-root>/scripts/image-gen.mjs" techniques merge --job "pixel-job/job.json" --json
```

Check validates snapshot hashes, canonical tile coordinates/paths, actual PNG dimensions and missing/invalid tile IDs. It reports alpha/protected-pixel changes. **`ready` means structurally ready, not visually accepted.** Dimension mismatch is not silently resized; object drift still needs vision/user review.

Merge restores colour with signed floating-point arithmetic:

`output = low_frequency(original_scaled) + edited - low_frequency(edited)`

Low frequency uses an alpha-aware three-box Gaussian approximation, with sigma multiplied by scale. Alpha remains separate from RGB; original transparency is restored by default. The protection mask restores original pixels. Linear overlap weights blend valid regions at saved coordinates. This is not pixel dithering or a guarantee of seamless geometry.

Outputs are no-clobber PNGs:

- `refined-hires.png`: original width/height multiplied by scale.
- `refined-original-size.png`: grid-aligned nearest-neighbor downscale to original dimensions; it cannot retain every high-resolution pixel.

Incomplete results block normal merge. Only an explicit `--allow-partial` writes `partial-hires.png` and `partial-original-size.png`, fills missing/rejected regions from the original and returns `partial`/exit 3 with missing/invalid IDs. Never call this fully refined. Use `--output-dir NEW_DIR` for another export rather than overwrite existing results.

## 4. Review the result

If an actual vision/image-view tool is available, inspect composition, silhouettes, alpha and seams at 100% plus the original-size view. Otherwise report only the checked files/geometry; ask the user to assess the visuals. Redraw only selected tiles after explicit additional-call approval, saving the prior result rather than overwriting it. No automatic paid redraw loop.

The detail is synthesized, not recovery of lost ground-truth information. No Telegram storage upload, rehosting or other result-storage service is included. Job directories contain selected source/mask images, prompts and results; keep them private.
