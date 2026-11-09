# Nodeclaw-Image-Gen: Runtime, Config and API Contract

> **Current Version:** 0.1.3
> **Status:** v0.1.3 native binding ingress source/local verified; 41 package tests and 4 native sandbox tests passed. Installed session adoption and API-key acceptance are not implied
> **Session:** b3b4111c-5f9a-4ec7-8bcf-fd76bb593619
> **Parent Design:** [nodeclaw-image-gen.design.md](nodeclaw-image-gen.design.md)
> **Full history:** [Design history](../changelog/nodeclaw-image-gen.changelog.md)
> **Scope:** Config, endpoint/catalog selection, Generate/Edit, Task lifecycle and method fallback. Section numbers continue the parent map

## 4. ค่าตั้งต้นและ config

มี config file จริง สร้างผ่าน first-run setup โดยไม่เขียนทับไฟล์เดิมเงียบ ๆ ใช้ config ที่เลือกเพียงไฟล์เดียว ไม่ซ้อน global/project files โดยอัตโนมัติ

ตำแหน่งค้นหา: `--config` → `NODECLAW_IMAGE_GEN_CONFIG` → user config directory ตาม OS. Linux ใช้ `${XDG_CONFIG_HOME:-$HOME/.config}/nodeclaw-image-gen/config.json`; macOS ใช้ `~/Library/Application Support/Nodeclaw-Image-Gen/config.json`; Windows ใช้ `%APPDATA%\\Nodeclaw-Image-Gen\\config.json`. หาก platform directory หาไม่ได้ ให้ระบุ `--config` ไม่บันทึกลง installation cache แทน

ตัวอย่าง config schema เป้าหมาย ไม่ใช่การอ้างว่า runtime มีแล้ว:

```json
{
  "schemaVersion": 1,
  "provider": "auto",
  "model": "gpt-image-2",
  "method": "task",
  "timeouts": {
    "requestMs": 300000,
    "waitMs": 900000,
    "pollIntervalMs": 2000
  },
  "apiBaseUrl": null,
  "catalogUrl": null,
  "apiDocsUrl": null,
  "apiKeyEnv": "NODECLAW_API_KEY",
  "endpointMode": "auto",
  "apiMode": "images",
  "fallback": {
    "enabled": true,
    "onTerminalFailure": false
  },
  "outputDir": "./generated-images",
  "image": {
    "count": 1,
    "size": "auto",
    "quality": "auto",
    "format": "auto"
  },
  "wizard": {
    "mode": "compact",
    "confirmBeforeGenerate": true
  },
  "styles": {
    "suggest": true,
    "search": "on_request"
  },
  "updates": {
    "channel": "stable",
    "applyAutomatically": false
  }
}
```

### Direct installation/setup configuration — selected extension

Installer และ `setup` เดิมรับ `--api-base-url` + `--api-key` โดยตรง; ทางแนะนำคือ `--interactive` สำหรับ local terminal ที่ซ่อน key หรือ `--api-key-stdin` สำหรับ pipe จาก secret manager. Direct arguments อาจปรากฏใน shell history/process list; skill ไม่รับ key ผ่าน chat, choice tool หรือ generated spec. `setup --status` คืนเฉพาะ address, config path และ credential readiness โดยไม่ส่ง API request. Existing config ต้องใช้ explicit `--replace` สำหรับ setup หรือ `--replace-config` สำหรับ installer; code replacement ใช้ `--replace` แยกกัน. Installer preview ไม่อ่าน stdin ไม่ถาม key และไม่เขียน config.

`apiKey` เป็น optional private user-config field ไม่ใช่ release/example value. เก็บ plaintext ใน selected OS user config นอก skill/cache พร้อม owner-only file mode บน POSIX; ไม่อ้าง encryption หรือ Windows ACL enforcement. Settings update รักษา key เดิมเฉพาะเมื่อ normalized base URL/proxy prefix เดิม; เปลี่ยน address ต้องให้ binding ใหม่ ไม่ย้าย key ตามไป. Config write ใช้ atomic publication/no-clobber ของ existing filesystem owner. Ordinary `context.config`, endpoint serialization, dry-run/status, handles, installed files และ release payload ไม่มี key. Runtime endpoint ถือ credential แบบ non-enumerable และ shared `http.authorization` เป็นผู้ใช้เพียง boundary เดิม; discovery/resume ใช้ binding นี้ด้วย.

