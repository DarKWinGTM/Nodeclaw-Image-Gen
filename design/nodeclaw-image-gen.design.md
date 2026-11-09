# Nodeclaw-Image-Gen: Design

> **Current Version:** 0.1.2
> **Status:** v0.1.2 address/key setup, native plugin bridge, explicit Gemini and additional styles source/local verified. Git push/release selected; publication and OS/Node proof are checked separately against the matching public revision
> **Session:** 30328a2c-b111-4518-970b-7cf10fc0832a
> **Full history:** [../changelog/nodeclaw-image-gen.changelog.md](../changelog/nodeclaw-image-gen.changelog.md)
> **Structure:** [../diagram/STRUCTURE.md](../diagram/STRUCTURE.md)
> **Chain shape:** Flat sibling shards, mapped below. Parent owns scope/evidence/proof; children own runtime contract and skill/distribution contract

## 1. เป้าหมายและขอบเขต

เครื่องมือเล็กสำหรับให้ text model ใน CLI/agent harness ช่วยออกแบบภาพ แล้วเรียก Image Generation/Edit API และบันทึกผลเป็นไฟล์ ผู้ใช้พูดความต้องการตามปกติ เลือกค่าที่แนะนำในฟอร์มสั้น และไม่ต้องเขียน API request เอง

NodeNetwork เป็น native default เสมอเมื่อไม่ได้ปรับแต่ง: provider profile `nodeclaw`, preferred model `gpt-image-2`, method `task`, gateway `https://payg.nodenetwork.ovh`. การอ่าน endpoint ของ harness มีลำดับก่อน default ตามหัวข้อ 5 ไม่ใช่การเปลี่ยน native product default เป็น provider อื่น

รองรับ custom endpoint/model แบบ opt-in แม้ไม่มี model catalog: OpenAI-compatible Images API, NodeClaw Task และ explicit native Gemini finite wire ผ่าน client เดิมตาม runtime §7. Native Gemini ใช้ configured customer Bearer endpoint ไม่อ้าง direct Google API-key transport หรือรองรับ API ทุก protocol โดยอัตโนมัติ

Source authority อยู่ที่ `<platform-root>/script/Nodeclaw-Image-Gen/`. Public repo เป้าหมาย `DarKWinGTM/Nodeclaw-Image-Gen` เป็น distribution จาก source นี้ ไม่ใช่ development root อีกชุด ไม่สร้าง nested Git repository ใน NodeClaw-platform

งานนี้ไม่เปลี่ยน Gateway, Main Core, billing, authentication หรือ Task infrastructure. การเพิ่มรายการในหน้า `/docs` เป็น downstream integration ที่แก้เฉพาะ existing docs owner เมื่อถึง implementation slice นั้น

## 2. การตัดสินใจด้านเทคโนโลยี

ใช้ **Node.js 22+ ที่ยังอยู่ใน support window**, แนะนำ current supported LTS และทดสอบ release บน LTS matrix ที่ประกาศจริง ใช้ JavaScript ESM `.mjs`, JSON config และ Markdown skill/reference files. API client ใช้ built-ins; local technique tools ใช้ bundled pure-JavaScript pngjs 7.0.0 พร้อม MIT license โดยไม่ต้อง npm install ที่ปลายทาง. ไม่มี TypeScript compilation, Python runtime, native raster binary, daemon, database, browser app หรือ MCP server ใหม่

Node.js เหมาะกับคำขอนี้เพราะมี `fetch`, `FormData`, `Blob`, `AbortSignal`, filesystem/path, crypto, `util.parseArgs` และ `node:test` ในตัว โดยผู้ใช้เลือกไม่ใช้ Python. นี่เป็นการเลือกตาม fit และ preference ไม่ใช่ข้อสรุปว่า Python ไม่เสถียรโดยทั่วไป

ใช้ built-in `fetch` และ `FormData` คู่เดียวกัน ไม่ผสม implementation. เมื่อส่ง multipart ให้ runtime สร้าง boundary ไม่ตั้ง `Content-Type: multipart/form-data` แบบขาด boundary เอง หลีกเลี่ยง runtime API ที่ยัง experimental ใน minimum version ที่รองรับ

| ส่วน | ความรับผิดชอบ |
|---|---|
| `SKILL.md` | สนทนา, native choice form, ตีความ brief, เสนอ style/technique, เรียก script และอธิบายผล |
| CLI script | Config, endpoint/auth binding, catalog, request encoding, Task polling/rejoin, Direct response, download/save, diagnostics |
| JSON config | ค่า default และ override ของผู้ใช้ แยกจาก installation payload |
| Style/technique files | ข้อมูลเสริมที่โหลดเฉพาะเรื่อง เพิ่มและ sync ได้โดยไม่แก้ HTTP client |
| Release/plugin metadata | Distribution, install/update และ compatibility declarations |

