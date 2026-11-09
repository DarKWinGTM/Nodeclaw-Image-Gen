# Nodeclaw-Image-Gen Implementation Plan

> **Execution:** Main แก้ source และทำ integration เอง ใช้ `superpowers:executing-plans` เมื่อเริ่ม execution หลังแผนผ่าน review; ไม่ใช้ subagent-driven implementation หรือ reviewer ประจำทุก task. ผู้ช่วยใช้ได้เฉพาะวิเคราะห์/ค้นหา/ทดสอบ/debug/review แบบ read-only เมื่อมีคำถามที่เปลี่ยนการตัดสินใจจริง
> **Status:** Original v0.1.0 route implemented and published; checkbox steps below are retained planning history, not the live task board. Current v0.1.1 continuation ships deterministic technique tools and English/AI auto install; source/local verified. Public distribution/OS results require the matching GitHub release/CI. Current results/limits: [changelog](../../../changelog/nodeclaw-image-gen.changelog.md)
> **Session:** 30328a2c-b111-4518-970b-7cf10fc0832a

**Goal:** สร้าง skill + CLI ขนาดเล็กที่ Generate/Edit ผ่าน NodeClaw แบบ Task-first และ Direct ได้อย่างปลอดภัย เพิ่มเทคนิคผ่าน GitHub sync ได้ และติดตั้ง/อัปเดตเป็นแพ็กเกจแยกได้

**Architecture:** Text model ใน harness เดิมอ่าน skill และ technique workflows เพื่อจัด brief/confirmation; Node CLI เป็นเจ้าของ config, endpoint/model selection, HTTP, Task identity และการบันทึกภาพ. Styles/techniques เป็นข้อมูลเสริม ไม่ใช่ executable plugins; install/update แยกจาก inference และไม่เปลี่ยน Main Core/Gateway

**Tech Stack:** Node.js 22+ ที่ยังอยู่ใน support window, ESM `.mjs`, built-in HTTP/filesystem/crypto/`util.parseArgs`/`node:test`, JSON และ Markdown; ไม่มี Python หรือ third-party runtime npm dependencies

**Spec:** [Parent design](../../../design/nodeclaw-image-gen.design.md) → [Runtime/API](../../../design/nodeclaw-image-gen-runtime.design.md), [Experience/distribution](../../../design/nodeclaw-image-gen-experience.design.md)

## Current continuation route: 0.1.1

User correction selects techniques as real processing tools, not context that makes the model write scripts. Existing experience design §11 owns shipped `technique-tools.mjs`/`raster.mjs`, pinned bundled pngjs7 and prepare/check/merge through the same CLI; Image Edit/Task/auth owners stay unchanged. English skill/workflows/README and compact Quick install are selected alongside public design/changelog/docs/diagram inclusion. Local PNG/core/install checks and frontend types pass; selected public distribution is checked separately against the matching GitHub release/CI. Paid calls, native harness install, visual acceptance and website deploy are separate and not selected here. The original route below preserves the former recipe-only scope as history, not current guidance.

## ขอบเขตและวิธีทำงาน (original route)

- Source root คือ `script/Nodeclaw-Image-Gen/` ใน platform ที่เลือก ทุก path ของแพ็กเกจด้านล่างอ้างจาก root นี้ ไม่พัฒนาใน clone/worktree/temp แล้ว sync กลับ
- สร้าง source ที่ใช้งานจริงก่อน ไม่ scaffold ทุกไฟล์ล่วงหน้า; แยก module เมื่อเป็นความรับผิดชอบจริง ไม่สร้าง class/registry/adapter ต่อโมเดล
- Main ลงมือแก้ทั้งหมด Tests อยู่ที่ test boundary ไม่เพิ่ม fake mode ใน Product และไม่มอบงานให้ platform Test suite โดยอัตโนมัติ
- ใช้ live tasks นี้เป็นลำดับงาน ไม่สร้าง phase/Patch/TODO อีกชุดเพียงเพื่อทวนแผน
- ระหว่าง implementation จดหลักฐาน/ข้อค้างใน task; รอ source และ checks ที่จำเป็นเสร็จจึง sync README/design/changelog/diagram และ NodeNetwork docs ในงาน 5. `SKILL.md`, API reference และ technique workflows เป็น functional source จึงเขียนระหว่างพัฒนาได้
- ไม่แก้ platform routes, billing, auth, Task infrastructure, root `.gitignore` หรือ unrelated dirty files. แพ็กเกจปัจจุบันถูก parent ignore; สถานะนี้ไม่ใช่เหตุให้ force-add หรือย้าย source
- Paid Provider calls, install ลง harness จริง, Git/GitHub publication และ deployment ต้องผ่าน action/scope gate ของตน ไม่ตามมาจากการเขียนแผนหรือ local tests

## ค่าที่ต้องรักษาจาก design

