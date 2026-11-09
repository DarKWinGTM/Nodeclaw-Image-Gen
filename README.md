# Nodeclaw-Image-Gen

Generate and edit images from your existing AI coding assistant through NodeClaw or a custom OpenAI-compatible Images API. Includes a portable Node.js CLI, independent style presets and **runnable technique tools** for tiled Pixel Art refinement and composition-preserving edits.

**Requires supported Node.js 22+, an API base address and your own API key.** Configure them during installation or once through setup; environment variables are optional.

[Download a release](https://github.com/DarKWinGTM/Nodeclaw-Image-Gen/releases) · [Repository](https://github.com/DarKWinGTM/Nodeclaw-Image-Gen) · [CI](https://github.com/DarKWinGTM/Nodeclaw-Image-Gen/actions/workflows/verify.yml)

**v0.1.2** adds address/key setup, explicit Gemini wire support and 55 additional style presets with example image URLs. These features require v0.1.2 or newer; use the matching release and CI run above to check public availability and revision-specific verification.

## Quick install

Choose one method; do not install both standalone and marketplace copies for the same harness.

### AI auto install

Copy this prompt into Claude Code or Codex to have the assistant carry out installation:

```text
Install Nodeclaw-Image-Gen for this Claude Code or Codex environment from https://github.com/DarKWinGTM/Nodeclaw-Image-Gen. Read its README, check Node.js 22+, detect the harness and reuse an existing install manager; do not install duplicate standalone and plugin copies. For a standalone install, download and verify a published v0.1.2 or newer release and obtain the package before running its installer, preview the user-scope target, then install with --yes. If the required release is unavailable, report the blocker. A Claude Code plugin install uses the supported marketplace version instead; the Git-backed marketplace does not require a release archive. Ask only for missing prerequisites, trust/permissions or replacement approval. After standalone installation, return an exact command using the real installed path for me to run setup --interactive locally and enter the API base address and hidden key; use --replace only with my approval when updating saved config. For a plugin install, direct me to its supported native configuration form and declared sensitive key field. Never collect keys in chat, AskUserQuestion or captured tool arguments, read secret stores or print key values. Verify --help, techniques list --json and setup --status --json without API calls. Report version/path, whether credentials are configured, any restart step, and the exact commands to reconfigure and update later. Do not claim credential setup is complete before the user finishes it.
```

The assistant needs actual filesystem/shell access and still follows the harness's trust and installation prompts.

### Claude Code marketplace

Run **inside Claude Code**, then complete its native install/trust dialog:

```text
/plugin marketplace add DarKWinGTM/Nodeclaw-Image-Gen
/plugin install nodeclaw-image-gen@nodeclaw-image-gen
/plugin configure nodeclaw-image-gen@nodeclaw-image-gen
```

This source declares a native configuration form for **API base address** and a masked **API key**. Reconfigure with `/plugin configure nodeclaw-image-gen@nodeclaw-image-gen`, then start a new session. The two slash commands above install the plugin; this guide does not assume slash `/plugin install` accepts terminal `--config` flags.

For terminal installation with parameters (placeholders only; `--marketplace` requires Claude Code v2.1.292 or newer):

```bash
claude plugin install nodeclaw-image-gen --marketplace DarKWinGTM/Nodeclaw-Image-Gen --scope user --config api_base_url=https://payg.nodenetwork.ovh --config api_key="<your-api-key>"
```

Run real-key commands yourself in a local terminal, never through an AI tool call. Prefer the native masked form: terminal arguments can enter shell history/process listings. `api_key` is declared sensitive, so Claude Code stores it through its credential mechanism rather than ordinary settings JSON; keychain availability and credential-file fallback depend on the platform. A SessionStart hook bridges this address/key pair to the CLI using the supported session environment file, not skill text or secret-store extraction. That temporary export file is **plaintext**, and shell subprocesses in the session can access the key; it is not keychain-only isolation.

The bridge targets supported Bash sessions. Windows PowerShell hooks/consumers have `CLAUDE_ENV_FILE` limitations; use the same CLI's private local `setup --interactive` when the bridge is unavailable. Native UI/keychain and Windows runtime behavior have not been accepted through a real harness install in this source task. See the [official userConfig](https://code.claude.com/docs/en/plugins/manifest-reference#user-configuration) and [session environment](https://code.claude.com/docs/en/hooks#persist-environment-variables) contracts.

The Git-backed marketplace installs the plugin from its selected repository revision (`source: "./"`); it does not need a release archive. Standalone downloads, updates and content sync use the published release assets instead. To refresh an existing managed installation, run `claude plugin marketplace update nodeclaw-image-gen`, then `claude plugin update nodeclaw-image-gen@nodeclaw-image-gen` and start a new session. This is a self-hosted marketplace, not an Anthropic-directory endorsement.

## Manual installation reference: Claude Code or Codex

Download and extract a published release. From the extracted package root, preview, then install:

```bash
node script/install.mjs --harness claude-code --api-base-url https://payg.nodenetwork.ovh --interactive
node script/install.mjs --harness claude-code --api-base-url https://payg.nodenetwork.ovh --interactive --yes
```

The first command previews only; the second asks for the key locally with input hidden and saves it in private user config. Use `--harness codex` for Codex. Omit the API/configuration options to install code only. Add `--replace` only to replace a recognized standalone installation; replacing existing config separately requires `--replace-config`. For project scope, run from your project root using the installer's absolute path and add `--scope project`; `--target DIR` chooses an explicit destination.

| Harness | User installation | Project installation |
|---|---|---|
| Claude Code | `~/.claude/skills/nodeclaw-image-gen` | `.claude/skills/nodeclaw-image-gen` |
| Codex | `~/.agents/skills/nodeclaw-image-gen` | `.agents/skills/nodeclaw-image-gen` |

The installer copies the **whole skill**, including its tools and codec. Its JSON result includes `commands.configure`, `commands.reconfigure`, `commands.status`, `commands.checkUpdate` and `commands.update` as argument arrays using the actual installed path. Run credential-entry commands yourself in a local terminal, quoting path arguments for your shell; no key is included in those arrays. Code-only installation can finish before credential setup, and those states are reported separately. Config/state/custom packs stay outside installation. Plugin-managed copies use the native plugin manager for updates. Grok Bot import/script/native-choice integration is not yet verified; no guessed installer path is provided.

## First image

Configure the API address and key once using native plugin configuration or the local setup below. No environment setup is required. Never paste a key into chat or a request spec. The tool does not read OAuth/session stores or change harness permissions.

From the package root (skip setup if credentials were already configured during installation or through the native plugin form):

```bash
node skills/nodeclaw-image-gen/scripts/image-gen.mjs setup --interactive
node skills/nodeclaw-image-gen/scripts/image-gen.mjs setup --status --json
node skills/nodeclaw-image-gen/scripts/image-gen.mjs generate --prompt "A quiet riverside town at sunrise" --dry-run --json
node skills/nodeclaw-image-gen/scripts/image-gen.mjs generate --prompt "A quiet riverside town at sunrise" --yes --json
```

Defaults: **NodeClaw · gpt-image-2 · Task-first · one image · `./generated-images/`**. `--dry-run` never generates; `--yes` explicitly authorizes the selected request. Through the skill, the existing text model asks one compact native confirmation and reuses choices you already supplied.

For an installed skill, replace `skills/nodeclaw-image-gen/` with its actual absolute directory. Relative input/output paths resolve from your working directory, not the installation directory.

## Edit an image

```bash
node skills/nodeclaw-image-gen/scripts/image-gen.mjs edit --prompt "Change only the sky to sunset; preserve the town" --image "original image.png" --dry-run --json
node skills/nodeclaw-image-gen/scripts/image-gen.mjs edit --prompt "Change only the sky to sunset; preserve the town" --image "original image.png" --yes --json
```

Additional `--image` inputs or `--mask FILE` require actual model/API support and specifically approved files. `--spec FILE` carries a private JSON brief/settings; `--request-json FILE` supplies advanced native payloads. Explicit flags override the spec. A spec cannot authorize inference with `yes:true`; only explicit `--yes` does that. Google `contents/parts` requires its matching NodeClaw compatibility profile, not a guess from the model name.

## Technique tools: not just prompts

**Styles control appearance; techniques combine guidance with tools that perform known processing steps.** Your existing text model chooses the brief, style and technique and reviews the image. Shipped tools do exact file/pixel/coordinate work so success does not depend on the model writing a correct raster script each time. Styles and techniques can be used independently or together.

```bash
node skills/nodeclaw-image-gen/scripts/image-gen.mjs styles list --json
node skills/nodeclaw-image-gen/scripts/image-gen.mjs techniques list --json
node skills/nodeclaw-image-gen/scripts/image-gen.mjs techniques show pixel-art-detail --json
```

Bundled styles: **58 presets** — Tarot ink, Pixel art, Clean product and 55 additional styles such as Aerial view, Caricature, Film strip, Blueprint and Professional product photo. Additional presets and Tarot ink expose `exampleImages[]` URLs through `styles show ID --json`; the CLI does not download or send those images automatically. Preview names such as GIF do not add animation support to a still-image API.

The supplied source collections are preserved unchanged under `skills/nodeclaw-image-gen/references/style-imports/`; active presets use the existing one-file-per-style schema in `styles/`. Only user-approved request context belongs in prompts, not unrelated personal memory. Example images are third-party references, not bundled media or a grant of redistribution rights.

### Tiled Pixel Art refinement

1. **Prepare locally**: snapshot the selected PNG, calculate grid-aligned overlap/padding, nearest-resize/crop tiles, skip transparent/protected tiles and write individual Edit specs.
2. **Approve and edit**: review the actual request count, then use the existing Task/Direct client for each tile. No second API client or automatic paid retry loop.
3. **Check and merge**: validate PNG dimensions, alpha diagnostics and source integrity; restore original low-frequency colour plus edited signed detail, blend overlap and preserve the selected alpha/protection mask.

```bash
node skills/nodeclaw-image-gen/scripts/image-gen.mjs techniques prepare pixel-art-detail --image original.png --work-dir pixel-job --scale 3 --tile-size 1024x1024 --json
# Review requestCount and supported size, then submit each returned spec after approval:
node skills/nodeclaw-image-gen/scripts/image-gen.mjs edit --spec pixel-job/specs/r00_c00.json --dry-run --json
node skills/nodeclaw-image-gen/scripts/image-gen.mjs edit --spec pixel-job/specs/r00_c00.json --yes --json
# After all selected tiles finish:
node skills/nodeclaw-image-gen/scripts/image-gen.mjs techniques check --job pixel-job/job.json --json
node skills/nodeclaw-image-gen/scripts/image-gen.mjs techniques merge --job pixel-job/job.json --json
```

Preparation/check/merge send **zero API requests**. Preparation returns every spec path; repeat the Edit step only for the other approved, unsubmitted specs. Keep returned Task handles and resume those exact operations rather than rerunning a submitted tile.

Outputs: **`refined-hires.png`** at width/height × scale, plus **`refined-original-size.png`** using grid-aligned nearest downscale. Existing outputs are never overwritten. Missing/mismatched tiles block merge; explicit `--allow-partial` creates clearly named partial previews with original-filled missing regions and exit 3, never a false complete result.

PNG tools accept single-frame, non-interlaced, 8-bit PNGs: 32 MiB/input, 16 megapixels/source and target, at most 2048/side per tile and 64 tiles. The pixel limit is not a low-memory guarantee: at the maximum target, the merge accumulator alone uses 320 MiB, plus image and blur buffers. Choose dimensions actually accepted by your API. Defaults: scale 3, overlap 0.25, colour sigma 2 source pixels (three-box Gaussian approximation), preserve original alpha. `--mask` uses alpha 255 to preserve, 0 to edit; no guessed colour key. `--color-sigma 0` disables colour restoration.

Read the [complete Pixel Art workflow](skills/nodeclaw-image-gen/techniques/pixel-art-detail/WORKFLOW.md) for masks, geometry, partial exports and review. Correct files/dimensions do not prove seamlessness, unchanged object placement or better visual quality. Detail is synthesized, not recovered ground truth. Human/vision acceptance remains necessary.

### Preserve composition

`techniques prepare preserve-composition --image original.png --work-dir composition-job --change "Change only the sky" --preserve "camera,character"` creates a snapshot and one constrained Edit spec. Submit that spec using the existing Edit client, then run `techniques check --job composition-job/job.json`. No merge is needed; see the [workflow](skills/nodeclaw-image-gen/techniques/preserve-composition/WORKFLOW.md). The check reports dimensions/alpha/protection diagnostics, not a guarantee of likeness or composition.

### Add styles and techniques

Custom styles use JSON under user data `custom/styles/`; custom techniques use `<id>/technique.json` and `WORKFLOW.md` under `custom/techniques/`, selected as `custom:<id>`.

```bash
node skills/nodeclaw-image-gen/scripts/image-gen.mjs techniques sync
node skills/nodeclaw-image-gen/scripts/image-gen.mjs techniques sync --yes
```

Official content sync previews a versioned JSON/Markdown pack and preserves custom content. **Executable helpers only arrive through full skill updates**, never downloaded workflow hooks. Content requiring a newer client is rejected with an update instruction. A published release must exist before network sync can retrieve it.

## Results and resume

CLI output is JSON containing paths/status; `--json` uses one line. Ordinary Generate/Edit saving preserves actual API bytes/format; it never silently converts them. Technique exports are explicit PNG processing outputs. Keys, raw Base64 and private prompts are not printed.

```bash
node skills/nodeclaw-image-gen/scripts/image-gen.mjs resume --handle "<returned-handle-path>" --json
```

| Status / exit | Meaning |
|---|---|
| `saved` / 0 | All returned/selected output images were saved |
| `failed` / 1; invalid input / 2 | Operation failed or input/config needs correction |
| `pending` / 3 | Continue waiting for the same Task using its handle |
| `outcome_unknown` / 4 | Acceptance/completion is unresolved; do not create another inference |
| `save_failed` / 1 | Successful files are retained; recover saving from the same result |
| `incomplete`, `partial` / 3 | Technique tiles are missing/invalid, or an explicitly partial preview was exported |
| `prepared`, `ready` / 0 | Local preparation/check completed; not inference or visual acceptance |

Task handles contain identity/endpoint/output intent, not keys/prompts/image inputs. Resume requires the original exact endpoint/proxy path to remain a currently trusted candidate and uses its current credential binding, never an environment name chosen by a handle. A private partial-save recovery artifact can contain result bytes/URLs; keep it private and expect URLs may expire.

Ctrl-C stops local waiting, not the remote Task. A successful image does not prove billing finality. Job directories contain selected source images, masks, prompts and results: do not publish them.

## Config and custom providers

Config selection: `--config` → `NODECLAW_IMAGE_GEN_CONFIG` → OS user config. Value precedence: explicit CLI/spec → env → selected config → built-ins. See [config.example.json](config.example.json).

- Linux: `${XDG_CONFIG_HOME:-$HOME/.config}/nodeclaw-image-gen/config.json`
- macOS: `~/Library/Application Support/Nodeclaw-Image-Gen/config.json`
- Windows: `%APPDATA%/Nodeclaw-Image-Gen/config.json`

API address/key supplied during installation or setup selects `endpointMode: "configured"`: that address is pinned across future calls. Existing/default `endpointMode: "auto"` preserves exposed active harness → configured fallback → native `https://payg.nodenetwork.ovh`. Explicit CLI/spec `apiBaseUrl` pins one invocation. Use `--harness-endpoint` and `--harness-api-key-env` when the effective binding is not exposed; the tool does not guess layered Codex configuration. Loopback HTTP needs explicit `--allow-local-http` or config `allowLocalHttp:true`; TLS verification stays enabled.

```bash
node skills/nodeclaw-image-gen/scripts/image-gen.mjs generate --api-base-url "https://images.example/v1" --provider openai-compatible --api-key-env CUSTOM_IMAGE_API_KEY --model "exact-image-model" --prompt "A mountain cabin" --dry-run --json
```

`apiBaseUrl`, `catalogUrl` and `apiDocsUrl` have separate roles. Discovery reads applicable `payg-model-data`, then `/v1/models`, merging exact IDs and provenance. No catalog is required for an exact manual model; `--skip-discovery` selects that unverified-capability path. NodeClaw `/v1/models` is a Chat projection, not proof of Image readiness.

### Address/key during installation or later setup

For direct parameters (placeholders only):

```bash
node script/install.mjs --harness codex --api-base-url "https://payg.nodenetwork.ovh" --api-key "<your-api-key>" --yes
node skills/nodeclaw-image-gen/scripts/image-gen.mjs setup --api-base-url "https://payg.nodenetwork.ovh" --api-key "<your-api-key>"
```

**Direct key arguments can appear in shell history and process listings.** Prefer `--interactive` in your local terminal, or pipe a key from your own secret manager using `--api-key-stdin`. Do not ask an AI assistant to run a command containing a real key. Setup does not contact the API; `setup --status --json` checks local configuration without exposing the key. Updating settings uses `setup ... --replace`; the old key is retained only for the same exact base address/proxy prefix. A changed address requires a new key binding.

Standalone keys are saved as **plaintext** in the selected user config outside the installed skill. New POSIX directories/files use modes 0700/0600; this is not encryption or Windows ACL enforcement. Do not commit or share that config. The example file intentionally contains no key. Installer preview never reads stdin, asks for a key, writes config or sends an API request.

Optional environment overrides use the full `NODECLAW_IMAGE_GEN` prefix with `_API`, `_MODEL`, `_METHOD`, `_FALLBACK`, `_FALLBACK_TERMINAL`, `_CATALOG_URL`, `_DOCS_URL`, `_OUTPUT_DIR`, `_API_KEY_ENV`, `_ENDPOINT_MODE`, `_API_MODE`. For a key override, supply both `NODECLAW_IMAGE_GEN_API` and `NODECLAW_IMAGE_GEN_API_KEY`; the key is bound to that exact normalized address, not forwarded to another CLI pin. The address/key pair takes precedence over the saved pair. Legacy `NODECLAW_API_KEY` or `apiKeyEnv` is used when no bound pair is available. Booleans accept `true/false/1/0`; invalid values are errors.

### Automatic route composition

Supply a base address, optionally ending in `/v1` or `/v1beta`; proxy prefixes are preserved and version suffixes are not duplicated.

| Selected wire | Route appended by the client |
|---|---|
| Task, default Images mode | `/v1/media/tasks` |
| Direct Generate / Edit, Images mode | `/v1/images/generations` / `/v1/images/edits` |
| Explicit `--api-mode gemini`, finite Direct | `/v1beta/models/{model}:generateContent` |

`images` remains the default. Its NodeClaw `google_image_generate_content` compatibility still uses Images/Task routes and normalized `data[]` results. **Gemini mode is explicit**, never inferred from a model name or that compatibility key. It builds `contents/parts`, reads inline image data from candidate parts and saves the actual returned bytes through the existing output writer. Use native `generationConfig` in `--request-json` rather than OpenAI image controls; local PNG/JPEG/WebP inputs become inline parts. Text-only or safety-completed responses are not reported as saved images. NodeClaw's native route has a 2 MiB JSON limit and belongs to its Text-family transport, not proof of Image readiness or a particular billing method. This client uses customer Bearer authentication; direct Google's `x-goog-api-key` transport is not implied.

## Task, Direct and fallback

Task-first persists a signature before POST, polls/resumes the same identity and preserves unknown acceptance. Known Direct-only custom profiles may select Direct before submission when fallback is enabled. `--method direct` explicitly selects Direct; `--fallback false` disables safe method preselection.

No HTTP status alone proves no Task acceptance. There is no blind Task POST/terminal-error → Direct replay. Even with advanced `onTerminalFailure:true`, the client sends no extra inference because the public terminal categories do not establish safe retry eligibility. Failed/expired do not prove no charge. See the [API contract](skills/nodeclaw-image-gen/references/api-contract.md).

## Updates and API references

`docs fetch` reads an optional matching public reference/cache; `docs sync` refreshes without API credentials. Missing docs do not block a custom provider, and fetched text never changes endpoints/encoders.

```bash
node skills/nodeclaw-image-gen/scripts/image-gen.mjs update check
node skills/nodeclaw-image-gen/scripts/image-gen.mjs update apply --target "<standalone-skill-directory>" --yes
```

Plugin-managed installations update through the native plugin manager. Standalone updates use versioned file manifests, validate paths/size/SHA-256 before switching and preserve config/state/custom content. Checksums prove integrity, not publisher trust.

## Design, development and verification

- [Design entrypoint](design/nodeclaw-image-gen.design.md) and its linked runtime/experience contracts
- [Architecture](diagram/STRUCTURE.md)
- [Changelog](changelog/nodeclaw-image-gen.changelog.md)
- [Implementation route](docs/superpowers/plans/2026-11-09-nodeclaw-image-gen.md)
- [Bundled PNG codec provenance/license](skills/nodeclaw-image-gen/vendor/README.md)

Design/changelog/docs/diagram are included in the repository and source release, **not** the installed skill's runtime copy. Canonical development remains the NodeClaw-platform package subtree; this repository is its downstream distribution.

```bash
npm run check
npm test
npm run package -- --dry-run
npm run package -- --out "<new-output-directory>"
```

Packaging uses local `tar` for the manual archive. The installer/updater needs no tar/Git/Python/archive parser. Payload files are allowlisted; user configuration, state, images and captures are excluded.

Tests exercise config/discovery, Task identity/recovery, real request encoding, SSE completion, actual saved files, content/install integrity and local PNG technique processing. Local proof is not paid-provider, installed native-form, visual-quality or production-deployment proof. The CI matrix targets Windows/macOS/Linux with Node.js 22/24; use the selected revision's actual run before claiming that revision is cross-platform verified. Grok Bot integration remains unverified.
