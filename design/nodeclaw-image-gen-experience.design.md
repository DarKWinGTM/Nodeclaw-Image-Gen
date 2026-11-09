# Nodeclaw-Image-Gen: Skill Experience and Distribution

> **Current Version:** 0.1.2
> **Status:** v0.1.2 private setup/native bridge, additional styles and two-option Docs source/local verified; 37 package tests passed. Git push/release selected, actual native harness/keychain acceptance remains outside scope
> **Session:** 30328a2c-b111-4518-970b-7cf10fc0832a
> **Parent Design:** [nodeclaw-image-gen.design.md](nodeclaw-image-gen.design.md)
> **Full history:** [Design history](../changelog/nodeclaw-image-gen.changelog.md)
> **Scope:** Wizard, styles/techniques, optional API docs, file/privacy boundary, CLI, distribution and downstream docs. Section numbers continue the parent map

## 10. Wizard และพฤติกรรม smart

Smart หมายถึงใช้ข้อมูลที่มีลดงานผู้ใช้ ไม่ใช่เพิ่ม agent/service หรือถามทุก field. Skill ใช้ text model เดิมจัด brief, เลือกข้อมูลที่ยังขาด, เสนอ style และสร้าง spec; script ทำ deterministic validation/execution ไม่มี text-model API เพิ่ม

First run: ตรวจ runtime/config/env แบบไม่เผย key แล้วแสดง “ใช้ค่าแนะนำทั้งหมด”, “ปรับตั้งค่า”, “ยกเลิก”. Native defaults พร้อมใช้งาน ยกเว้น credential และเนื้อหาภาพที่ยังไม่มีไม่สามารถสร้างค่าปลอมให้ได้. อธิบายวิธีตั้ง credential อย่างปลอดภัย ไม่ขอให้ paste key ลง chat

ก่อน Generate/Edit ปกติใช้หนึ่ง native question form พร้อม summary และ choices เช่น “สร้างตามนี้”, “ปรับรูปแบบ”, “หาแนวเพิ่ม”, “ยกเลิก”. ถ้ามีช่องที่จำเป็นจริงค่อยรวม 2–3 questions ใน form เดียว. ไม่ถาม model/path/spec ซ้ำที่ brief/config ระบุแล้ว. Advanced settings ซ่อนไว้หลัง “ปรับตั้งค่า” และยกเลิกต้องไม่ส่ง inference

Summary แสดง operation, model, style/spec ที่ resolve แล้ว, endpoint/provider, method/fallback และ output path. Credentials ต้องไม่ปรากฏ. Endpoint เปลี่ยนหลัง preflight, quantity เพิ่ม หรือ paid multi-step technique ต้องยืนยันเฉพาะผลกระทบที่เปลี่ยน ไม่เริ่ม questionnaire ใหม่ทั้งหมด

| Harness | ขอบเขตการออกแบบ |
|---|---|
| Claude Code | `SKILL.md` + supporting scripts; ใช้ `AskUserQuestion` เมื่อมีใน interactive session |
| Codex | Agent Skills + CLI; native `request_user_input` ขึ้นกับ tools/mode/version ที่เปิดใน turn จริง ไม่ฝืนเปลี่ยน mode เพื่อให้มี tool |
| Grok Bot | ผู้ใช้เลือก Grok Bot ไม่ใช่ Grok Build. Official docs ยืนยัน skills/cloud computer แต่ยังไม่ยืนยัน file import/script packaging/native-choice integration ของแพ็กเกจนี้ |

Skill ไม่สร้าง native tool ที่ harness ไม่มี. ถ้าผู้ใช้กำหนด no-typing choice UX แต่ harness ไม่มี capability ต้องบอกว่า interactive path ยังไม่รองรับ ไม่ปลอม numbered text ให้เหมือน native form. Explicit noninteractive CLI ใช้ supplied spec/config + `--yes` ได้โดยไม่ถาม แต่ต้องเป็นการเลือก automation จริง ไม่ใช่ default ข้ามการยืนยัน

Path คือ filesystem ของเครื่องที่ script รัน; Grok Bot cloud path ไม่ใช่ local desktop path โดยอัตโนมัติ. ห้ามดึง desktop credentials หรือ private app API เพื่อสร้าง compatibility ที่ยังพิสูจน์ไม่ได้