- Native `nodeclaw`, model `gpt-image-2`, method `task`, gateway `https://payg.nodenetwork.ovh`, output `./generated-images`, requested count `1`
- Native catalog target `https://app.nodenetwork.ovh/api/payg-model-data`; optional docs `https://nodenetwork.ovh/docs/api/payg/openapi/payg-gateway.v1.yaml`. Production targets ไม่ได้ live-verify ในงานออกแบบ
- Config หนึ่งไฟล์: `--config` → `NODECLAW_IMAGE_GEN_CONFIG` → OS user directory; field precedence `CLI/spec → env → selected config → built-ins`
- Auto endpoint: active harness binding → `NODECLAW_IMAGE_GEN_API`/configured endpoint → native. Explicit endpoint pin ไม่ fallback ข้ามระบบ; credentials ผูกกับ candidate ไม่ไหลไป CDN/docs/native fallback
- Discovery ต่อ endpoint: applicable `payg-model-data` → `/v1/models` ตามลำดับ → manual exact model; merge exact ID พร้อม source/endpoint/operation provenance. ไม่มี catalog ไม่ใช่เหตุห้ามใช้งาน
- NodeClaw `compatibilityKey` ต้องตรง Generate/Edit; custom OpenAI-compatible ไม่รับ NodeClaw envelope/fields โดยปริยาย. `auto` ของภาพเป็น intent ไม่ใช่ค่าที่ส่งให้ทุก provider
- Timeouts: `requestMs=300000`, `waitMs=900000`, `pollIntervalMs=2000`; valid `Retry-After` เป็น lower bound ไม่กลายเป็น create ใหม่
- Fallback default `{enabled:true,onTerminalFailure:false}`; switch method ได้สูงสุดหนึ่งครั้ง เมื่อยืนยัน eligible/no-acceptance ไม่ใช่ตาม HTTP status อย่างเดียว
- Task signature บันทึกก่อน POST; reply หายให้ GET ด้วย signature เดิม; มี ID แล้วอ่าน ID เดิม. 404/503, unknown outcome และ expired ไม่ authorize create ใหม่
- Output states `saved|pending|failed|outcome_unknown|save_failed`; exit `0` สำเร็จตามหน้าที่, `1` known failure/save failure, `2` invalid input/config, `3` resumable pending, `4` unknown outcome
- ไม่เก็บ API keys/raw prompt/image bytes/full Provider payload ใน handles/logs/release; ไม่ overwrite ภาพหรือ config เดิมเงียบ ๆ

## File map และขอบเขต interface

สร้างเมื่อถึงงานที่ใช้จริง; ชื่อด้านล่างเป็น owner ที่เลือก ไม่ใช่คำสั่งสร้าง abstraction เพิ่ม

