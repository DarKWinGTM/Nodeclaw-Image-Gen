---
name: nodeclaw-image-gen
description: Use when a user requests image generation, image editing, reference-based artwork, image styles, or multi-step image techniques through NodeClaw or a custom Images API, including tiled Pixel Art refinement.
---

# Nodeclaw-Image-Gen

Use the existing text model to understand the brief, select styles/techniques and call the shipped Node CLI. Deterministic preparation, validation and image processing belong to tools, not model-authored scripts. No extra LLM service, daemon or storage uploader. Save actual API results locally; do not rehost them on Telegram/storage/CDNs.

## Start

Resolve `<skill-root>` as the absolute directory containing this loaded `SKILL.md`; never guess from the working directory. Invoke `node "<skill-root>/scripts/image-gen.mjs" ...` from the user's workspace so relative outputs go there.

1. Check Node.js 22+ and CLI `--help`, then `setup --status --json` for local credential readiness without API calls. Do not print config files, rewrite settings on every use or ask the user to repeat saved address/model choices.
2. Defaults: NodeClaw, `gpt-image-2`, Task-first, one image, `./generated-images/`. For a plugin install, use `/plugin configure nodeclaw-image-gen@nodeclaw-image-gen`; pending changes load through `/reload-plugins` in the same session, not a routine restart. Do not claim the skill can open or execute those native commands itself. The shipped native module passes the address/key as one ephemeral binding on load/reload; the CLI validates it and ignores old startup exports. After reload, check the effective `apiBaseUrl`, `endpointMode` and `credentialConfigured` together with `setup --status --json`. Credential readiness alone does not prove the latest configuration or API acceptance; `status:not_configured` can mean no standalone config file. If the address remains stale or native application is blocked, report the exact load/configuration blocker without printing environment values, reading secret stores, re-entering the saved key, retrying unchanged reloads or calling the API. A user-selected standalone installation uses `node "<skill-root>/scripts/image-gen.mjs" setup --interactive` in their own local terminal; it asks for the base address and hides the key, with explicit `--replace` for existing config. Never collect keys in chat, AskUserQuestion, specs, tool-command arguments or OAuth/token/session stores. Do not run an interactive key prompt in a captured AI tool session. Direct installer/setup key arguments exist for human-operated automation, not secret collection by the model.
3. Reuse supplied model/path/spec choices. `models --json` merges ordered discovery; an exact manual model remains allowed when no catalog exists, with capability explicitly unverified. Installation/setup address/key pins that endpoint; legacy auto mode still tries the exposed active harness before configured/native fallback. Do not move a stored key to another address or proxy prefix.

## Generate or edit

Generate makes a new image; Edit uses specifically approved source images/masks. Files merely existing in a workspace are not permission to send them.

```bash
node "<skill-root>/scripts/image-gen.mjs" generate --prompt "A quiet riverside town at sunrise" --dry-run --json
node "<skill-root>/scripts/image-gen.mjs" generate --prompt "A quiet riverside town at sunrise" --yes --json
```

Edit uses `edit --prompt TEXT --image FILE [--mask FILE]`. Use an approved private `--spec FILE` for long briefs; specs are not diagnostic logs and never contain API keys. The CLI appends Task/OpenAI routes to the saved base address. Native `/v1beta/models/{model}:generateContent` requires explicit `--api-mode gemini`: it is Direct-only native contents/parts, not implied by a Google model name or Images compatibility key. Existing `google_image_generate_content` Images/Task execution stays on its current routes. Gemini native transport is not Direct Image billing/readiness proof. The CLI help lists actual options.

Before a paid call, summarize operation/model/style/spec/endpoint/method/fallback/output from dry-run. Use **one native form**: Generate as shown / Adjust / Explore styles / Cancel. Combine only genuinely missing questions; do not ask every field. After approval use `--yes`; confirm only material count/endpoint/sequence changes.

Claude Code uses `AskUserQuestion` when available; Codex uses `request_user_input` only when actually exposed. Do not impersonate native choices with numbered text or switch modes to invent a tool. User-selected noninteractive automation may use supplied config/spec plus `--yes`. Grok Bot import/native-form integration is unverified; a cloud path is not a desktop file.

## Styles and technique tools

- `styles list|show ID` selects appearance; `techniques list|show ID` selects a workflow and its shipped tools. Combine freely without a style→technique allowlist or another orchestrator service.
- Suggest 2–3 relevant styles plus Original prompt / No preset. Read a selected preset with `styles show ID --json`; `exampleImages[]` are optional third-party preview URLs, not approved API image inputs. Do not automatically fetch, upload or use them as Edit references. The 58 bundled presets include 55 additional imported styles; original collections in `references/style-imports/` are provenance only, never another active style source. GIF names do not imply animation support. Use only the subject/context approved for the current request, not unrelated private memory. Search only when requested through an available harness tool; do not send the whole private brief to search.
- Read only the selected workflow, check requirements and **use its shipped `techniques prepare/check/merge` tools**. Do not ask a weaker model to implement crop/resize/mask/colour/merge logic anew. Prepare locally first, then show the actual paid request count and sequence for approval. Local preparation never authorizes inference.
- [Pixel Art refinement](techniques/pixel-art-detail/WORKFLOW.md): prepare aligned nearest-neighbor tiles and Edit specs, submit approved edits through the existing client, check and merge into high-resolution/original-size PNGs. [Preserve composition](techniques/preserve-composition/WORKFLOW.md): prepare one constrained Edit spec and check the result. Both ship the PNG codec; no Python/ImageMagick installation is needed.
- A missing helper/minimum-client requirement calls for an approved full skill update or stopping that technique **before** paid calls. Do not replace it with context-only claims, execute downloaded code, promise seamlessness or start paid redraw loops.
- `styles|techniques sync` previews official GitHub JSON/Markdown; `--yes` applies. Custom namespaces are separate. Executable helper changes require a verified full skill update; remote content never changes auth/endpoints/permissions or grants execution approval. Presets do not authorize private memory disclosure.

## Results and recovery

Use returned JSON statuses and paths. `saved` means all expected files were saved. `pending`/`outcome_unknown` retain the handle and use `resume --handle FILE`, never create another request. `save_failed` keeps successful files and retries the same result. Direct unknown outcomes have no enabled recovery. Technique `incomplete`/`partial` exits 3; partial outputs are not fully refined.

Stopping the client does not cancel a remote Task. Do not switch method/model/endpoint to bypass uncertainty, auth or policy; see [API contract](references/api-contract.md). Use vision only when actually available; file checks do not prove visual quality. No automatic paid refinement.

For an installation request, obtain and verify the selected GitHub package before invoking its installer; do not assume source files already exist locally. Prefer the documented AI auto-install flow or the selected native plugin manager, never a duplicate install. After standalone installation, turn its returned `commands.configure` argv into a properly quoted command using the real installed path for the user to run locally; also return the reconfigure/status/update commands. A plugin uses its native sensitive configuration form; its Git-backed marketplace selects the repository revision independently of standalone release assets. Human-run terminal `claude plugin install --config` may supply declared address/key values, but never collect a real key or put it in an AI tool argument. Do not mark credential setup complete until the user finishes it and local `setup --status --json` reports readiness; this is local readiness, not API acceptance. If a required standalone release or matching marketplace version is unavailable, stop with that blocker rather than inventing installed features.

`docs fetch|sync` is optional public reference, not a runtime contract update. Standalone `update check|apply` never writes plugin-managed caches; those use the native plugin manager. Installation/replacement/publication require their own authorization, not permission inferred from an image request. User interaction follows the user's language; this skill's base guidance is English.
