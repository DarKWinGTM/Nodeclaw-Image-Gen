# Preserve composition

Use the selected image, requested change and preservation constraints. Any style may be combined with this technique; explain a real conflict with a preserved feature rather than blocking styles by name.

Use the shipped preparation tool, not an improvised script:

```bash
node "<skill-root>/scripts/image-gen.mjs" techniques prepare preserve-composition --image "original.png" --work-dir "composition-job" --change "Change only the sky to sunset" --preserve "camera,character positions,silhouettes" --json
```

The local tool validates a single-frame, non-interlaced, 8-bit PNG and optional same-size `--mask`, snapshots the selected files and writes one constrained Edit spec. Mask alpha 255 preserves and alpha 0 permits edits. Preparation makes zero API requests. Confirm the exact API supports the input/output size; do not resize silently.

Review the generated spec through the existing client, obtain one compact native confirmation, then submit **one** Edit:

```bash
node "<skill-root>/scripts/image-gen.mjs" edit --spec "composition-job/specs/composition.json" --dry-run --json
node "<skill-root>/scripts/image-gen.mjs" edit --spec "composition-job/specs/composition.json" --yes --json
node "<skill-root>/scripts/image-gen.mjs" techniques check --job "composition-job/job.json" --json
```

The result is `composition-job/edited/composition.png`; no merge is needed. Check validates dimensions and reports alpha/protected-pixel changes. It does not prove likeness or object placement and does not alter the raw Edit result. Use a real vision tool/user review for those judgments. On pending/unknown/partial-save, resume the exact existing handle; never create a new paid request as recovery.

Keep the source/result/job private. No automatic paid refinement, overwrite, storage upload or guarantee of geometry preservation. Ordinary Edit remains available for non-PNG inputs outside this local PNG technique.