`endpointMode=auto|configured` แยก persistent selection จาก address fallback. Existing/default `auto` รักษา harness → configured → native; installer/setup ที่ระบุ address เลือก `configured` เพื่อใช้ address นั้นและไม่ส่งต่อไป harness/native. Explicit `--api-base-url` ยัง pin ต่อ invocation. Optional `NODECLAW_IMAGE_GEN_API_KEY` ต้องมี `NODECLAW_IMAGE_GEN_API` คู่กันและผูก exact normalized base; scoped pair นี้ override saved pair ได้แต่ไม่ตาม CLI pin ไป address อื่น. Saved pair มี priority เหนือ legacy key env; legacy `apiKeyEnv` ยังใช้เมื่อ endpoint ไม่มี private pair. ไม่มี key จาก configured endpoint ไป harness/native/CDN/catalog/docs. Model/method/ordinary settings ยังใช้ CLI/spec → env → selected config → built-ins.

Native plugin binding ใช้ `NODECLAW_IMAGE_GEN_PLUGIN_CONFIG` เป็น JSON object เฉพาะ `apiBaseUrl` และ `apiKey`; presence คือ `!== undefined` ไม่ใช่ truthiness. Existing `resolveContext` parse/validate/normalize ทั้งคู่ก่อน authorization/network. Present แต่ empty/malformed/non-object/missing/invalid field ต้อง generic `invalid_input` ไม่ fallback; valid binding ใช้ normalized native address และ configured mode โดย ignore former `NODECLAW_IMAGE_GEN_API`, `_API_KEY`, `_ENDPOINT_MODE` แม้ค่าพวกนั้น invalid. Ordinary model/method/timeouts/output precedence คงเดิม; native binding absent คง standalone contract ทั้งหมด. Explicit CLI endpoint pin ยังมีผล แต่ native credential ผูก exact normalized base/proxy prefix เท่านั้น ไม่ตามไป origin/prefix อื่นและไม่ใช้ saved/legacy credentialแทนใน native-present branch. Raw binding/keyไม่เข้า enumerable config, status/dry-run/results, Task handles หรือ persistence; ใช้ existing non-enumerable endpoint credential/authorization boundary. Native transport lifecycleอยู่ experience §15.

`apiMode=images|gemini` เป็น explicit wire selection; default `images` รักษา Task/OpenAI image behavior. Native `gemini` เป็น finite Direct-only wire ผ่าน client เดิม ไม่เลือกจากชื่อ model หรือ `google_image_generate_content`. ทั้งสอง mode ใช้ configured customer Bearer authentication; ไม่อ้างรองรับ direct Google API-key transport โดยอัตโนมัติ.

`auto` ของ image spec เป็น client intent: omit หรือ resolve เป็นค่าที่ profile รองรับ ไม่ส่ง string `auto` ไปทุก provider. Count 1 เป็นค่าที่เครื่องมืออยากขอ ไม่ใช่การยืนยันทุก profile รับ `n=1`; ถ้า profile บังคับ quantity อื่นต้องแสดงผลกระทบก่อนส่ง ไม่เพิ่มจำนวนเงียบ ๆ

ค่าที่สั่งครั้งเดียวผ่าน prompt/form กลายเป็น CLI arguments/spec ของ invocation เดียว ไม่ใช่ precedence authority แยกที่ script อ่านใจได้. ภายใน script ใช้ explicit CLI/spec → env → selected config → built-ins. การเลือกภาพครั้งเดียวไม่เปลี่ยน persistent defaults ยกเว้นผู้ใช้เลือกบันทึก. `--api-base-url` เป็น explicit pin; ถ้าไม่ pin ใช้ endpoint order ในหัวข้อ 5. `NODECLAW_IMAGE_GEN_API` ไม่แซง harness endpoint ใน auto mode; configured mode ตาม selected extension ข้างต้น pin persistent address