| ไฟล์ | หน้าที่ |
|---|---|
| `package.json`, `config.example.json` | Runtime requirement, คำสั่ง check/test/package และ schema/defaults ที่ไม่ใส่ secrets |
| `skills/nodeclaw-image-gen/scripts/image-gen.mjs` | CLI entry, setup, command dispatch, stdout JSON/stderr progress และ exit contract |
| `skills/nodeclaw-image-gen/scripts/config.mjs` | โหลด config/env/CLI, OS paths, endpoint/profile/credential bindings |
| `skills/nodeclaw-image-gen/scripts/models.mjs` | Sequential discovery และ canonical exact-ID model view |
| `skills/nodeclaw-image-gen/scripts/images.mjs` | Resolve image request, Generate/Edit encoding, Direct JSON/SSE และ result extraction |
| `skills/nodeclaw-image-gen/scripts/tasks.mjs` | Atomic handles, create/resolve/poll/resume และ bounded method fallback |
| `skills/nodeclaw-image-gen/scripts/output.mjs` | Bounded download/decode, actual image files, collision/partial-save handling |
| `skills/nodeclaw-image-gen/scripts/content.mjs` | Styles/techniques list/show/sync และ optional API docs cache |
| `skills/nodeclaw-image-gen/scripts/distribution.mjs`, `script/install.mjs`, `script/package-release.mjs` | Shared manifest validation, standalone install/update และ allowlisted release assets |
| `skills/nodeclaw-image-gen/SKILL.md`, `references/api-contract.md` ภายใน skill | สนทนา/เลือกค่าของ harness และ normalized API reference ที่สอดคล้องกับ client |
| `skills/nodeclaw-image-gen/styles/`, `skills/nodeclaw-image-gen/techniques/` | Bundled data/workflows; official/user namespace แยกกัน |
| `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `.github/workflows/verify.yml` | Plugin/marketplace และ source/local CI; ไม่มี auto paid tests/deploy |
| `tests/config-models.test.mjs`, `tests/image-flow.test.mjs`, `tests/content-distribution.test.mjs` | สามกลุ่ม focused tests; ไม่แยก test file ต่อ option/model/style |
| `README.md` และ existing design/diagram/changelog | ผลที่ตรวจได้จริงในงาน finalization เท่านั้น |

Shared records: `Context` มี resolved config, cwd, user directories และ ordered endpoint bindings; `Endpoint` มี base URL, profile, credential-env reference และ catalog/docs binding; ไม่ serialize ค่า credential. `ModelView` แยก model ID, endpoint, operation pairs และ provenance. `ImagePlan` มี operation/model/endpoint/payload/output intent; `ImageResult` มี returned image items แบบ b64/URL และ format metadata เฉพาะที่ต้องใช้ใน memory; `SaveResult` มี status, saved paths และ safe per-item failures. `RunResult` รวม status/methods/handle/paths/safe error ไม่ส่ง raw response ไป stdout

`Technique` คือ validated metadata พร้อม local workflow path; `SyncResult` ระบุ selected pack version, changed files และ applied/unchanged/failed status. `DocsReference` ระบุ cache path/source/provider/time/hash/freshness. `ValidatedManifest` เป็น manifest ที่ผ่าน path/owner/size checks แล้ว, `StagedPayload` ผูก manifest กับ staging directory ที่ bytes/hash ผ่านทั้งหมด, `InstallResult` ระบุ target/version/install mode/final state และ recovery state หาก switch ไม่สำเร็จ ไม่เพิ่ม persisted schemas นอกหน้าที่เหล่านี้

## Review focus และ proof ที่เลือก

ใช้ `new_focused_test` กับ local HTTP/filesystem scenario ใน `node:test`; ไม่ต้องสร้าง TestKit runner ใหม่. หนึ่ง flow assert หลาย contract ได้โดยไม่เพิ่มเคสซ้ำ

| ความเสี่ยงที่มีผลจริง | หลักฐานที่ต้องได้ | Owner |
|---|---|---|
| Custom endpoint + ไม่มี catalog หรือ config `false` ถูกอ่านผิด | ยังใช้ model ที่ระบุได้, preserve prefix, credentials ไม่ข้าม origin, explicit false ไม่กลับ default | งาน 1 |
| Create รับงานแล้วแต่ reply หาย/GET ไม่พบ | นับ POST ต้องเท่ากับ 1; resolve signature/ID เดิมและได้ resumable/unknown ตามจริง | งาน 2 |
| Edit carrier ผิด หรือ SSE จบไม่ครบ | ตรวจ multipart/JSON จริง; completed event เท่านั้นจึงสำเร็จ, EOF/Usage ไม่ผ่าน | งาน 2 |
| ได้ผลบางภาพหรือชื่อไฟล์ชน | actual count/bytes ถูก, ของเดิมไม่ถูกทับ, partial save ไม่ exit 0 และไม่ inference ใหม่ | งาน 2 |
| Pack/update ผิด owner, hash หรือ path | ปฏิเสธก่อน switch, config/custom/old install คงเดิม; remote technique ไม่ executable | งาน 3–4 |

ไม่ไล่ Cartesian product ของ models×formats×OS×errors, ไม่ตั้ง coverage % เป็นเป้าหมาย, ไม่เพิ่ม snapshot ของ copy ทุกบรรทัด, ไม่ review วนเมื่อคำถามเดิมมีหลักฐานแล้ว. Linux ที่รันจริงไม่ใช่ Windows/macOS proof; CI matrix จึงมีหน้าที่เพิ่มหลักฐานเฉพาะเซลล์ที่รันสำเร็จ

---

## งาน 1 — ตั้งค่า เลือก endpoint และอ่าน model list ได้โดยไม่กีดกัน custom

**สร้าง:** package/config example, CLI entry, `config.mjs`, `models.mjs`, `tests/config-models.test.mjs`

**Interfaces:** `resolveContext({cli, env, cwd, platform, homeDir}) → Promise<Context>`; `discoverModels(endpoint, {signal}) → Promise<ModelView>`; CLI `setup`, `models --json`, `generate|edit --dry-run` ใช้ผล canonical ชุดเดียวกัน. Dry-run แสดงแผนโดยไม่ POST; secret ไม่ออก stdout

- [ ] โหลด selected config และ validate fields/booleans ตาม schema; resolve paths แยก install/config/state/output และทำ setup แบบไม่ overwrite
- [ ] สร้าง endpoint bindings ตาม active-harness hints/env ที่รองรับจริง; หาก Codex/Grok ไม่ expose effective provider ให้รับ explicit hint/config ไม่อ่าน token store หรือเดา layered TOML
- [ ] รักษา proxy prefix และ normalize `/v1` boundary; validate HTTPS/custom local opt-in, credential scope และไม่ตาม auth redirect ข้าม origin
- [ ] อ่าน primary catalog แล้ว secondary ตามลำดับ; parse NodeClaw operation pairs และ `/v1/models` IDs, merge exact ID โดย unknown ไม่ทับ known; manual model/default unverified ใช้ได้แม้ discovery ไม่สำเร็จ
- [ ] ทำ preflight/dry-run ให้แสดง endpoint/model/operation/method/output และ unknown metadata ที่สำคัญ ไม่เลือก model อื่นเงียบ ๆ
- [ ] เขียน focused assertions ก่อนส่วนเสี่ยง: defaults+precedence/false; sequential calls+merge; unavailable/manual+prefix+credential isolation โดยใช้ fixtures เล็ก ไม่ดาวน์โหลด catalog ทั้ง production มาเก็บใน tests

**ตรวจ:** `node --test tests/config-models.test.mjs`; ต้องผ่าน และ dry-run ไม่มี inference POST. ขอบเขตนี้ยังไม่อ้าง Generate/Edit สำเร็จ

## งาน 2 — Generate/Edit และ Task-first ที่ไม่สร้างงานซ้ำ พร้อมบันทึกไฟล์จริง

**สร้าง/ต่อ:** `images.mjs`, `tasks.mjs`, `output.mjs`, CLI generate/edit/resume, `tests/image-flow.test.mjs`

**Interfaces:** `planImageRequest(context, spec) → Promise<ImagePlan>`; `executeDirect(plan, {signal}) → Promise<ImageResult>`; `runTask(plan, {signal}) → Promise<RunResult>`; `resumeTask(handlePath, context, {signal}) → Promise<RunResult>`; `saveImages(result, outputIntent, {signal}) → Promise<SaveResult>`. CLI เรียก Direct หรือ Task ผ่านแผนเดียว ไม่สร้าง HTTP client สอง authority

- [ ] ทำ Direct Generate JSON และ Edit multipart/local images/reference URL/mask รวม advanced JSON/native content ตาม supported profile; explicit unsupported option แจ้ง ไม่ลบทิ้ง
- [ ] ใช้ built-in fetch/FormData/Blob ชุดเดียว ให้ runtime สร้าง multipart boundary; Task JSON ห่อ `operation/request`, Task Edit multipart วาง `operation` ระดับเดียวกับ fields/files
- [ ] บังคับ finite Task request; Direct ขอ finite JSON เมื่อ profile รองรับ และรับ SSE ด้วย parser ของ complete records/operation completion ไม่ใช้ `[DONE]` หรือ EOF เป็น success
- [ ] จำกัด bytes ก่อน parse/decode รวม streamed responses และไฟล์ inputs ตาม profile; NodeClaw limits ใช้เฉพาะ NodeClaw ไม่กลายเป็น universal provider policy
- [ ] บันทึก actual b64/URL results แบบไม่ส่ง API auth ไป CDN; no-clobber/atomic publishing, ตรวจ actual format/count และคงไฟล์ที่สำเร็จเมื่อบางภาพล้มเหลว
- [ ] สร้าง UUID และ atomic user-state handle ก่อน Task POST; accepted 202/compatible duplicate 200 ใช้ Task เดิม, 409 หยุดโดยไม่เปลี่ยน signature
- [ ] Handle เก็บ endpoint/profile/operation/model/signature/taskId/output intent โดยไม่มี prompt/key/input image; resolve reply หายผ่าน signature GET และ known taskId ผ่าน ID GET เท่านั้น
- [ ] Poll queued/processing/reconciling พร้อม Retry-After/deadline/bounded GET retries; timeout/Ctrl-C คืน handle ไม่ cancel หรือสร้างใหม่; resume ใช้ original endpoint และ credential binding ที่ผู้ใช้ตั้งปัจจุบัน
- [ ] ใช้ fallback decision เดียวจาก contract: Direct-only profile resolve ก่อนส่ง, known-no-acceptance สลับได้หนึ่งครั้ง; auth/policy/invalid/identity conflict/unknown/expired ห้าม bypass; terminal opt-in แจ้งโอกาสคิดเงินสองรอบ
- [ ] เก็บผลสำเร็จที่ยัง save ไม่ครบใน private result recovery artifacts เท่าที่จำเป็น แยกจาก request handle; รักษา same-result save retry โดยไม่เก็บ secret/raw prompt และไม่ POST inference ใหม่
- [ ] ต่อ CLI JSON status/exit codes และ safe progress; pending/unknown/save_failed ไม่รายงาน saved
- [ ] ใช้ local HTTP scenario เดียวเป็นเส้นทาง CLI→request→Task polling→bytes→filesystem: อย่างน้อย Generate สำเร็จและ Edit multipart สำเร็จ พร้อม request-count assertions
- [ ] เพิ่มเฉพาะ failure branches ที่ป้องกันความเสียหายจริง: lost create reply/resolve miss ไม่มี POST ซ้ำ; terminal/reconciling/deadline; eligible fallback เทียบ refusal/unknown; partial URL/b64 save+collision; SSE completed เทียบ partial EOF. ใช้ตาราง assertions เมื่อ semantics เดียวกัน ไม่ทำเคสต่อ status ทุกตัว

**ตรวจ:** `node --test tests/image-flow.test.mjs` แล้ว affected package tests; local fake server ไม่มี paid Provider call. ต้องได้ภาพ fixture bytes จริงและ terminal/unknown semantics ตามที่ assert

## งาน 3 — Skill ใช้ง่าย และเพิ่ม technique workflows ผ่าน GitHub sync ได้

**สร้าง/ต่อ:** `SKILL.md`, `references/api-contract.md`, `content.mjs`, styles/techniques data, ส่วน manifest validation/staging ที่ใช้จริงใน `distribution.mjs`, `tests/content-distribution.test.mjs`

**Interfaces:** `loadTechnique(id, context) → Promise<Technique>`; `syncContent({kind, source, context}) → Promise<SyncResult>`; `fetchDocs(context, {refresh}) → Promise<DocsReference>`. คำสั่ง `styles list|show|sync`, `techniques list|show|sync`, `docs fetch|sync`. เริ่ม shared `validateManifest`/`stageRelease` ตาม signature ในงาน 4 เฉพาะส่วนที่ content sync ต้องใช้ในงานนี้ แล้วงาน 4 ใช้ต่อสำหรับ executable update ไม่เกิด forward dependency หรือ downloader/trust policy อีกชุด

- [ ] เขียน skill flow: first-run ใช้ค่าที่แนะนำ/ปรับ/ยกเลิก; ก่อนเสียเงินใช้หนึ่ง native form สรุปและสร้าง/ปรับ/หาแนว/ยกเลิก ไม่ถามสิ่งที่ผู้ใช้ระบุแล้ว
- [ ] รองรับ Claude Code/Codex ตาม tools จริง; Grok Bot อธิบาย current capability gap ไม่เดา install root/native form. Explicit automation ใช้ supplied config/spec + `--yes`; ยกเลิกไม่ส่ง inference
- [ ] แยก style = หน้าตา กับ technique = ลำดับทำงาน; แถม style เล็กน้อยที่มีประโยชน์ เช่น Tarot จาก prompt ที่ผู้ใช้ให้ พร้อม prompt เดิม/no style และ optional search โดย harness tools ไม่เพิ่ม LLM/search service
- [ ] Style preset กับ technique เป็นอิสระ ใช้ร่วมกันหรือใช้แยกกันได้ ไม่มี hardcoded style→technique mapping/allowlist. Text model เดิมเป็น orchestrator เลือกและเรียงเทคนิคตาม brief; CLI ตรวจเฉพาะ API/tool/data constraints ที่มีจริงและขอบเขตคำขอที่อนุมัติ ไม่เพิ่ม orchestrator service, planning engine หรือกฎตัดสินความเหมาะสมของงานศิลป์
- [ ] แต่ละ technique directory มี `technique.json` กับ `WORKFLOW.md`; metadata มี `schemaVersion`, `id`, `version`, `name`, `description`, `requires`, `parameters`, `workflow`. `workflow` ต้องเป็น relative Markdown ใน pack ไม่ใช่ shell/code entry
- [ ] `requires` ระบุ client/API/local-tool capabilities; skill ตรวจ prerequisites ก่อนเลือกทำ ไม่ถือว่าเขียน recipe แล้วเครื่องมีความสามารถนั้น. JSON parameters จำกัดชนิด/default/range ที่ recipe ต้องใช้ ไม่สร้าง DAG engine/template language หรือ `eval`
- [ ] Official pack index มี id/version/entry ที่ไม่ซ้ำ; GitHub versioned pack manifest กำกับแต่ละไฟล์ด้วย bytes/hash และ client compatibility. เพิ่มเทคนิคได้ทั้ง content-only GitHub sync และ full skill update ที่บรรจุ bundled packs รุ่นใหม่; ทำเป็นสองทางเข้าสู่ content owner เดียว ไม่เกิด official packs สอง authority. Config/state/custom packs อยู่นอก install payload; same custom ID ไม่ถูก official sync ทับ
- [ ] Sync จาก selected trusted repo/release เท่านั้น preview version/delta แล้ว apply เมื่อผู้ใช้เลือก; parse/render เป็นข้อมูล ไม่มี downloaded hooks/scripts, ไม่เปลี่ยน endpoint/auth/permissions และไม่ตาม repo ที่ข้อความใน prompt สั่ง
- [ ] ถ้า technique ใหม่ต้องใช้ CLI capability ที่ยังไม่มี ให้แสดงว่าต้อง executable update หรือเครื่องมือที่ผู้ใช้อนุมัติ ไม่แอบติดตั้ง dependency/โค้ดจาก pack sync
- [ ] Optional docs fetch แบบ public/unauthenticated มี byte cap, endpoint/provider binding, hash/time/ETag; ไม่มี docs ไม่ block custom. Cache เป็น reference พร้อม freshness ไม่ใช่ dynamic encoder หรือ route authority
- [ ] ทดสอบ load/list ของ bundled technique จริง + incompatible/tampered pack refusal/custom preservation; docs unavailable ไม่ block image plan. ตรวจ skill walkthrough สั้น ๆ สำหรับ first-run, explicit brief, cancel และ multi-call confirmation ไม่สร้าง LLM eval framework/review ทุกประโยค

### Technique แรก: Pixel Art แบบตัด–วาดรายละเอียดใหม่–ต่อกลับ

นี่คือ recipe จากเนื้อหาที่ผู้ใช้ paste ใน session ไม่ใช่ผลทดลองยืนยันแล้ว และไม่ใช่เพียงเติมคำว่า pixel art ใน prompt. Owner: `techniques/pixel-art-detail/technique.json` กับ `WORKFLOW.md`

- [ ] รับ PNG ที่ผู้ใช้เลือก หรือ Generate ภาพตั้งต้นหนึ่งครั้งแล้วให้ยืนยันองค์ประกอบก่อน; ไม่ต้องสร้างภาพใหม่ถ้ามีภาพที่พอใจแล้ว. สรุปค่าใช้จ่ายเป็น initial generation (ถ้ามี) + จำนวน tile edits ที่คำนวณจริง
- [ ] Default recipe scale `3`, แนะนำช่วง `2–3` ต่อรอบ; scale คือแต่ละด้าน ไม่ใช่จำนวนชิ้น. ใช้ supported output geometry จาก profile ไม่ hardcode `1254` หรืออ้างว่า GPT ทุกรุ่นจำกัด `1000–1500 px`
- [ ] คำนวณ tiles/overlap/edge padding พร้อมพิกัดจริงและ output size; preserve aspect ratio. ตัวอย่างไม่รวม overlap: 1024² กับ 2×2 ชิ้นที่คืน1024² → 2048²; 3×3 → 3072². หกชิ้นไม่เท่ากับขยายด้านละหก และห้าม stretch ให้กริด3×2เป็นภาพสี่เหลี่ยม
- [ ] Preflight เครื่องมือ local สำหรับ decode/crop/nearest resize/blur/float arithmetic/blend/alpha และ image-view เมื่อจะตรวจด้วยสายตา ก่อนส่ง paid tile edits; ไม่ถือว่า Node built-ins มี raster engine. ตรวจเครื่องพัฒนาครั้งนี้ไม่พบ `magick` จึงยังไม่อ้างว่า local cut/merge รันได้
- [ ] Recipe รองรับการใช้ image-processing tool ที่ harness มีจริงและผู้ใช้อนุญาต; ImageMagick 7 เป็น candidate ที่เอกสารยืนยัน crop/nearest มีได้ แต่ยังไม่เลือกเป็น dependency/ติดตั้งอัตโนมัติ. ถ้าไม่มี capability ให้หยุด technique นี้พร้อม prerequisite โดย core Generate/Edit และเทคนิคอื่นยังใช้ได้; ไม่เขียน PNG codec หรือเรียก Python ขัด stack
- [ ] แยกชิ้นเหลื่อมตาม recipe (เริ่มจากประมาณ25% แล้วคำนวณตาม geometry), nearest-neighbor เท่านั้นสำหรับขยาย inputs, ตั้งชื่อ row/column และบันทึก source dimensions/coordinates/scale/overlap; ไม่ overwrite ต้นฉบับ และข้ามเฉพาะบริเวณว่างที่ตรวจตรงเงื่อนไขที่เลือก
- [ ] แต่ละชิ้นส่งเป็น Edit พร้อม reference จริงและข้อความรักษารูปร่าง/ตำแหน่ง/กล้อง/แสง/สี เพิ่มเพียงรายละเอียด; ไม่ text-to-image ใหม่อิสระ. Task identity/recovery ใช้ client เดิม; recipe ไม่สร้าง queue/daemon หรือตัวส่ง API อีกตัว. เริ่มแบบ sequential เพื่อคุมต้นทุน ไม่สร้างหลายแชต/parallel workers โดยปริยาย
- [ ] Prompt template: `This is a crop of a pixel-art picture enlarged {{scale}}x. Redraw it at the same dimensions as crisp, finer pixel art. Keep every object's position, silhouette, composition, camera, colours and lighting. Do not add, remove or move objects. Preserve the specified alpha/background mask.` ใช้เฉพาะ values ที่มีจริง; prompt เป็นคำขอ ไม่ใช่ geometry guarantee
- [ ] เก็บผลด้วย tile ID เดิม; dimension mismatch ปฏิเสธ/ให้เลือก retry ไม่ resize ด้วย Lanczos เพื่อปกปิด. รักษา alpha หรือ mask ที่ผู้ใช้เลือก ไม่บังคับชมพู `#ff00ff` ทุกภาพและไม่ convert RGB แล้วทิ้ง transparency
- [ ] คืนสีด้วยแนวคิด `blur(original_scaled) + (edited - blur(edited))` บน geometry/color-channel ที่ align กัน เก็บ signed detail ก่อน clamp; alpha/mask แยกจาก RGB. Blur radius และ shift/mask/colour thresholds เป็น recipe heuristics ไม่ใช่เกณฑ์คุณภาพที่พิสูจน์ครอบจักรวาล
- [ ] ต่อเฉพาะชิ้นที่ตรวจรับแล้วด้วย overlap weights/ขอบที่เข้ากับ pixel grid; soft blend ไม่เท่ากับ pixel-dither และไม่รับประกันไร้รอยต่อ. Missing/rejected tiles ต้องแสดงชัดว่าบริเวณนั้นเป็น nearest-upscaled original ไม่แอบเรียกภาพว่า refined ครบ
- [ ] ส่งออก `refined-hires.png` ตาม scale จริง กับ `refined-original-size.png` ตามมิติต้นฉบับ. สำหรับ Pixel Art ใช้ nearest แบบ grid-aligned ในการย่อเป็น default ไม่ re-encode/filter โดยไม่บอก; ภาพย่อไม่เก็บรายละเอียดทุก pixel ของภาพใหญ่ และไม่อ้างว่ากู้รายละเอียดจริงที่สูญหายได้
- [ ] แสดงก่อน/หลังทั้งภาพและรอยต่อ100% เมื่อ vision tool มีจริง; ให้ผู้ใช้รับรองก่อนนำไปใช้. ถ้าต้อง redraw ให้เสนอเฉพาะ tile ที่เสียพร้อมจำนวน additional calls แล้วรอยืนยัน ไม่มี paid retry/refinement loop หรือ `--force` อัตโนมัติ

