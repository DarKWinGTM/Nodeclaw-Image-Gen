---
name: nodeclaw-image-gen
description: Use when a user requests image generation, image editing, reference-based artwork, image styles, or multi-step image techniques through NodeClaw or a custom Images API, including tiled Pixel Art refinement.
---

# Nodeclaw-Image-Gen

Use the existing text model to understand the brief, select styles/techniques and call the shipped Node CLI. Deterministic preparation, validation and image processing belong to tools, not model-authored scripts. No extra LLM service, daemon or storage uploader. Save actual API results locally; do not rehost them on Telegram/storage/CDNs.

## Start

Resolve `<skill-root>` as the absolute directory containing this loaded `SKILL.md`; never guess from the working directory. Invoke `node "<skill-root>/scripts/image-gen.mjs" ...` from the user's workspace so relative outputs go there.

1. Check Node.js 22+ and CLI `--help`. When configuration is absent, offer native **Use recommended settings / Customize / Cancel** choices; run `setup` only when selected. Do not rewrite configuration on every use.
2. Defaults: NodeClaw, `gpt-image-2`, Task-first, one image, `./generated-images/`. Use an actual brief and a securely configured key environment variable. Never ask for secrets in chat or inspect OAuth/token/session stores.
3. Reuse supplied model/path/spec choices. `models --json` merges ordered discovery; an exact manual model remains allowed when no catalog exists, with capability explicitly unverified.

## Generate or edit

Generate makes a new image; Edit uses specifically approved source images/masks. Files merely existing in a workspace are not permission to send them.

```bash
node "<skill-root>/scripts/image-gen.mjs" generate --prompt "A quiet riverside town at sunrise" --dry-run --json
node "<skill-root>/scripts/image-gen.mjs" generate --prompt "A quiet riverside town at sunrise" --yes --json
```

Edit uses `edit --prompt TEXT --image FILE [--mask FILE]`. Use an approved private `--spec FILE` for long briefs; specs are not diagnostic logs. The CLI help lists actual options.

Before a paid call, summarize operation/model/style/spec/endpoint/method/fallback/output from dry-run. Use **one native form**: Generate as shown / Adjust / Explore styles / Cancel. Combine only genuinely missing questions; do not ask every field. After approval use `--yes`; confirm only material count/endpoint/sequence changes.

Claude Code uses `AskUserQuestion` when available; Codex uses `request_user_input` only when actually exposed. Do not impersonate native choices with numbered text or switch modes to invent a tool. User-selected noninteractive automation may use supplied config/spec plus `--yes`. Grok Bot import/native-form integration is unverified; a cloud path is not a desktop file.

## Styles and technique tools

- `styles list|show ID` selects appearance; `techniques list|show ID` selects a workflow and its shipped tools. Combine freely without a style→technique allowlist or another orchestrator service.
- Suggest 2–3 relevant styles plus Original prompt / No preset. Search only when requested through an available harness tool; do not send the whole private brief to search.
- Read only the selected workflow, check requirements and **use its shipped `techniques prepare/check/merge` tools**. Do not ask a weaker model to implement crop/resize/mask/colour/merge logic anew. Prepare locally first, then show the actual paid request count and sequence for approval. Local preparation never authorizes inference.
- [Pixel Art refinement](techniques/pixel-art-detail/WORKFLOW.md): prepare aligned nearest-neighbor tiles and Edit specs, submit approved edits through the existing client, check and merge into high-resolution/original-size PNGs. [Preserve composition](techniques/preserve-composition/WORKFLOW.md): prepare one constrained Edit spec and check the result. Both ship the PNG codec; no Python/ImageMagick installation is needed.
- A missing helper/minimum-client requirement calls for an approved full skill update or stopping that technique **before** paid calls. Do not replace it with context-only claims, execute downloaded code, promise seamlessness or start paid redraw loops.
- `styles|techniques sync` previews official GitHub JSON/Markdown; `--yes` applies. Custom namespaces are separate. Executable helper changes require a verified full skill update; remote content never changes auth/endpoints/permissions or grants execution approval. Presets do not authorize private memory disclosure.

## Results and recovery

Use returned JSON statuses and paths. `saved` means all expected files were saved. `pending`/`outcome_unknown` retain the handle and use `resume --handle FILE`, never create another request. `save_failed` keeps successful files and retries the same result. Direct unknown outcomes have no enabled recovery. Technique `incomplete`/`partial` exits 3; partial outputs are not fully refined.

Stopping the client does not cancel a remote Task. Do not switch method/model/endpoint to bypass uncertainty, auth or policy; see [API contract](references/api-contract.md). Use vision only when actually available; file checks do not prove visual quality. No automatic paid refinement.

`docs fetch|sync` is optional public reference, not a runtime contract update. Standalone `update check|apply` never writes plugin-managed caches; those use the native plugin manager. Installation/replacement/publication require their own authorization, not permission inferred from an image request. User interaction follows the user's language; this skill's base guidance is English.