| Env | ความหมาย |
|---|---|
| `NODECLAW_IMAGE_GEN_CONFIG` | เลือก config file |
| `NODECLAW_IMAGE_GEN_API` | Configured fallback base URL หลัง harness candidate |
| `NODECLAW_IMAGE_GEN_MODEL` | Preferred exact model ID |
| `NODECLAW_IMAGE_GEN_METHOD` | `task` หรือ `direct` |
| `NODECLAW_IMAGE_GEN_FALLBACK` | เปิด/ปิด fallback ตาม policy |
| `NODECLAW_IMAGE_GEN_FALLBACK_TERMINAL` | Opt-in reattempt หลัง eligible terminal failure พร้อม cost warning |
| `NODECLAW_IMAGE_GEN_CATALOG_URL` | Catalog origin/route ที่ผูกกับ endpoint profile |
| `NODECLAW_IMAGE_GEN_DOCS_URL` | Optional public API reference ที่ fetch ได้ |
| `NODECLAW_IMAGE_GEN_OUTPUT_DIR` | Output directory |
| `NODECLAW_IMAGE_GEN_API_KEY_ENV` | ชื่อ env ที่เก็บ key ไม่ใช่ค่า key |
| `NODECLAW_API_KEY` | Native NodeClaw key ตาม existing helper convention |

Boolean รับ `true/false/1/0` แบบชัดเจน; `false` ต้องไม่กลายเป็น true เพราะเป็น nonempty string. Invalid config/env แสดงชื่อ field และวิธีแก้ ไม่ทิ้งค่าแล้วกลับ default เงียบ ๆ

`timeouts` เป็น client waiting defaults ไม่ใช่ Task Worker deadline หรือ provider SLA: request 5 นาที, total wait 15 นาที, poll baseline 2 วินาที. Overrideได้โดย explicit config/CLI; valid server `Retry-After` เป็น lower bound ของการรอครั้งถัดไป. ถ้ารอไม่ทัน total deadlineให้คืน handle ไม่ทำ POSTใหม่. Directใช้ request timeoutเดียวกันแต่หมดเวลาไม่พิสูจน์ no effect

Provider setting เป็น `auto|nodeclaw|openai-compatible`; `auto` ตรวจเฉพาะ binding ที่รู้จักและตกกลับ native NodeClaw เมื่อไม่ปรับแต่ง. `method` เป็น `task|direct`; ไม่มี `auto` อีกค่าที่สร้างลำดับทับ Task-first. Custom endpoint/known route-prefix และชื่อ env ที่ถือ key เก็บใน config ได้ ไม่จำเป็นต้องมี model list หรือ API docs

## 5. Endpoint discovery และ credential boundary

แยก `apiBaseUrl`, `catalogUrl`, `apiDocsUrl` อย่างเด็ดขาด. URL ของ catalog/docs และ OpenAPI `servers` ไม่เปลี่ยน inference endpoint เอง

Auto candidate order:

1. Endpoint ของ harness ที่กำลังเรียกจริง พร้อม credential binding ของ candidate นั้น
2. `NODECLAW_IMAGE_GEN_API` หรือ `apiBaseUrl` ใน config หาก env ไม่ได้ตั้ง
3. Native `https://payg.nodenetwork.ovh`

อ่าน context ของ active harness ไม่ไล่ใช้ทุก API key/base URL ใน environment เพราะอาจเป็นคนละ provider. Claude Code ใช้ supported `ANTHROPIC_BASE_URL` และ API-key/token env; Codex ใช้ endpoint/env ของ selected provider ที่ caller เปิดเผยจริง. การเห็น `OPENAI_BASE_URL` อย่างเดียวไม่พิสูจน์ effective Codex provider. Grok Bot ไม่สมมุติว่ามี desktop env ของ Grok Build