**Proof:** recipe metadata/load/workflow boundary ตรวจได้ใน package tests; ความเรียบร้อยของภาพต้องมี actual image/tool evidence ไม่ใช้ JSON validation แทน. Automated cut/colour/merge proof ยังเป็น `requires capability selection and availability` ไม่เพิ่มเป็น blockerปลอมของ core client และไม่อ้าง pixel pipeline live-verified. เมื่อเลือก local raster implementation ภายหลังให้ใช้หนึ่ง representative PNG round-trip ที่ตรวจขนาด/พิกัด/alpha/outputs ก่อนเพิ่มกรณีจาก failure จริง

## งาน 4 — ติดตั้ง อัปเดต และแพ็ก release โดยไม่ทับของผู้ใช้

**สร้าง/ต่อ:** shared `distribution.mjs`, `script/install.mjs`, `script/package-release.mjs`, plugin/marketplace metadata, verification CI และ tests กลุ่มเดิม

**Interfaces:** `validateManifest(manifest, {packageName, version, kind}) → ValidatedManifest`; `stageRelease(manifest, {source, stagingDir}) → Promise<StagedPayload>`; `installSkill({sourceDir, targetDir, expectedOwner, replaceConfirmed}) → Promise<InstallResult>`. `update check|apply` ใช้ helper เดียวกันกับ content sync; install mode เป็น authority ว่าใครอัปเดต code ได้