ไม่บังคับหนึ่งไฟล์ตลอดไป แต่แยก module เฉพาะความรับผิดชอบที่มีขอบเขตจริง เช่น API execution กับ install/update ไม่สร้าง framework, dynamic executable plugin registry หรือ adapter class ต่อโมเดล

## 3. หลักฐานและ API contract ที่ตรวจแล้ว

Canonical platform contract อยู่ที่ `<platform-root>/api-service/payg/frontend/openapi/payg-gateway.v1.yaml` (platform source context; ไม่ใช่ไฟล์ใน standalone repository). Public reference: [PAYG OpenAPI](https://nodenetwork.ovh/docs/api/payg/openapi/payg-gateway.v1.yaml). การ fetch ระหว่างออกแบบได้ YAML `openapi: 3.1.0`, `info.version: 1.2.0` จาก URL ที่ผู้ใช้เลือก:

`https://claw-frontend-dev.nodenetwork.ovh/docs/api/payg/openapi/payg-gateway.v1.yaml`

| เรื่อง | Checked contract |
|---|---|
| `/v1/models` | ปัจจุบันเป็น public Chat projection; `capabilities: [chat.completions]` ไม่ยืนยัน Image support |
| NodeClaw image catalog | Main Core `GET /api/payg-model-data`, คนละ origin/role กับ PAYG inference |
| Direct Generate | `POST /v1/images/generations` |
| Direct Edit | `POST /v1/images/edits`, JSON หรือ multipart ตาม profile |
| Task Create | `POST /v1/media/tasks`, Generate/Edit ใช้ Task protocol เดียวกัน |
| Task resolve | `GET /v1/media/tasks` พร้อม original `request-signature`, ไม่ใช่ list |
| Known Task read | `GET /v1/media/tasks/{taskId}` |
| Authentication | NodeClaw customer Bearer key; signature ไม่ใช่ credential |
| Direct Recovery | ใน OpenAPI เป็น preview/not enabled ไม่ใช้เป็น runtime capability |

ตรวจ public development catalog ที่ `https://claw-backend-dev.nodenetwork.ovh/api/payg-model-data` แบบ bounded read สำเร็จ HTTP 200 และพบ `gpt-image-2`, `gpt-image-2.5`, `gpt-image-2.5-flare`, `gpt-image-2.5-sunburst`. ทั้งสี่มีคู่ `image_generation/openai_image_generations` และ `image_edit/openai_image_edits`. นี่เป็น catalog observation ไม่ใช่ live generation, per-key permission หรือ financial proof

Client เดิมที่ `<workspace-root>/claude-code-media-generator/image_gen.py` (historical local source context; ไม่แจกใน standalone repository) ใช้ Python/requests และ CLIProxyAPI Chat wire พร้อมค่าตายตัว จึงใช้เป็น historical reference เท่านั้น ไม่คัดลอก endpoint, credential placeholder หรือ daemon architecture มาใช้

## Active design map

Parent นี้เป็น authority/entrypoint ของ design chain ไม่ใช่ runtime implementation. แยกเป็น flat sibling shards ตามสอง contract families เพื่อลด read cost โดยไม่แยกหนึ่งไฟล์ต่อ feature

| Slice | Active owner | เนื้อหา |
|---|---|---|
| 1–3 | เอกสารนี้ | เป้าหมาย, stack, ขอบเขตและ checked API evidence |
| 4–9 | [Runtime and API contract](nodeclaw-image-gen-runtime.design.md) | Config, endpoint/model discovery, Generate/Edit, Task/resume/fallback |
| 10–16 | [Skill experience and distribution](nodeclaw-image-gen-experience.design.md) | Choice wizard, styles/techniques, optional docs, files/privacy, packaging/update, Add-On docs |
| 17–19 | เอกสารนี้ | Verification, next-stage gate และ requirement coverage |

ทั้งสอง child เป็น active target truthและbacklinkมาที่parent ไม่ใช่history. [Structure](../diagram/STRUCTURE.md) แสดงconnections; [changelog](../changelog/nodeclaw-image-gen.changelog.md) เก็บversion/history

## 17. Verification และ completion gates

**Current slice:** `new_focused_test` สำหรับ client/content/install/update source และ local HTTP/filesystem scenarios ด้วย `node:test`. CLI→local HTTP→actual image bytes, saved Task identity/resume, content integrity และ isolated installed payload มีหลักฐาน local แล้ว ไม่ใช่ paid/live/provider/native-form proof. คำสั่งจริงและขอบเขตอยู่ [README](../README.md) กับ task evidence; ไม่สร้าง TestKit runner หรือ platform-suite assignment เพิ่ม

**Implementation route:** `new_focused_test` + local HTTP scenario ที่ตรวจ request counts และ actual files ด้วย `node:test`. Test doublesอยู่ test boundary ไม่ใช่ fake mode ของ Product. Developerเป็นผู้ทดสอบเอง ไม่มอบให้ separate platform Test suite โดยอัตโนมัติ

| กลุ่มพิสูจน์ | สิ่งที่ต้อง assert |
|---|---|
| Config/endpoint | Defaults, CLI/env/config precedence, explicit false, harness binding, native fallback, custom/no-catalog admission, preserved proxy prefix, cross-origin key isolation |
| Catalog/spec | Sequential primary→secondary calls, primary-only/secondary-only/both/neither, exact-ID dedupพร้อมprovenance, endpoint-scoped metadata conflicts, NodeClaw exact Generate/Edit pairs, listed-but-no-permission distinction, missing/partial catalogไม่กลายเป็นabsence, manual model, unsupported optionsไม่ถูกลบทิ้ง |
| Task | UUID durableก่อนPOST, 202/duplicate200/409, lost-response signature GET, known-ID polling, Retry-After/deadline, reconciling, 404/503 unknownไม่POST, Ctrl-C/resume |
| Fallback | Known-no-acceptance vsunknown, no auth/policy bypass, exactly bounded method switch, terminal opt-in/cost warning, no inference for download failure |
| Direct Generate/Edit | JSON/multipart byte/part correctness, reference/mask optionality, provider-specific controls, b64/URL, actual item count, SSE completion/partialEOFและunknown timeout |
| Files/security | Space/Thai paths, no overwrite, partial file handling, format/extension, bounded response/decode, no key/raw-prompt in ordinary output/cache/release |
| Docs/styles/update | Reference fetch without auth, unavailable/cache freshness, remote contentไม่exec, compatible sync, custom preservation, updater owner by install mode |
| Harness/release | Fresh-reader trigger/wizard/default/skip scenarios, available native forms only, plugin manifest validation, allowlisted archive/install smoke and supported OS/LTS matrix |

OS support เป็นเป้าหมาย Windows/macOS/Linux; release ระบุเฉพาะ OS/runtime ที่ทดสอบจริง ไม่เรียก Linux pass ว่า Windows verified. Native Claude/Codex/Grok Bot UX แต่ละตัวต้องมีหลักฐานของตัวเอง. Grok Bot packaging/native-choice integration เป็น integration gate ที่ยังต้องพิสูจน์ ไม่แทนด้วย Grok Build docs หรือ private-session extraction

Source/local proof ปิด implementation gate ได้เมื่อ selected checksครบ. Real paid generation/Edit, installed harness UI, GitHub publication และ production docs deployment เป็น proof/action คนละ layer; ไม่สร้าง unavailable live blockerให้ source goalและไม่เรียก fake/local pass ว่า live-verified. เฉพาะ deliverableที่ผู้ใช้เลือกในรอบพัฒนาเท่านั้นที่เป็น terminal gate

Previous v0.1.1เพิ่มshippedPNGtechniquetoolsตามexperience§11: realprepare→existingEditspecplanner→check/merge,colour/alpha/mask/overlap/twooutputsผ่านlocaltests. Existingclient/installregressionsรวม26casesผ่าน; syntax/JSON/packageและdownstreamFrontendtypecheckผ่าน. PublicationและOS/Nodeproofดูmatching[release](https://github.com/DarKWinGTM/Nodeclaw-Image-Gen/releases/tag/v0.1.1)/[CI](https://github.com/DarKWinGTM/Nodeclaw-Image-Gen/actions/workflows/verify.yml)ของrevisionที่เลือก ไม่ยืมv0.1.0six-cellCIมาอ้างกับnewhelper. No paid inference/visualquality/harnessinstallation/deploy claim

v0.1.2 เพิ่ม private address/key setup, direct installer parameters, native userConfig/SessionStart bridge, explicit Gemini wire และ installed-path config/update commands. Focused local proof ครอบคลุม credential binding/serialization/masking/shell literals, actual HTTP/image files และ no-replay. ผู้ใช้เลือกแปลง supplied collections เป็น 55 additional styles ตาม entry schema เดิม รวม bundled 58 presets พร้อม sample URLs; ต้นฉบับคง bytes/modes ใน `references/style-imports/` นอก active discovery และ content-sync payload ไม่มี loader ใหม่หรือผ่อน validation. Initial collection-schema failure ถูกแก้ที่ data owner หลัง user selection; full package 37/37 tests ผ่าน, syntax/JSON 41 scripts/68 JSON, package dry-run 123 files/62 content ผ่าน. Exact plugin/marketplace schemas, EN/TH/README prompt parity และ frontend typecheck ผ่าน; directory license/icon ไม่ใช่ self-hosted marketplace gate. Git push/release เป็น selected continuation แยกจาก source proof และตรวจผลจาก matching public release/CI; actual harness/keychain, paid calls, visual acceptance และ website deploy ไม่ได้ selected.

## 18. ลำดับงานหลัง review และข้อยกเว้น

ผู้ใช้เลือก execution จาก [implementation plan](../docs/superpowers/plans/2026-11-09-nodeclaw-image-gen.md) แล้ว Main สร้าง client/skill/packs/install/update ใน selected subtree โดยไม่เปลี่ยน platform inference/catalog routes. Source/local checks และ exported-package install smoke มีหลักฐาน; README และ Add-On source สะท้อนความสามารถกับข้อจำกัดตามจริง

เผยแพร่ [public repository](https://github.com/DarKWinGTM/Nodeclaw-Image-Gen) และ [v0.1.0 release](https://github.com/DarKWinGTM/Nodeclaw-Image-Gen/releases/tag/v0.1.0) แล้วจาก 31-file allowlist; tag ตรง commit `8df6b37c9dc849e9a52da09b051c2983a09308a4`. Remote assets 35 ไฟล์มี size/SHA-256 ตรงชุด local; actual public updater download/staging ของ code 31 ไฟล์และ content 7 ไฟล์ผ่าน และ code bytes ตรง canonical source

Historical v0.1.0 [CI run 42533452340](https://github.com/DarKWinGTM/Nodeclaw-Image-Gen/actions/runs/42533452340) ผ่านทั้งหกเซลล์ Windows/macOS/Linux × Node.js 22/24: ESM/JSON checks, 20 tests และ packaging dry-run. Initial macOS failure เกิดจาก test temp path ผ่าน symlink; แก้ test ให้ใช้ realpath โดยไม่ลด installer guard. Add-On source เปิด GitHub/release links แล้ว; ไม่ใช่ website deployment. ในrevisionนั้นยังไม่มีautomated Pixel Art cut/merge; current0.1.1localtoolproofอยู่หัวข้อ17. Grok Bot/native formsและpaid inferenceยังไม่อ้างverified

รอบ design เดิมไม่สร้าง phase/Patch/durable TODO เพราะเป็น outcome เดียว. Execution ปัจจุบันใช้ implementation plan และ live tasks ตามผลลัพธ์จริง ไม่รวมเข้ากับ Main Core designหรือสร้าง phaseต่อไฟล์

ข้อจำกัดที่ไม่ขวาง core design: production catalog/docs servingยังไม่ตรวจ; Grok Bot import/native-form/runtime-env integrationยังไม่พิสูจน์; artifact techniquesยังอ่านไม่ได้; remote provider capabilities/chargesไม่พิสูจน์ด้วยcatalog. ข้อจำกัดเหล่านี้ต้องคงอยู่ใน README/release claimsที่เกี่ยวข้อง ไม่ถูกลบด้วยการมี designครบ

## 19. Requirement map

| ข้อกำหนดผู้ใช้ | Owner section |
|---|---|
| Model/configurable output/default GPT Image 2 | 4, 6, 7, 13 |
| Harness endpoint → configured NodeClaw endpoint → native PAYG | 1, 5 |
| NodeNetwork native default + custom provider/manual model without catalog | 1, 5, 6 |
| Generate/Edit + image specification | 3, 7 |
| Task default/automatic checking/Direct selection/fallback toggles | 4, 8, 9 |
| Config file, env overrides, minimal Node.js stack | 2, 4 |
| Easy wizard/native Q&A/defaults/few questions | 10 |
| Same text model controls image generation | 2, 10 |
| Optional style suggestions/search/custom additional styles/techniques | 11 |
| GitHub code and technique updates, release, Claude marketplace | 12, 15 |
| Optional provider-specific API docs; NodeClaw uses existing public YAML, custom providerไม่ต้องมีYAMLนี้ | 3, 12 |
| Add-On > Add-On & Skill in NodeNetwork docs | 16 |
| Source/design under own platform script package; design before development | 1, 18 |
| Easy README, public repo/push/release as later deliverables | 15, 17, 18 |