หาก active provider อยู่ใน harness config ไม่ใช่ env ให้ใช้ caller hint หรือ explicit package config ก่อน. ไม่เขียน simplistic TOML parser, ไม่เพิ่ม TOML dependency เพื่อเดา layered Codex config และไม่อ่าน OAuth/session/token stores. เมื่อมีหลาย candidate โดยไม่ทราบ active owner ให้ setup เลือกครั้งเดียว

Candidate ประกอบด้วย base URL + protocol profile + credential source + optional catalog binding. Normalize เฉพาะ API version boundary ที่ profile รู้จักเพื่อไม่เกิด `/v1/v1`; preserve proxy path prefix ไม่ตัด `/api/provider/...` หรือ Cloudflare prefix ด้วยกฎจาก script เก่า

เมื่อ authoritative discovery ยืนยัน model/operation ที่ต้องการไม่มี ให้ตรวจ candidate ถัดไปใน auto mode. แต่ catalog missing/unavailable หรือ capability unknown ไม่เท่ากับ model absent. Custom endpoint ที่ผู้ใช้เลือกและระบุ model เองยังใช้ได้ ไม่ส่ง prompt ไป NodeNetwork แทนโดยไม่แจ้ง. เงื่อนไข skip/fallback และ endpoint ที่เลือกแสดงก่อน inference. Explicit pin ไม่ fallback ข้าม endpoint โดยอัตโนมัติ

Credential ผูกกับ candidate และส่งเฉพาะ origin/path contract ที่ตั้งไว้ ไม่ส่ง key ของ harness ไป native fallback/CDN/docs/catalog คนละ role. Native fallback ใช้ NodeClaw key ที่ตั้งไว้ ถ้าไม่มี key ต้องตั้งค่าผ่านวิธีปลอดภัยก่อน ไม่ใช้ dummy key หรือ subscription/OAuth ของ harness แทน. ไม่แสดง key ใน command preview, output, diagnostics หรือ request handle

ใช้ HTTPS นอก local development; custom insecure local configuration ต้อง explicit ไม่ disable TLS verification เพื่อแก้ error. Redirect ข้าม origin ไม่ forward Authorization โดยอัตโนมัติ

## 6. Ordered model discovery, merge และ manual model

ต่อ candidate endpoint ใช้ลำดับ **`payg-model-data` → `/v1/models` → manual model** ไม่ fetch สองแหล่งพร้อมกัน. ขั้นแรกใช้ configured/native Main Core catalog เฉพาะเมื่อ profile/environment binding ใช้ได้; custom provider ที่ไม่มี contract นี้ข้ามขั้นแรก ไม่เดา Backend URL ของ provider นั้น

1. อ่าน `payg-model-data` เมื่อ applicable; ถ้าผิดเงื่อนไข/unavailable/schema ใช้ไม่ได้ ให้บันทึกสาเหตุแล้วไปขั้นที่สอง ไม่จบเป็น model absent
2. อ่าน `/v1/models` ของ candidate เดิมเมื่อ provider รองรับและมี credential binding ที่ถูกต้อง. ถ้าแหล่งแรกสำเร็จ ขั้นนี้ยังใช้เป็น sequential augmentation เพื่อรองรับ requirement รวมข้อมูลสองแหล่ง; ถ้าแหล่งแรกใช้ไม่ได้ ขั้นนี้เป็น fallback. Secondary failure ไม่ทิ้ง primary list ที่ใช้ได้แล้ว
3. หากได้ทั้งสองแหล่ง ให้ merge; ได้แหล่งเดียวใช้แหล่งนั้น; ไม่มี usable model list ทั้งสองยังส่ง exact model name จาก prompt/config/manual choice ได้. Preferred `gpt-image-2` เป็นค่าเริ่มต้นได้โดยแสดงว่า unverified ไม่บังคับเปิด catalog ให้สำเร็จก่อน