- [ ] ตรวจ current official harness docs เฉพาะ manifest/skill roots ที่จะใช้จริงก่อนเขียน metadata/installer; Claude/Codex roots ไม่ hardcodeจากความจำ และ Grok ไม่เดา path
- [ ] Installer preview harness/scope/target, check runtime, copy skill directoryครบใน explicit target; existing install ต้องตรวจ owner/version+ขอ replace authorization ไม่เขียน permission allowlist/parent env หรืออ่าน keys
- [ ] Plugin-managed code update ให้ native manager เป็นเจ้าของ; standalone updaterห้ามเขียน plugin cache. Preserve config/state/custom packs และ content-only sync ไม่ทับ executable code
- [ ] Versioned release JSON manifest มี package/version/kind และ `{path,asset,bytes,sha256}` ต่อไฟล์; asset name ไม่ชนแม้basenameเหมือนกันและอยู่ selected repo/releaseเดียว ไม่มี arbitrary per-file download origins
- [ ] Validate traversal/absolute/duplicate/case-collision/symlink/owner และ total sizes ก่อน staging; downloadครบและverifyทุกไฟล์ก่อน switch; failureเก็บ old installation, partial switchแสดง state และใช้ checked rollback ไม่ blind rerun
- [ ] Packaging scriptใช้ explicit source allowlist สร้าง archiveสำหรับmanual unpack และรายไฟล์assets+manifest/checksumsสำหรับupdater; ไม่รวม environment/config/handles/private captures/platform code. ไม่มี archive parser หรือ network bootstrap installer
- [ ] CIใช้ Node LTS/OS matrixที่ประกาศใน workflowและดูผลจริงก่อนอ้าง support; testบนminimum-supported Node behavior ไม่ใช้APIที่เพิ่งเพิ่มใน22รุ่นย่อยโดยไม่กำหนดengineให้ตรง ไม่มี secrets/paid APIในCI
- [ ] ทดสอบ clean standalone install ในtemp user targetแล้วเรียก `--help`/`models` fixtureจากinstalled payload; update vA→vB preserve config/custom; bad hash/path rejectionไม่เปลี่ยน old install. ใช้fixtureเล็กและshared verificationสำหรับpack sync ไม่ทดสอบ permutationsทั้งหมด

