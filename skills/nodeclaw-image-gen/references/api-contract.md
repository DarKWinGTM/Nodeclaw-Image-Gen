# Image client API reference

This is a bundled NodeClaw-specific guide, not a universal provider schema. Canonical contract: [PAYG OpenAPI](https://nodenetwork.ovh/docs/api/payg/openapi/payg-gateway.v1.yaml). The design checked OpenAPI 3.1.0, document version 1.2.0; cached or bundled material is not proof of the current live service.

## Profiles and discovery

Native inference: `https://payg.nodenetwork.ovh`; catalog: `https://app.nodenetwork.ovh/api/payg-model-data`. Custom OpenAI-compatible endpoints do not inherit the NodeClaw Task protocol or compatibility fields. Configuration can explicitly bind a NodeClaw proxy and its separate catalog/docs URLs.

Auto endpoint order is active exposed harness binding → configured fallback → native. An explicitly configured/pinned endpoint is not silently replaced. Never move a harness credential to another candidate or forward API Authorization to image downloads/docs.

Catalog discovery is sequential: applicable `data.snapshot.models[]` from payg-model-data, then `/v1/models` `data[].id`. Merge exact public IDs with provenance. NodeClaw's `/v1/models` is Chat-only projection; missing catalog or unknown capability still admits an explicitly named model. Generate/Edit pairs are independent.

## Requests

- Generate: `POST /v1/images/generations`.
- Edit: `POST /v1/images/edits` with JSON/native content or multipart local files/mask.
- NodeClaw routing requires `model` and `compatibilityKey`: `openai_image_generations`, `openai_image_edits`, or explicit supported `google_image_generate_content`.
- Task: `POST /v1/media/tasks` JSON `{operation:"image_generation"|"image_edit",request:{...nativeRequest}}`.
- Multipart Task Edit puts `operation=image_edit` beside original fields and files, not inside `request`.
- Task is finite: `stream=false`, `partial_images=0`. Generate JSON 2 MiB; Edit JSON/multipart 34 MiB; Task envelope 34 MiB + 65,536 bytes, with the nested operation limit still applicable. These are NodeClaw limits, not all-provider facts.
- `--request-json FILE` preserves advanced native request members. Explicit operation controls must be valid for the selected API; image format is not the same as result delivery `response_format`.

## Task identity and completion

A local handle stores a UUID request-signature before POST. New acceptance 202 and signed duplicate 200 identify the original Task. Conflict 409 stops. A lost reply uses `GET /v1/media/tasks` with the same signature; known ID uses `GET /v1/media/tasks/{taskId}`. GET 404/503 is not permission to POST again.

Poll `queued`, `processing`, `reconciling`. `succeeded` requires result; failed/expired are terminal errors, not proof of no charge. Honor Retry-After within caller deadline. Timeout/Ctrl-C stops local waiting, not remote execution; resume the original endpoint/identity. A resume handle cannot authorize a destination or select an environment secret: its exact base URL/proxy path must match a current configured/harness candidate, whose current credential binding is used. Configure the original binding explicitly if it is no longer exposed. No list/cancel/SSE Task API is invented.

Direct JSON results contain `data[].b64_json` or `data[].url`. Direct SSE requires the operation-specific `image_generation.completed` or `image_edit.completed` complete event with result; partial images, usage, [DONE] and EOF are insufficient. Direct Recovery is preview/not enabled; an uncertain Direct outcome is never automatically replayed.

## Fallback and output

Task-first defaults to safe fallback enabled; terminal reattempt disabled. A known Direct-only custom profile chooses Direct before submitting. Unknown Task acceptance/polling loss stays on the original identity. Auth/policy/invalid/conflict failures never trigger bypass. The client has no verified public terminal retry-eligibility category: enabling terminal opt-in emits a diagnostic but does not send another inference request. A separately authorized new attempt may incur both charges; expiry is excluded. HTTP status alone cannot distinguish task queue capacity from account/global quota.

The client saves actual image bytes and reports actual returned count. File collisions are not overwritten. Partial saves retain successful files; private same-result recovery artifacts permit saving again without inference. Ordinary API output saving does not convert images. Explicit local technique tools can create processed PNG copies, separate from preserving the raw API result. No Telegram/storage upload, rehosting or external publishing is included.

Exit codes: 0 success/saved; 1 known failure or incomplete saving; 2 invalid config/input; 3 resumable pending or incomplete/explicitly partial technique output; 4 unknown execution outcome. Source/local fixture tests do not establish live provider success, billing finality or stability.