NodeNetwork catalog อ่าน `data.snapshot.models[]`, จับคู่ exact `modelId` กับ `operationCompatibilities[].operation/compatibilityKey`, แล้วอ่าน `operations[]` สำหรับ operation options/readiness. `/v1/models` อ่าน `data[].id` ตาม supported schema. NodeClaw ปัจจุบันส่ง Chat projection จากแหล่งที่สอง จึงไม่อนุมาน Image/Edit จากการมีหรือไม่มีชื่อใน list นี้

Merge key คือ exact public model ID ภายใน execution profile เดียว ไม่ lowercase, ไม่รวมคนละ model ID เพราะ display name คล้ายกัน และไม่เปลี่ยน alias ด้วยการเดา. หนึ่ง model แสดงหนึ่งรายการ พร้อม provenance ของ source(s), endpoint binding, Generate/Edit pairs และ metadata ที่ทราบ. Primary NodeClaw declared operation pairs ไม่ถูกลบหรือ overwrite ด้วย secondary Chat-only/unknown capability. ค่า unknown ไม่กลายเป็น false; metadata ขัดแย้งเก็บขอบเขตและไม่ประกาศความสามารถเกินหลักฐาน

ถ้าแสดง model เดียวข้ามหลาย endpoint ให้มี record เดียวพร้อม eligible endpoint references แต่ห้ามย้าย readiness/options ของ endpoint A ไปอ้างกับ endpoint B. ผลดิบสองชุดเป็น discovery input; ordinary request planner ใช้ merged canonical result ไม่ merge/default ซ้ำตาม caller

Native production profile target: gateway `https://payg.nodenetwork.ovh`, Main Core catalog `https://app.nodenetwork.ovh/api/payg-model-data`, optional docs `https://nodenetwork.ovh/docs/api/payg/openapi/payg-gateway.v1.yaml`. Origin split อ้างอิง platform README; production catalog/docs serving ยังไม่ได้ตรวจในงานนี้ จึงไม่เรียกว่า live-verified

Development catalog/docs ใช้สอง URL ที่ตรวจใน parent section 3 ผ่าน config/env ได้. ไม่ทำ dev URL เป็น portable production default. NodeNetwork endpoint ที่ไม่มี environment mapping ชัดเจนต้องใช้ configured catalog หรือแจ้ง catalog unknown ไม่ใช้ dev data ตัดสิน production/custom host

ตรวจ hostname แบบ exact/subdomain boundary ของ `nodenetwork.ovh`, ไม่ใช้ substring ที่ยอมรับ `nodenetwork.ovh.example.com`. Proxy host ที่ซ่อน upstream ต้องเลือก `provider=nodeclaw` ผ่าน config แทนการเดา

แสดงสถานะ `listed`, `not_listed`, `catalog_unavailable` หรือ `capability_unknown` แยกกัน. Known Image models อยู่กลุ่มแนะนำก่อน; records ที่มีแต่ Chat/unknown metadata ยังเลือก exact name แบบ unverified ได้ ไม่ใช้ข้อมูลที่ไม่ครบเป็นข้อห้าม. Unknown capability ไม่ใช่ permission bypass และ provider ยังเป็นผู้ตัดสิน request จริง

ถ้า requested model ไม่มีใน usable list ให้เสนอ model ที่พบและตัวเลือกใช้ชื่อที่ระบุเอง ไม่เปลี่ยน preferred model เงียบ ๆ. Explicit user model/custom endpoint ต้องไม่ถูกส่งไป PAYG เพียงเพราะ discovery ใช้ไม่ได้; endpoint fallback ตามหัวข้อ 5 ยังใช้เมื่อไม่มี explicit pin และมีหลักฐานว่า candidate ใช้ไม่ได้จริง

## 7. Generate/Edit และ image spec

`generate` เป็นการสร้างภาพใหม่; `edit` เป็นการแก้ภาพที่ผู้ใช้เลือก. Skill เสนอ operation จาก brief แต่ไม่ upload รูปส่วนตัวหรือไฟล์อื่นเพียงเพราะหาเจอใน workspace. รายละเอียดภาพประกอบด้วย subject, purpose, style, composition, colors, lighting, text, aspect ratio, quality, format และสิ่งที่ต้องรักษาหรือเปลี่ยน ไม่บังคับผู้ใช้ตอบครบทุก field