**ตรวจ:** `node --test tests/content-distribution.test.mjs`, `npm run check`, `npm test`, `npm run package -- --dry-run`. ต้องมีหลักฐานว่ารันจากinstalled/exported payloadได้ ไม่พึ่ง absolute source path; ไม่ติดตั้งทับ harness จริงเพื่อผ่าน source gate

## งาน 5 — ตรวจสิ่งที่ทำจริง แล้วจัด README/governed docs และ Add-On source ให้ตรงกัน

**แก้หลังงาน1–4ผ่าน:** `README.md`, existing design children/parent, `diagram/STRUCTURE.md`, changelog; downstream `<platform-root>/web-control-plane/frontend/src/pages/Docs.tsx` และ locales `en/docs.json`, `th/docs.json`

- [ ] Main ตรวจเฉพาะ changed ownersผ่าน Developer/Security/Architect lenses: request/resultครบ, keys/unknown-retryไม่รั่ว, one authority/no server. ไม่เรียก independent reviewerเพื่อreassurance; ใช้read-onlyผู้ช่วยเฉพาะunresolved claimที่เปลี่ยน accept/fix/block
- [ ] อ่าน completed/pending task evidenceแล้วรัน affected full package tests+syntax checksหนึ่งรอบ; แก้ required findingในownerเดิมแล้วrerunเฉพาะที่ได้รับผลกระทบ ไม่วนbroadaudit
- [ ] READMEเริ่ม install/setup/generate/edit/output แล้วจึง advanced config/fallback/styles/techniques sync/update/troubleshooting. ใช้คำสั่งที่รันจากpackaged payloadจริงและportable paths; ไม่อ้างnative form/OS/Grok/Pixel Artที่ยังไม่มีหลักฐาน
- [ ] Sync design/diagram/changelogครั้งเดียวตามผลที่นิ่งแล้ว แยก implemented/local-tested/published/unverified; เพิ่ม concrete technique contractเข้าฟิตติ้งexisting experience ownerโดยไม่ยัดrun logsหรือสร้าง designซ้ำ
- [ ] Add-Onใช้ existing `payg-addon`, title Add-On & Skill, preserving LINE AI Chatbot/optional companion semantics. เพิ่ม skill description Generate/Edit, setup/config และGitHub/release linksเฉพาะเมื่อready; ถ้ายังไม่publishใช้pending wording/ไม่เปิดdead install link
- [ ] ตรวจ locale JSON/IDs และ frontend affected TypeScriptด้วย existing `npm run typecheck:with-chat` จาก frontend root; ไม่รันbrowser suite/ทั้งplatformbuildเพียงเพิ่มdocs card ถ้ามีtypecheck failureให้แยกbaselineจากtouchederror ไม่แก้unrelatedทันที
- [ ] Final package claimsบอกsource/local testsที่ผ่าน, actual OS/runtime matrix, excluded paid/live/install/native UI/deploy และPixel Art local-tool prerequisiteอย่างตรงไปตรงมา