หลังสร้าง หาก harnessมีimage-view/vision tool ให้ตรวจภาพเทียบbriefได้โดยไม่เรียกgenerationเพิ่มเอง. ถ้าไม่มี ให้ยืนยันเฉพาะไฟล์/format/resultที่ตรวจได้ ไม่อ้างว่าภาพสวยหรือตรงreferenceด้วยสายตา. การแก้รอบใหม่ใช้ข้อเสนอที่ผู้ใช้เลือก ไม่ทำautomatic paid refinementloop

Referenceพื้นฐาน: [Claude Code skills](https://code.claude.com/docs/en/skills), [Claude plugin CLI](https://code.claude.com/docs/en/plugins/cli-reference), [Codex skills](https://developers.openai.com/codex/skills), [Grok Bot skills](https://docs.x.ai/grok-bot/skills-routines-and-automations). เอกสารเหล่านี้บอกcapability/รูปแบบ ไม่แทนหลักฐานติดตั้งแพ็กเกจนี้

## 11. Style และ technique เพิ่มเติม

Styles เป็นภาพลักษณ์ เช่น Tarot ink, Sketch, Film strip; techniques เป็นวิธีจัด prompt/แก้ภาพ เช่น รักษาตัวละคร, คงองค์ประกอบเดิม, จัด typography หรือทำหลายขั้นโดยผู้ใช้อนุมัติ. Style กับ technique ใช้ร่วมกันหรือแยกกันได้อิสระ ไม่มี hardcoded pairing/allowlist; text model เดิมเป็น orchestrator เลือกและเรียง workflow ไม่เพิ่มบริการ orchestrator. Preset ไม่ได้เพิ่ม capability ที่ model/API ไม่มี

เสนอ style ที่ตรง brief เพียง 2–3 แบบ พร้อม “ใช้ prompt เดิม/ไม่เลือก style”. Search เป็นทางเลือก ใช้ web/search tools ของ harness ถ้ามี ไม่เพิ่ม search service หรือส่ง private prompt ทั้งหมดไป search engine. ไม่มี network/search ก็ใช้ local styles และ prompt ของผู้ใช้ได้

ตัวอย่างโครงข้อมูล style จาก Tarot prompt ที่ผู้ใช้ส่ง ไม่ใช่ภาพที่สร้างหรือเทคนิคที่ตรวจจาก artifact link:

```json
{
  "id": "tarot-ink",
  "name": "Tarot card",
  "description": "ไพ่ทาโรต์ลายเส้นหมึก สีแบน และผิวกระดาษพิมพ์",
  "tags": ["illustration", "tarot", "print"],
  "promptTemplate": "Create a tarot card depicting {{subject}} in the classic Rider-Waite style. Use bold imperfect black ink linework, flat colors without shading, subtle symbolic elements, paper texture and a printed feel.",
  "defaults": {"aspectRatio": "auto"},
  "referenceImage": "optional"
}
```

ไม่คัดลอกประโยค “what you know about me” เป็นสิทธิ์เปิดเผย memory/ข้อมูลส่วนตัวทั้งหมด เติมเฉพาะบริบทที่ผู้ใช้เลือก. รูปอ้างอิง optional เป็นค่าเริ่มต้นของ preset นี้ ถ้าต้องรักษา likeness ต้องมีรูปหรือคำอธิบายที่เหมาะสมและเลือก Edit profile จริง

Official packs เป็น versioned data จาก selected GitHub release; user packs อยู่ user config/data directory แยก namespace. เพิ่มผ่าน content-only GitHub sync หรือ bundled packs ใน full skill update โดยใช้ content owner/version selection เดียว. Technique มี `technique.json` + `WORKFLOW.md` และเรียก shipped tools สำหรับขั้นตอน deterministic แทนการให้ model เขียน processing scripts ใหม่. Model เลือก brief/style/technique, ขออนุมัติ inference และประเมินภาพ; tools รับผิดชอบ preparation, geometry, validation และ local processing. ไม่มี executable hook/DAG engine หรือ orchestrator service ใหม่

Executable helpers เป็น source ใน skill `scripts/` และมากับ verified full skill update เท่านั้น. Content-only sync ยังรับเฉพาะ JSON/Markdown; metadata ระบุ minimum client version และ known tool ID ไม่ใช่ script path ที่ download แล้ว execute. Synced official ID ไม่ทับ `custom:<id>` เงียบ ๆ. Content ไม่เปลี่ยน endpoint/secret binding และไม่อนุมัติ install หรือ paid calls

**Pixel Art tools:** existing CLI เพิ่ม `techniques prepare|check|merge pixel-art-detail`. `prepare --image PNG --work-dir DIR` ใช้ bundled pngjs 7.0.0 (MIT, pure JavaScript, pinned verified npm source) กับ local raster module; ไม่ติดตั้ง Python/ImageMagick/npm dependency ที่เครื่องผู้ใช้. รับ single-frame non-interlaced 8-bit PNG, bounded input 32 MiB/16 megapixels, target ไม่เกิน16 megapixels, tile ไม่เกิน2048ต่อด้านและ64ชิ้น. Default scale3, tile1024², overlap0.25, colour sigma2 original pixels. API-supported tile size ต้องเลือกตาม profile ไม่ถือ default เป็น capability proof

Prepare สร้าง work directory ใหม่แบบ exclusive พร้อม source snapshot/hash, optional protection-mask snapshot, `job.json`, nearest-neighbor tiles, transparent right/bottom padding และ per-tile Edit specs ที่ใช้ clientเดิม. Tile origins align กับ source pixel grid; manifest เก็บ canonical target coordinates/valid regions, actual stride/overlap, IDs และ skipped fully transparent/protected tiles. Mask alpha255รักษาต้นฉบับ, alpha0แก้ได้, ค่ากลางผสม; API mask มี alpha semantics เดียวกัน. ไม่มีสี key เช่นชมพูที่เดาเอง. Summary แสดงจำนวน paid Edit ที่ต้องอนุมัติก่อนรัน ไม่มี HTTP หรือ API key ใน local helpers/specs

`check --job FILE` revalidates source/mask hashes, canonical geometry, actual PNG dimensions และ missing/invalid tile IDs; dimensions ผ่านไม่ใช่ semantic/visual acceptance. `merge --job FILE` ปฏิเสธ incomplete โดย default, คืน low-frequency original + signed high-frequency edited ด้วย three-box Gaussian approximation (sigma scaledตามscale), clamp หลัง arithmetic, alpha แยกจาก RGB และ alpha-aware blur. วางตาม saved geometry และ linear overlap weights; protection mask คืนสี/alphaเดิม. Default preserve original alpha; explicit false ใช้ edited alpha. ส่ง `refined-hires.png` กับ grid-aligned nearest `refined-original-size.png`, ไม่ overwrite. `--allow-partial` เท่านั้นจึงสร้าง `partial-hires.png`/`partial-original-size.png` พร้อม missing IDs และใช้ original ในบริเวณที่ขาด. ไม่มี seamless/actual lost-detail recovery guarantee หรือ automatic paid redraw

**Preserve-composition tools:** `techniques prepare preserve-composition` snapshot source/optional API mask, validate matching dimensions และสร้าง one-call Edit spec จาก change/preserve constraints; `check` ตรวจ actual result dimensions/alpha diagnostics เทียบ source. ใช้ raster module และ Image Edit client เดียวกัน ไม่เพิ่ม transport. Visual geometry/object preservation ยังต้องให้ผู้ใช้หรือ vision tool ตรวจ ไม่ใช้ numeric checks อนุมัติ paid retry

[Pixel Art workflow](../skills/nodeclaw-image-gen/techniques/pixel-art-detail/WORKFLOW.md) และ [composition workflow](../skills/nodeclaw-image-gen/techniques/preserve-composition/WORKFLOW.md) ต้องอธิบายคำสั่งที่มีจริงเป็น English base. Source/local proof ใช้ real PNG fixtures ผ่าน prepare→existing Edit-spec planner→check/merge, ตรวจ dimensions/placement/alpha/mask/colour และ failure/no-overwrite; ไม่ส่ง paid API หรืออ้าง visual quality ก่อนมีหลักฐาน

**Additional styles selected for v0.1.2:** ผู้ใช้ให้ `styles.json` กับ `init.json` เป็น prompt collections และเลือกแปลงเป็น additional presets ตาม schema เดิมแบบหนึ่งไฟล์ต่อ style. รวมตาม exact ID; curated items ที่ซ้ำกันไม่สร้าง preset อีกชุด. Mapping คือ `title` → `name`, `description` → `description`, `prompt_text` → `promptTemplate`; optional `prompt_hints` เป็น guidance data และ `exampleImages[]` เก็บ URL/alt/ขนาดที่ต้นฉบับระบุ. Example URL เป็นภาพแสดงแนวทาง ไม่ใช่ API reference input, media redistribution หรือสิทธิ์ดาวน์โหลด/ส่งภาพอัตโนมัติ. ไม่ import `action`, `auto_send`, `system_hints`, thinking flags หรือ inferred model capability เข้า execution. ข้อความที่ชวนใช้ personal memory ปรับให้ใช้เฉพาะ subject/context ที่ผู้ใช้ให้และอนุมัติใน request นี้. `tarot-ink` เดิมเพิ่ม sample URL จาก Tarot collection โดยไม่เปลี่ยน prompt เดิม. ต้นฉบับย้ายแบบ byte/mode-preserving ไป `references/style-imports/` เป็น reference-only ไม่อยู่ style/content-sync discovery และไม่มี runtime fallback ไปอ่าน; preview ที่ไม่มี prompt คงเป็น reference ไม่สร้าง prompt เอง. ใช้ `content.mjs` และ content-only/full-release owners เดิม ไม่มี loader/registry/transport ใหม่.

Skill เสนอให้บันทึก style ที่ผู้ใช้ชอบได้ แต่ไม่จำเป็นต้อง save/เลือก preset เพื่อสร้างภาพ. Multi-call technique ต้องแสดงจำนวน/ลำดับคำขอและผลกระทบค่าใช้จ่ายก่อน ไม่เพิ่ม requests เงียบ ๆ. รองรับ still-image styles ไม่ถือชื่อ preset “GIF” เป็นการรองรับ animation

Claude artifact link ที่ส่งมาตอนเริ่มให้เพียง app shell ในการอ่านครั้งนี้ จึงยังไม่ยืนยันเนื้อหาเทคนิคจากลิงก์นั้น. ไม่บล็อก core design; เทคนิคเฉพาะจาก artifact จะเพิ่มเมื่อมี exported/pasted content ที่อ่านได้

## 12. Additional API docs fetch/sync

**API docs เป็น optional/additional reference ไม่ใช่ precondition ของ setup, model discovery หรือ Generate/Edit.** Custom provider อาจไม่มี OpenAPI/YAML หรือใช้เอกสารรูปแบบอื่นได้ ไม่กำหนดว่าทุก provider ต้องมี `payg-gateway.v1.yaml` และไม่เอา NodeClaw docs ไปเป็น contract ของ provider อื่น

NodeClaw profile ใช้ existing public YAML route เมื่อผู้ใช้ต้องการอ่าน/refresh reference ไม่เพิ่ม Main Core endpoint หรือ `.md` route ที่ซ้ำหน้าที่. Frontend build owner มี route `/docs/api/payg/openapi/payg-gateway.v1.yaml`; source YAML ยังคงอยู่ใน platform ไม่คัดลอกมาเป็น schema authority ของแพ็กเกจใหม่

Custom profile รับ `apiDocsUrl` ของตนเองหรือปล่อย null ได้. ถ้าไม่มี URL ข้ามการ fetch โดยไม่ warning ซ้ำทุกครั้งและไม่ block execution. ไม่ probe NodeClaw YAML filename บน custom host และไม่ fetch docs ทุกครั้งก่อนส่ง request

`docs fetch`/`docs sync` ใช้ configured/profile public URL แบบ unauthenticated และเก็บ bounded text พร้อม source URL, provider/endpoint binding, fetched time, hash และ ETag/Last-Modified เมื่อมี. YAML/JSON/Markdown เป็น reference content ที่ text model อ่านได้ ไม่ต้องเพิ่ม YAML parser เพื่อแสร้งทำ dynamic schema execution

Ship `references/api-contract.md` เป็น normalized **NodeClaw-specific** guide ที่อ้างอิง canonical source/current docs และแยก preview ชัดเจน; common OpenAI-compatible usage เป็นอีกขอบเขตหนึ่งใน guide ไม่อ้างว่า behavior ทุกอย่างเท่ากับ NodeClaw. Remote docs ไม่สร้าง routes, เปลี่ยน payload encoder, endpoint, config หรือรันโค้ดอัตโนมัติ. เมื่อ contract เปลี่ยน ให้สรุป delta; compatible metadata/reference update sync ได้ ส่วน behavior change ต้องแก้ clientและทดสอบผ่าน release flow

Fetch fail ใช้ last successfully fetched matching-provider reference หรือ bundled guide ที่ใช้ได้พร้อมระบุ freshness. ไม่มี matching reference ก็ใช้ explicitly configured supported protocol/manual request ได้ ไม่ปิดการส่ง custom requestเพียงเพราะ docs unavailable. ห้ามอ้าง cache ว่าเป็น current live contract หรือเอา cached NodeClaw guideไปยืนยัน custom endpoint. อ่านเฉพาะ operation ที่ใช้ ไม่โหลดเอกสารทั้งหมดเข้าทุก prompt

Docs URL และ catalog URL ของ native production เป็น profile defaults ที่ override ได้; dev reference ที่ตรวจใช้ในการพัฒนา ไม่ใช่ default ที่บังคับทุก client ติดต่อ dev

## 13. ไฟล์ผลลัพธ์, diagnostics และความปลอดภัย

ใช้ OS-native path APIs, UTF-8 และ argument arrays ไม่ประกอบ shell command จาก prompt. รองรับ relative/absolute/space/Thai paths; relative output resolve จาก invocation working directory ไม่ใช่ plugin installation directory

สร้างไฟล์ชื่อไม่ชนและเขียน atomic; explicit output filename ที่มีอยู่ต้องไม่ overwrite เงียบ ๆ. Preserve file content/actual format ไม่แค่เปลี่ยนนามสกุลหรือ re-encode โดยไม่ขอ. Partial download ไม่ถูกประกาศเป็น completed image. URL download ไม่ส่ง API key ไป CDN และตรวจ scheme/redirect/byte bounds ไม่ใช้ URL เพื่ออ่าน local files

จำกัด response bytes ก่อน decode/JSON parse และจำกัด decoded image/output ตาม operation/profile หรือ explicit client safety setting; ไม่ใช้ output truncation เป็น memory bound. Catalog/docs มี bounded input/cache และแสดง oversized/partial status ไม่ตีความ partial list ว่า model absent

`--json` ให้ machine-readable summary: operation, requested/actual method, model, selected endpoint source, taskId/handle ถ้ามี, paths, terminal/pending/unknown status และ safe error. stdout ไม่มี raw Base64/key/native payload; progress อยู่ stderr. Command exit ไม่เป็น success ถ้ายัง pending, unknown หรือ save ไม่ครบ; ต้องแยกสถานะเหล่านี้ให้ automation อ่านได้

CLI result contract: exit `0` เมื่อcommandสำเร็จตามหน้าที่และGenerate/Editบันทึกภาพครบ; `1` knownfailure; `2` config/inputinvalid; `3` pending/timeoutที่resumeได้; `4` operationoutcomeunknown. JSON `status` แยก `saved|pending|failed|outcome_unknown|save_failed`; inspection/setupcommandsอาจสำเร็จโดยไม่มีภาพ. Partial saveคืน`save_failed`พร้อมpathsที่สำเร็จ ไม่ลบผลเดิมหรือใช้exit0

Diagnostic capture เป็น opt-in minimal metadata ไม่เก็บ full prompt/reference bytes/raw provider error โดย default. Key ใช้ private user config ตาม runtime §4 หรือ supported harness secure configuration; ENV ยังเป็น optional override. ไม่ใส่ key ใน source, config examples, release assets, Task handles หรือ GitHub Actions logs. Local config เป็น plaintext ไม่ใช่ encrypted vault; POSIX สร้าง file 0600/ใหม่ directory 0700 และไม่อ้าง Windows ACL enforcement. Native Claude configuration ต้องใช้ `userConfig.sensitive` และ supported runtime bridge ที่ตรวจแล้ว ไม่ substitute key ลง SKILL.md หรือเก็บสำเนาใน plugin cache. Skill เมื่อไม่มี key แนะนำ native `/plugin configure nodeclaw-image-gen` หรือ user-run local `setup --interactive`; ห้ามใช้ chat/AskUserQuestion รับ key และไม่อ้างว่าเปิด native dialog เองได้หาก harness ไม่รองรับ. ไม่มี Telegram storage upload, rehosting หรือ result upload ไปบริการอื่น ได้ภาพจาก API แล้วบันทึกตามจริง; source-image multipart ของ Edit ไม่ใช่ storage subsystem

## 14. CLI และ package surface เป้าหมาย

คำสั่งหลัก: `setup`, `generate`, `edit`, `models`, `resume`, `docs`, `styles`, `techniques`, `update`. Group subcommands สำหรับ list/sync/check ตามความจำเป็น ไม่เปิด micro-command ต่อ helper ทุกตัว

```text
Nodeclaw-Image-Gen/
  README.md
  package.json
  script/install.mjs
  .claude-plugin/plugin.json
  .claude-plugin/marketplace.json
  skills/nodeclaw-image-gen/SKILL.md
  skills/nodeclaw-image-gen/scripts/image-gen.mjs
  skills/nodeclaw-image-gen/references/api-contract.md
  skills/nodeclaw-image-gen/styles/
  skills/nodeclaw-image-gen/techniques/
  config.example.json
  tests/
  .github/workflows/
  design/nodeclaw-image-gen.design.md
  diagram/STRUCTURE.md
  changelog/nodeclaw-image-gen.changelog.md
```

นี่เป็น target map ไม่ใช่รายการที่ต้อง scaffold ล่วงหน้าทั้งหมด. Runtime script และ bundled data อยู่ภายใน skill package เพื่อให้ copy/install แบบ standalone มี dependency ครบ ไม่พึ่ง absolute path ของเครื่องพัฒนา. ไม่มี Python runtime, browser profile หรือ Main Core source ติดไปใน package

## 15. GitHub release, install และ update

Public repo/release เป็น user-selected deliverable; เผยแพร่ v0.1.0 แล้วตาม parent หัวข้อ 18. ทุก publication ต้องตรวจ source payload, secret exclusion, version, remote target และ proof ตาม parent หัวข้อ 17 ไม่ใช้เพียงการมี design เป็นสิทธิ์ publish

Canonical source อยู่ใน platform subtree; export เฉพาะ verified package ไม่ publish NodeClaw-platform หรือ unrelated dirty/untracked files. ห้ามสร้างอีก development lane ใน temporary clone. Public README ใช้ portable paths ไม่คัดลอก workstation paths จาก helper manifest เก่า

Claude Code ใช้ standard plugin/marketplace manifests. Git-backed marketplace entry `source: "./"` เลือก plugin จาก repository revision ไม่ต้องมี release archive; standalone download/update/content sync ใช้ published release assets. Marketplace-managed install ให้ native plugin manager เป็นเจ้าของ code update (`claude plugin marketplace update nodeclaw-image-gen` แล้ว `claude plugin update nodeclaw-image-gen@nodeclaw-image-gen`) ไม่ให้ standalone updaterเขียน plugin cacheซ้อนกัน. Terminal installใช้ declared `--config api_base_url=...` และ `--config api_key=...`; userรันเองเพราะ real key ใน argvเสี่ยง history/process exposure. ตัวเลือก `--marketplace` ต้อง Claude Code v2.1.292+ ตาม [CLI reference](https://code.claude.com/docs/en/plugins/cli-reference); shell installไม่promptค่าเอง ต่างจาก native interactive install/configure form. `AskUserQuestion` ไม่มี sensitive-input contract และไม่ใช้รับ key. Standalone install มี explicit update/check workflow จาก trusted selected repository/release, ตรวจ integrity และ replace แบบพร้อม rollback โดย preserve config/state/custom packs

Standalone installerใช้Node scriptเดียวข้ามOS: ตรวจNodeversion, เลือกharnessและuser/projectscope, previewปลายทาง แล้วcopyครบทั้งskill directory. ไม่ต้องsource shellหรือเปลี่ยนparentenvเพื่อทำHTTPclientนี้. Claude/Codexใช้documented skillrootsตามเวอร์ชันที่ตรวจ; Grok Botไม่เขียนลงpathที่เดาเองและต้องผ่านintegrationgateของมัน. Pathมีexistinginstallให้ตรวจidentity/versionก่อนreplace ไม่ย้ายหรือลบother-ownerfiles. การติดตั้งไม่เพิ่มpermissionallowlistหรืออ่านAPIkeysจากother-ownerstoresเอง. Selected installer extensionรับaddress/keyหรือmaskedlocalentryและส่งเข้าconfig/authownerเดิมตามruntime§4; ไม่สร้างcredentialservice/storeใหม่. Previewแสดงเฉพาะtarget/configpath/address/readinessและreplacementgates. Installresultคืนargvของconfigure/reconfigure/status/updatecheck/updateapplyที่ผูกactualinstalledpath โดยไม่มีsecret; code-onlyinstallยังคืนsetupcommandให้userกรอกภายหลัง. `setup --interactive`/`setup --replace --interactive`เป็นcurrentconfigowner ไม่เพิ่มparallelconfigcommand/store. NativeClaudeuserConfigรับaddressกับsensitivekeyในsupportedform; terminal`claude plugin install --config`เป็นคนละsurfaceจากslash`/plugin install`และต้องdocumentตามcapabilityจริง

### Native configuration bridge

เลือก manifest `userConfig.api_base_url` (native address default) และ `api_key` (`sensitive:true`); hook/CLIยังใช้config/authownerเดิม. Official [manifest contract](https://code.claude.com/docs/en/plugins/manifest-reference#user-configuration) ให้ `CLAUDE_PLUGIN_OPTION_API_BASE_URL` / `CLAUDE_PLUGIN_OPTION_API_KEY` เฉพาะ hook process ไม่ใช่ Bash tool. Inline manifest `SessionStart` ใช้ exec-form `node` + existing `image-gen.mjs plugin-env`; ไม่ส่ง key ใน argv หรือแทนค่าใน skill text. Internal entrypointใน`config.mjs`ตรวจเฉพาะสองoption/selectedfileและappend quoted exports ของ `NODECLAW_IMAGE_GEN_API`, `NODECLAW_IMAGE_GEN_API_KEY`, `NODECLAW_IMAGE_GEN_ENDPOINT_MODE=configured` ไป supported `CLAUDE_ENV_FILE` ตาม [hooks contract](https://code.claude.com/docs/en/hooks#persist-environment-variables). CLIถัดไปใช้exactaddress/keypairนั้นผ่านresolverเดิม. ไม่อ่านsecretstore/settings/profileเองและไม่เขียนสำเนาลงprivateuserconfig/plugincache.

Native formเก็บsensitivevalueในharnesssecurestore แต่sessionbridgeเป็นplaintextexportfileและsubprocessenv: requireordinaryowner-onlyfileบนPOSIX, quotedliteralassignmentsและไม่printkey/stdout. กระบวนการshellในsessionเข้าถึงkeyได้ตามruntimecredentialcontract; ไม่อ้างว่าkeyอยู่securestoreอย่างเดียว. Hookมีค่าขาด/unsupportedenvfileให้แจ้งconfigurationrecoveryโดยไม่เดาfallbackmechanism. หลังinstall/reconfigureให้เริ่มsessionใหม่เพื่อเรียกSessionStartและไม่ใช้ค่าเก่าจากsessionเดิม.

ScopeของbridgeคือBash-compatible SessionStart/consumer. Docsระบุว่าPowerShellhookไม่มี`CLAUDE_ENV_FILE`, PowerShellconsumerบนWindowsอาจdropvalueที่มีslashและdropทั้งfileเมื่อotherhookเขียนnon-assignment. จึงไม่อ้างnativeWindowsPowerShellbridgeรองรับครบ; ใช้localprivate`setup --interactive`ของCLIเดิมเมื่อbridgeไม่พร้อม. NativeUI/keychain/reloadและOSจริงยังเป็นproofคนละlayer ไม่ใช้localfixtureแทนharnessacceptance.

Releaseสำหรับmanual downloadมีแพ็กเกจไฟล์ล้วนพร้อมchecksum ไม่ต้องมีOS-specificbinary. Automated installer/updaterไม่parsearchive: ใช้versioned release manifestที่แจกเป็นJSONพร้อมreleaseassetsแบบรายไฟล์. Manifestระบุpackage/versionและแต่ละrelativepath, assetname, bytes, SHA-256; resolveassetจากselectedrepo/releaseเดียวกัน ไม่รันinstallscriptจากnetworkเพื่อbootstrapความเชื่อถือ

Downloadลงstagingเฉพาะแพ็กเกจ ตรวจทุกfile/hash/sizeก่อนswitch; rejectabsolute/traversal/symlink/case-collisionและduplicatepaths ไม่แตะconfig/userdata. ถ้าnetworkหรือpermissionfailคงinstallเดิม; ถ้าreplaceบางส่วนสำเร็จต้องรายงานstateและใช้checkedrollbackไม่เริ่มซ้ำแบบไม่ทราบผล. ดังนั้นcoreupdateใช้เพียงNodefetch/JSON/crypto/filesystem ไม่เพิ่มPython/Git/unzipruntimeหรือcustomarchiveframework. Manualarchiveถูกunpackโดยผู้ใช้ก่อนรันlocalinstaller ไม่อ้างว่าclientมีZIPparser

Style/technique sync ทำแยกจาก executable updateได้ แต่ใช้ compatible versioned pack manifest และ repo/ref ที่ผู้ใช้เชื่อถือ. Sync ไม่รัน downloaded hooks/scripts และไม่ตาม arbitrary repository ที่พบจาก prompt โดยอัตโนมัติ. Checksumยืนยัน byte integrity ไม่ใช่การรับรองความน่าเชื่อถือของ publisher

GitHub release แจก cross-platform archive, version/checksum, tested runtime/OS matrix และ release notes. ไม่ต้องมี npm registry หรือ GitHub Pages app เพื่อให้ใช้งาน core ได้. ถ้าระบบ permission จำกัด update ต้องแสดงวิธีดำเนินการ ไม่ elevate/delete/force overwrite เอง

README, `SKILL.md`, bundled workflows และ preset descriptions ใช้ English base; การสนทนาและ NodeNetwork localeยังตามภาษาผู้ใช้. README เริ่มด้วยเครื่องมือนี้ทำอะไร → prerequisite → compact Quick install (AI auto install promptเป็นหลัก + Claude marketplace/native sensitive form) → manualreferenceแยกจากQuickinstall → ใช้ค่าแนะนำ/setup → ตัวอย่าง Generate/Edit → หาไฟล์ภาพ. Repository/source releaseรวม design/changelog/docs/diagram ที่เชื่อมกัน ส่วน installed skill copyเฉพาะ `skills/nodeclaw-image-gen/` ไม่ติด development/governance docs. ส่วน env/config, fallback semantics, custom provider, docs/style sync, update, troubleshooting และ support limits เป็นหัวข้อ advanced ที่ตามมา. ไม่อ้าง native wizard หรือ Grok Bot integration ก่อนตรวจจริง

## 16. NodeNetwork docs integration

เพิ่มรายการใน existing `payg-addon` section เป็น **Add-On > Add-On & Skill** พร้อมชื่อ skill, Generate/Edit, installation/quick-start, GitHub/release links และ config/help references. Preserve LINE AI Chatbot และ companion/non-required setup meaning

Existing platform owners (paths relative to `<platform-root>`, not standalone repository links): `web-control-plane/frontend/src/pages/Docs.tsx` (`payg-addon` body/rendering), `web-control-plane/frontend/src/locales/en/docs.json` และ `web-control-plane/frontend/src/locales/th/docs.json`. Reuse current copy-code component, native `details/summary` และ locale system ไม่สร้าง gallery/dashboard/state/CSS ใหม่. Quick installเหลือ2ทาง: AI Auto Install promptเป็นหลัก + Claude Code marketplace/nativeform; ไม่มีManualcommandblockหรือNoextra server/Telegramcopyในcard. Promptให้assistantอ่านREADME, download/verifyreleaseที่รองรับและมีpackageก่อนรันinstaller, ตรวจharness/Node, preview/show user-scopetargetแล้วexecute`--yes`ตามคำขอ. Reuseexistingmanagerไม่duplicate; ถามเฉพาะmissingprerequisite/trust/permission/replacement. Installเสร็จคืนexactinstalled-path`setup --interactive`commandให้userกรอกaddress/hiddenkeyเอง หรือใช้nativeuserConfig`sensitive:true`ของplugin ไม่รับkeyผ่านchat/AskUserQuestion. คืนconfig/updatecommandsภายหลังและแยกinstalledออกจากcredentialconfiguredจนuserกรอกเสร็จ. Verify`--help`, `techniques list --json`, `setup --status --json`ไม่มีAPIcallsแล้วรายงานversion/path/readiness/restart. ยังไม่publishedrequiredversionต้องแจ้งblockerไม่รันunsupportedflags. Marketplaceแสดง`/plugin marketplace add`, `/plugin install`, `/plugin configure`; detailsของnativebridge/support/privacyอยู่README ไม่เพิ่มCSS/state/renderer

อัปเดต docs source หลัง package install/command names ได้รับการตรวจแล้ว ลิงก์ public ที่ยังไม่ publish ต้องไม่แสดงเป็นพร้อมใช้งาน. การเปลี่ยน source docs ไม่ใช่ production deploy; live website publication เป็นแยก action ที่ต้องมี deployment approval