NodeClaw ส่ง exact `model` + `compatibilityKey`. Generate รองรับคู่ `openai_image_generations` หรือ `google_image_generate_content`; Edit รองรับ `openai_image_edits` หรือ `google_image_generate_content`. Generate support ไม่รับรอง Edit support

Manual model เมื่อcatalogไม่มี: ใช้explicit compatibilityKeyที่ผู้ใช้/configเลือก หรือnative OpenAI-image profile defaults (`openai_image_generations`/`openai_image_edits`)ตามoperation พร้อมแสดงว่าmodel/profile pairingยังunverified. นี่คือการเลือกwireprotocol ไม่ใช่การเดาcapabilityจากชื่อmodel; customGoogle/nativecontentต้องเลือกcorrespondingprofileเอง. Clientส่งrequestได้และรับprovider errorตามจริง ไม่บังคับให้catalogกลับมาก่อน. ถ้ามีauthoritativepairingแล้วใช้pairนั้นแทนdefaultไม่ให้ค่าซ้ำเป็นอีกauthority

แยก request controls จาก prompt content. ตรวจ option ที่ catalog/profile ประกาศ และ preserve native content/extensions ใน advanced JSON input โดยไม่สร้าง universal Supplier validator. Unsupported explicit option ต้องแจ้งหรือให้เลือกแก้ ไม่ลบทิ้งเงียบ ๆ. Custom protocol `openai-compatible` ไม่ส่ง NodeClaw-only `compatibilityKey`/Task envelope ถ้า provider ไม่ประกาศรับ

Edit รองรับ local image file(s), authorized reference URL และ optional mask ตาม profile. Local files ใช้ multipart เป็นทางหลักเพื่อลด Base64 expansion; JSON/native content ยังเลือกได้. ไม่อ้างว่า mask/format/pixels ทุกแบบใช้ได้ทุก model และไม่เพิ่ม Gateway-style restrictions ที่ API ไม่กำหนด. Image format ใน spec ต่างจาก `response_format` ที่เป็นวิธีส่งผลกลับ

Task JSON: `{ "operation": "image_generation|image_edit", "request": { ...originalImageRequest } }`. Task Edit multipart: scalar `operation=image_edit` ข้าง original top-level fields/files ไม่ห่อ multipart ลง `request`. Task เป็น finite result, `stream=false` และไม่มี positive partial images

Direct ใช้ payload ของ operation เดิมโดยไม่สร้าง Task. เลือก finite JSON mode เมื่อ profile รองรับ; ห้ามสมมุติว่า omitted `stream` จะเป็น false. หาก Direct ตอบ SSE ต้องอ่าน Content-Type, parse complete records และใช้ operation-specific completed event เป็น terminal proof; partial event, Usage, `[DONE]` หรือ EOF ไม่ใช่ภาพสำเร็จ ไม่จำเป็นต้องแสดง progressive image UI

รักษา checked encoded limits ของ NodeClaw: Generate JSON 2 MiB; Edit JSON/multipart 34 MiB; Task envelope 34 MiB + 65,536 bytes โดย nested request ยังติด operation limit เดิม. Custom provider ใช้ profile ของตน ไม่ยัด NodeClaw limits เป็นข้อเท็จจริงของทุกเจ้า

### Explicit native Gemini wire