**Gate:** source/package outcomeปิดได้ด้วยchecksที่เลือก ไม่เอาproductiondeploy/paidgenerationมาขวางโดยอนุมาน. READMEพร้อมไม่เท่ากับpublicrepoพร้อม; docs sourceไม่เท่ากับเว็บไซต์deployแล้ว

## งาน 6 — เผยแพร่เฉพาะแพ็กเกจ เมื่อผ่าน publication gate

**Boundary:** downstream public repoเป้าหมาย `DarKWinGTM/Nodeclaw-Image-Gen`; ไม่มีสิทธิ์push platform/unrelatedfiles หรือใช้publicrepoเป็นdevelopmentroot

- [ ] ก่อนทำจริงตรวจ selected scope/visibility/version/tag/verified payload/secret exclusion และยืนยัน applicable repo-create/commit/push/release action scope; ถ้ายังไม่ครบหยุดเฉพาะpublication ไม่เปิดงานclientใหม่
- [ ] Main export verified allowlistจากcanonical package; ไม่nestedgitและไม่ใช้cloneเป็นimplementationlane. Commit/publishเฉพาะexportedpayloadที่ตรวจตรงsource พร้อม attributionตามsession
- [ ] Create/push/releaseและอัปโหลดmanifest/assets/checksumsเฉพาะที่อนุมัติ; unknown operation outcomeต้องreconcileก่อนลองซ้ำ ไม่สร้างrepo/release/tagใหม่เพื่อหนีtimeout
- [ ] ตรวจremoteversion/assets/checksums/marketplace linksหลังpublish; activate Add-Onpubliclinksตามreleaseจริงและรันเฉพาะaffectedchecksอีกครั้ง. Productionwebsite deploymentและpaidacceptanceยังเป็นแยกapproval ไม่ทำตามมาอัตโนมัติ

**Gate:** ถ้ายังไม่ได้ทำให้รายงาน `source/local verified; publication pending` ไม่เรียกreleaseเสร็จ. Windows/macOS/harnessnativeinstallation/PixelArtvisualqualityต้องคงlimitationsจนมีmatchingevidence

## การปิดแผนและการเริ่มงาน

แผนนี้เป็น route-only ภายในแพ็กเกจ ไม่แทน design target. งาน1–6เป็นรายการเตรียม execution; ไม่เริ่ม source code จากการเขียนแผนเอง. เมื่อเริ่มให้ Mainทำตามลำดับ พร้อม testsในงานนั้น ไม่สลับไปdocsyncหรือoptionalcleanupระหว่างflow

หลักฐาน API/framework อ้างจากdesignและ [Node.js22 globals](https://nodejs.org/docs/latest-v22.x/api/globals.html), [node:test](https://nodejs.org/docs/latest-v22.x/api/test.html); optional raster-tool candidateอ้าง [ImageMagick command-line options](https://imagemagick.org/command-line-options.php) ที่ยืนยัน crop และ nearest sampling ไม่ใช่installed/runtimeproof