User ให้ base address อย่างเดียว. `apiUrl` normalize เฉพาะ terminal `/v1` หรือ `/v1beta` แล้วต่อ selected version/route โดยรักษา proxy prefix: Task `/v1/media/tasks`, Images `/v1/images/generations|edits`, native Gemini `/v1beta/models/{encoded-exact-model}:generateContent`. Native model เป็น public ID ไม่มี slash; ไม่ใส่ body `model`/`compatibilityKey` หรือ OpenAI image controls. `--prompt` สร้าง user `contents[].parts[].text`; advanced native contents/extensions คงรูปตาม input. Local Edit source เข้า `inlineData` โดย client เดิม; native mask/reference URL ต้องให้ supported native parts เอง ไม่เดา provider control. Native JSON ส่ง `generationConfig.responseModalities=["IMAGE"]` เมื่อไม่ระบุเอง; explicit controls/contents ที่ขัดกันแจ้งก่อน dispatch ไม่ทิ้งเงียบ ๆ. NodeClaw native body cap 2 MiB. Native route เป็น Text-family Gateway transport ไม่ใช่การพิสูจน์ Direct Image operation/pricing/readiness.

Native Gemini finite JSON อ่าน image-bearing `candidates[].content.parts[].inlineData` แล้วให้ existing `saveImages` ตรวจ Base64/actual format และบันทึก local files; text-only/refusal ไม่ใช่ saved image. ไม่เพิ่ม native Task, SDK หรือ HTTP client. Existing Images API ที่ใช้ `google_image_generate_content` ยังเป็น `/v1/images/*` และ Task ยังเก็บ normalized `data[]`; ไม่แปลงสอง contract นี้เป็น native candidate envelope.

## 8. Task polling, resume และผลลัพธ์

ก่อน POST สร้าง UUID `request-signature` และบันทึก request handle แบบ atomic ใน user state directory. Handle เก็บเฉพาะ original endpoint/profile, operation/model, signature, taskId เมื่อได้, output intent และสถานะที่จำเป็น ไม่เก็บ key, raw prompt, image/mask bytes หรือ full provider payload

Create `202` หมายถึง accepted ไม่ใช่ completed. Compatible signed duplicate `200` คือ Task เดิม; different intent `409 task_identity_conflict` ต้องหยุด ไม่เปลี่ยน signature เพื่อเลี่ยง conflict

ถ้า create reply หาย ใช้ collection GET พร้อม original signature. ถ้าได้ taskId แล้วใช้ known-ID GET. Resolve/read 404 หรือ 503 ไม่ authorize POST ใหม่. เมื่อย้าย endpoint หลัง acceptance ไม่ใช้ Task ID/signature เดิมกับคนละระบบ

Resume handle เป็นข้อมูลอ้างอิง ไม่ใช่ authority สำหรับส่ง credential. Original base URL รวม proxy path ต้องตรง current trusted candidate จาก config/harness; ใช้ credential binding จาก candidate ปัจจุบัน ไม่ใช้ชื่อ key env ที่ handle ระบุ. ถ้าไม่มี candidate ตรงให้หยุดและตั้งค่า original endpoint/binding อย่าง explicit ก่อน ไม่ย้าย Task ไปยัง active endpoint ใหม่

Poll `queued`, `processing`, `reconciling`; `reconciling` ยังไม่สำเร็จ. Honor valid `Retry-After` และ finite caller deadline จาก config. GET transient failures ใช้ bounded retry/backoff บน request เดิม ไม่ retry create หรือเพิ่ม inference. Provider wait ต้องไม่เกิน caller deadlineแล้วกลายเป็น POST

`succeeded` ต้องมี `result`; `failed`/`expired` ต้องมี safe error และไม่มี public result. Timeout/Ctrl-C ปิดการรอของ client ไม่ cancel remote Task. คืน `pending`/`outcome_unknown` พร้อม handle เพื่อ `resume` ต่อได้ ไม่มี background daemon

ผลสำเร็จอ่านทุก `data[]` ที่ส่งมาจริง ไม่ถือ requested count เป็น delivered count. รองรับ `b64_json` และ URL; save ภาพจริงก่อนรายงานว่า saved. ถ้าดาวน์โหลดบางไฟล์ล้มเหลวให้เก็บไฟล์ที่สำเร็จและ retry download/read ของงานเดิม ไม่สร้างภาพใหม่. URL อาจหมดอายุก่อน/หลัง Task retention ไม่มี lifetime guarantee เพิ่ม

Direct ไม่มี enabled recovery ใน contract ปัจจุบัน. Direct timeout หลัง dispatch ต้องรายงาน unknown outcome ไม่สร้างใหม่อัตโนมัติและไม่ใช้ Recovery Preview headers. ความสำเร็จของภาพหรือการบันทึกไฟล์ไม่ใช่ financial finality

## 9. Automatic method fallback

`method=task` เป็น default; เลือก `direct` ได้. `fallback.enabled=true` เปิด policy ที่จำกัด ไม่ใช่ลองทุก error. หนึ่ง logical invocation สลับไปอีก method ได้สูงสุดหนึ่งครั้ง ไม่มี Task↔Direct loop และไม่เปลี่ยน model/operation/endpoint ระหว่าง method fallback โดยไม่เลือกใหม่

| สถานการณ์ | พฤติกรรม |
|---|---|
| Custom profile ประกาศรองรับ Direct อย่างเดียว | Resolve Direct ก่อนส่งเมื่อ fallback เปิด; แจ้งเหตุผล ไม่ยิง Task probe ที่เสียเงิน |
| ยืนยัน route/method unsupported ก่อนมีการรับงาน | ลอง Direct ครั้งเดียวได้เมื่อ contract ระบุ no acceptance และ Direct รองรับ spec เดิม |
| Task-specific capacity rejection ก่อน acceptance | ใช้ได้เฉพาะ no-acceptance semantics ที่ตรวจแล้ว; honor Retry-After และไม่ใช้ Direct เลี่ยง account/global quota |
| Auth/permission/policy/content refusal, invalid spec, identity conflict | หยุดและแก้สาเหตุ ไม่สลับเพื่อเลี่ยงการปฏิเสธ |
| Create timeout, `task_acceptance_unconfirmed`, `task_storage_unavailable`, unknown 5xx | Resolve/read original identity ไม่สลับ method |
| มี taskId แล้วแต่ polling ขาดหาย | ตรวจ Task เดิมต่อ |
| Task `succeeded` แต่ download/save fail | Retry download/save ไม่ inference ใหม่ |
| Task terminal `failed` | Default หยุด; advanced `onTerminalFailure=true` อนุญาตหนึ่ง eligible new attempt โดยแจ้งว่าอาจถูกคิดเงินทั้งสองครั้ง |
| `expired` หรือ error ที่ยังไม่ยืนยัน remote execution จบ | ไม่ auto reattempt; terminal metadata ไม่พิสูจน์ cancellation/no effect |

HTTP status อย่างเดียวไม่พิสูจน์ no effect โดยเฉพาะ proxy/transport failures. Eligibility ต้องมาจาก checked operation/profile semantics ไม่ match ข้อความตัวอย่างเพียงประโยคเดียว. Advanced terminal reattempt ยังไม่อนุญาต auth/policy bypass หรือ unknown-outcome replay

**Current contract limit:** public `TaskSafeError.code` เป็น string ไม่ใช่ closed replay-eligibility enum; queue capacity กับ global limiter ใช้ `429/rate_limited` ร่วมกัน และ internal no-acceptance subtype ไม่ออก public response. ดังนั้น client ตั้งแต่รุ่น 0.1.0 ไม่เปิด automatic fallback หลัง Task POST หรือ terminal failure จาก code/prose ที่เดาไว้. เมื่อเปิด terminal setting แต่ไม่มี verified eligible category ให้แจ้งเหตุผลและคืน Task result เดิม ไม่ส่ง inference ใหม่. Known Direct-only preselection ยังทำงาน; expired ยังคง excluded ตาม policy

First-run default ไม่ถามเรื่อง failure taxonomy ให้แสดงเพียง “สลับวิธีอัตโนมัติเฉพาะกรณีปลอดภัย: เปิด”. การเปิด terminal reattempt เป็น advanced explicit setting พร้อม cost/duplicate-risk explanation. ผลต้องบอก selected method, actual method และ fallback reason
