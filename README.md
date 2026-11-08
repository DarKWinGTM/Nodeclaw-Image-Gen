# Nodeclaw-Image-Gen

Skill + CLI เล็กสำหรับให้ text model เดิมช่วยสร้าง/แก้ภาพผ่าน NodeClaw หรือ custom OpenAI-compatible Images API พร้อมบันทึกผลเป็นไฟล์ ไม่ต้องมี Python, npm runtime dependencies, server, daemon หรือ MCP server

**Local verification:** Linux, Node.js 22.9.0. ผล Windows/macOS/Linux บน Node.js 22/24 ดูจาก [CI matrix ของ revision ที่เลือก](https://github.com/DarKWinGTM/Nodeclaw-Image-Gen/actions/workflows/verify.yml); ผล local ไม่แทน CI หรือ native harness integration

Distribution: [GitHub repository](https://github.com/DarKWinGTM/Nodeclaw-Image-Gen) · [Releases / ดาวน์โหลด](https://github.com/DarKWinGTM/Nodeclaw-Image-Gen/releases). ใช้เฉพาะ release ที่เผยแพร่แล้ว; ไม่ต้องมี npm package

## 1. เตรียมเครื่อง

ใช้ Node.js 22+ ที่ยังได้รับ support แนะนำ supported LTS. ดาวน์โหลด/แตก release ที่เผยแพร่จริง หรือใช้ source package นี้ โดยคำสั่งด้านล่างรันจาก root ของแพ็กเกจ

ตั้ง `NODECLAW_API_KEY` ด้วย secret/environment mechanism ของเครื่องก่อนส่งคำขอ ไม่ paste key ลง chat, config JSON หรือ command arguments. แพ็กเกจไม่อ่าน OAuth/session stores และไม่ตั้ง permissions ให้เอง

## 2. ติดตั้ง Skill

Standalone preview ก่อนติดตั้ง:

```bash
node script/install.mjs --harness claude-code
node script/install.mjs --harness claude-code --yes
```

Codex ใช้ `--harness codex`; project scope เพิ่ม `--scope project` จาก root ของโปรเจกต์ที่ต้องการติดตั้ง หรือระบุ `--target DIR` โดยตรง

- Claude Code: user `~/.claude/skills/nodeclaw-image-gen`, project `.claude/skills/nodeclaw-image-gen`
- Codex: user `~/.agents/skills/nodeclaw-image-gen`, project `.agents/skills/nodeclaw-image-gen`
- Existing standalone installation ต้องเพิ่ม `--replace` เพื่อยืนยันการแทนที่; ปฏิเสธ target ที่เป็น plugin cache/other owner หรือมีไฟล์ที่ไม่รู้ owner
- ติดตั้งครบทั้ง skill directory; config/state/custom packs อยู่ user directories แยกออกมา ไม่ถูกอัปเดตทับ

Claude marketplace manifests อยู่ `.claude-plugin/` และผ่าน local validator. ติดตั้งจาก public repository ผ่าน self-hosted marketplace:

```bash
claude plugin marketplace add DarKWinGTM/Nodeclaw-Image-Gen
claude plugin install nodeclaw-image-gen@nodeclaw-image-gen
```

นี่คือ self-hosted marketplace ไม่ใช่การรับรอง/รับเข้า Anthropic plugin directory. Directory submission ยังต้องเลือก license และจัด icon; แพ็กเกจไม่กำหนดสิทธิ์เผยแพร่แบบ open-source แทนเจ้าของ

Grok Bot import/native-choice/script integration ยังไม่ยืนยัน จึงไม่มี guessed installer path และไม่อ้างว่า cloud file คือ desktop file

## 3. ตั้งค่าและสร้างภาพ

```bash
node skills/nodeclaw-image-gen/scripts/image-gen.mjs setup
node skills/nodeclaw-image-gen/scripts/image-gen.mjs generate --prompt "A quiet riverside town at sunrise" --dry-run --json
node skills/nodeclaw-image-gen/scripts/image-gen.mjs generate --prompt "A quiet riverside town at sunrise" --yes --json
```

ค่าแนะนำ: NodeClaw, `gpt-image-2`, Task-first, หนึ่งภาพ, output `./generated-images/`. Relative paths อ้างจาก directory ที่เรียกคำสั่ง ไม่ใช่ที่ติดตั้ง skill; เรียก absolute script path จาก workspace ของคุณได้

เมื่อใช้ผ่าน skill ตัว model จะสรุป operation/model/style/endpoint/method/output และใช้ native choices ที่ harness มีจริงเพื่อยืนยันครั้งเดียว ไม่ถามสิ่งที่ระบุแล้ว. CLI โดยตรงใช้ `--yes` เป็น explicit authorization; dry-run ไม่สร้างภาพ

## 4. แก้ภาพ

```bash
node skills/nodeclaw-image-gen/scripts/image-gen.mjs edit --prompt "Change only the sky to sunset; preserve the town" --image "./original image.png" --dry-run --json
node skills/nodeclaw-image-gen/scripts/image-gen.mjs edit --prompt "Change only the sky to sunset; preserve the town" --image "./original image.png" --yes --json
```

เพิ่ม `--image` สำหรับหลายภาพ หรือ `--mask FILE` เมื่อ API/model รองรับ. ใช้ `--spec FILE` สำหรับ brief/settings แบบ JSON และ `--request-json FILE` สำหรับ native advanced request. เช่น Google `contents/parts` ต้องเลือก NodeClaw compatibility profile ที่ตรงจริง ไม่เดาจากชื่อโมเดล. Explicit CLI flags แซง spec; การมี `yes` ในไฟล์ไม่แทน `--yes`

## 5. ผลลัพธ์และ resume

ผลจาก CLI เป็น JSON สรุป paths/status; `--json` ทำเป็นบรรทัดเดียว. ไม่พิมพ์ key/raw Base64/private prompt. ภาพเก็บตาม actual bytes/format ที่ได้ ไม่แปลงไฟล์หรือ overwrite ของเดิม

```bash
node skills/nodeclaw-image-gen/scripts/image-gen.mjs resume --handle "<returned-handle-path>" --json
```

| Status / exit | ความหมาย |
|---|---|
| `saved` / 0 | บันทึกภาพที่ API ส่งมาจริงครบแล้ว |
| `failed` / 1 | รู้ว่าไม่สำเร็จ; input/config invalid ใช้ exit2 |
| `pending` / 3 | ยังไม่จบ ใช้ handle รอต่องานเดิม |
| `outcome_unknown` / 4 | ยังยืนยันผลการทำงานไม่ได้ ห้าม create ใหม่อัตโนมัติ |
| `save_failed` / 1 | เก็บไฟล์ที่สำเร็จไว้แล้ว ใช้ same-result handle ลองบันทึกส่วนที่เหลือ ไม่ Generate ใหม่ |

Task handle เก็บ identity/endpoint/output intent ไม่เก็บ prompt/key/input bytes. Resume ใช้ original endpoint/proxy path ที่ตรงกับ current configured/harness candidate และใช้ key binding ปัจจุบัน ไม่เชื่อชื่อ env จาก handle; ถ้า original binding หายให้ตั้งค่ากลับอย่าง explicit ก่อน

Partial-result recovery file เป็น private local artifact อาจมี image bytes/result URL ที่จำเป็นสำหรับ retry saving; อย่าเผยแพร่ไฟล์นี้. URL อาจหมดอายุได้. Ctrl-C หยุดรอ ไม่ cancel remote Task; ภาพสำเร็จไม่ได้พิสูจน์ billing finality

**ไม่มี Telegram storage upload, rehosting หรือการส่งผลไปฝากบริการอื่น**. Edit ส่งเฉพาะ source images ที่เลือกไปยัง inference API เพื่อแก้ภาพ ไม่ใช่ storage subsystem

## Styles และ Techniques

```bash
node skills/nodeclaw-image-gen/scripts/image-gen.mjs styles list --json
node skills/nodeclaw-image-gen/scripts/image-gen.mjs techniques list --json
node skills/nodeclaw-image-gen/scripts/image-gen.mjs techniques show pixel-art-detail --json
```

Style คือรูปลักษณ์; technique คือขั้นตอน. ใช้ร่วมกันหรือแยกกันได้อย่างอิสระ โดย text model เดิมเป็น orchestrator ไม่มี style→technique allowlist หรือบริการ AI อีกตัว

Bundled styles: Tarot ink, Pixel art และ Clean product. Techniques: Preserve composition และ Tiled Pixel Art detail refinement

**Pixel Art technique เป็น workflow ไม่ใช่ raster engine ใน CLI:** ต้องมีเครื่องมือตัด/nearest-resize/คืนสี/ต่อภาพที่อนุมัติแล้วก่อนเริ่มเสียเงิน. ใช้ต้นฉบับที่ยืนยันองค์ประกอบ, คำนวณ tiles+overlap, Edit ทีละชิ้น, ตรวจ geometry/alpha, คืนสีเดิม แล้วส่งภาพใหญ่และภาพขนาดต้นฉบับ. ไม่รับประกันไร้รอยต่อ ไม่ auto paid redraw และไม่แถม Python. การตรวจครั้งนี้ไม่พบ `magick` บนเครื่องพัฒนา; automatic cut/merge/visual quality ยังไม่ได้พิสูจน์

Custom styles วาง JSON ใต้ user data `custom/styles/`; custom techniques วาง `<id>/technique.json` + `WORKFLOW.md` ใต้ `custom/techniques/`. เลือกด้วย `custom:<id>` จึงไม่ชน official ID. ใช้โครงจาก bundled examples และเพิ่มเฉพาะข้อมูล ไม่ใช่ executable hook

เพิ่ม official techniques/styles ผ่าน GitHub sync หรือ full skill update:

```bash
node skills/nodeclaw-image-gen/scripts/image-gen.mjs techniques sync
node skills/nodeclaw-image-gen/scripts/image-gen.mjs techniques sync --yes
```

ต้องมี release จริงก่อน sync ทาง network จะใช้ได้. Content sync ใช้ shared official pack owner (มีทั้ง styles/techniques), preview version/file count ก่อน apply; ไม่ทับ custom และไม่รัน downloaded code. Bundled packs จาก full skill update กับ synced packs ใช้ version selection เดียวกัน. Technique ที่ต้อง capability ใหม่จะระบุ prerequisite ไม่ติดตั้งเครื่องมือให้เอง

## Config และ custom provider

เลือก config เพียงไฟล์เดียว: `--config` → `NODECLAW_IMAGE_GEN_CONFIG` → OS user config directory. Field precedence: explicit CLI/spec → env → selected config → built-ins. ดู [config.example.json](config.example.json)

- Linux: `${XDG_CONFIG_HOME:-$HOME/.config}/nodeclaw-image-gen/config.json`
- macOS: `~/Library/Application Support/Nodeclaw-Image-Gen/config.json`
- Windows: `%APPDATA%/Nodeclaw-Image-Gen/config.json`

Auto endpoint ใช้ active exposed harness endpoint ก่อน configured fallback แล้วจึง native `https://payg.nodenetwork.ovh`. `--api-base-url`/spec endpoint pin ไม่ข้ามระบบอัตโนมัติ. รับ `--harness-endpoint` และ `--harness-api-key-env` เมื่อ effective provider ไม่ถูก expose; ไม่อ่าน/เดา layered Codex config. Local loopback proxy ต้องเลือก `--allow-local-http` หรือ config `allowLocalHttp:true`; ไม่ปิด TLS verification

ตัวอย่าง custom profile:

```bash
node skills/nodeclaw-image-gen/scripts/image-gen.mjs generate --api-base-url "https://images.example/v1" --provider openai-compatible --api-key-env CUSTOM_IMAGE_API_KEY --model "exact-image-model" --prompt "A mountain cabin" --dry-run --json
```

`apiBaseUrl`, `catalogUrl`, `apiDocsUrl` แยกหน้าที่กัน. Discovery อ่าน applicable payg-model-data แล้ว `/v1/models` ตามลำดับ รวม exact IDs ไม่ซ้ำ; ไม่มี list ยังระบุ exact model ได้. `--skip-discovery` เลือก manual/unverified path โดยไม่อ่าน catalog. NodeClaw `/v1/models` เป็น Chat projection ไม่พิสูจน์ Generate/Edit capability

Main env overrides: `NODECLAW_IMAGE_GEN_API`, `_MODEL`, `_METHOD`, `_FALLBACK`, `_FALLBACK_TERMINAL`, `_CATALOG_URL`, `_DOCS_URL`, `_OUTPUT_DIR`, `_API_KEY_ENV` (ใช้ prefix `NODECLAW_IMAGE_GEN` เต็มทุกตัว). Boolean รับ `true/false/1/0`; invalid values แจ้ง ไม่ fallback เงียบ ๆ

## Task / Direct และ fallback

Default Task บันทึก signature ก่อนส่ง, poll/resume งานเดิม และรักษา unknown acceptance. Known Direct-only custom profile resolveเป็นDirectก่อนส่งเมื่อfallbackเปิด. ไม่ใช้ HTTP status อย่างเดียวเดาว่า Task queue รับงานหรือไม่ และไม่สลับเพื่อลัด auth/policy/quota

`--method direct` เลือก Direct โดยตรง; `--fallback false` ปิดการเลือกวิธีสำรอง. Terminal reattempt default ปิด (`onTerminalFailure:false`) เพราะอาจเสียเงินสองครั้ง. รุ่น 0.1.0 ยังไม่มี public terminal error category ที่ยืนยัน retry eligibility ได้ จึงไม่ส่ง inference ใหม่แม้เปิด advanced setting และแจ้งเหตุผลแทน; expired/unknown/policy ไม่เข้าเงื่อนไข. รายละเอียดอยู่ [API reference](skills/nodeclaw-image-gen/references/api-contract.md)

## API docs และอัปเดต

`docs fetch` อ่าน matching cached/reference; `docs sync` refreshจากoptional public URLแบบboundedโดยไม่ส่งAPIauth. ไม่มีdocsไม่blockcustomและไม่เอาOpenAPIมาเปลี่ยนendpoint/encoderเอง

Standalone code update:

```bash
node skills/nodeclaw-image-gen/scripts/image-gen.mjs update check
node skills/nodeclaw-image-gen/scripts/image-gen.mjs update apply --target "<standalone-skill-directory>" --yes
```

Plugin-managed updateใช้Claude plugin manager ไม่ใช้คำสั่งนี้เขียนplugin cache. Updaterใช้versionedJSONmanifest+รายไฟล์releaseassets ตรวจpath/size/SHA-256ก่อนswitchและรักษาoldinstallเมื่อverifyfail; config/state/customไม่อยู่installpayload. Checksumคือintegrityไม่ใช่publishertrust

## Development และ publication

```bash
npm run check
npm test
npm run package -- --dry-run
npm run package -- --out "<new-empty-output-directory>"
```

Packagingใช้local `tar` สำหรับmanualdownload archive; installer/updaterไม่ต้องมีtar/Git/Pythonหรือarchiveparser. Assetsมีrelease/content manifests, hashesและpayloadรายไฟล์จากallowlistเท่านั้น. Authoringอยู่package subtreeในplatform; publicrepoเป็นdownstreamdistribution ไม่ใช่developmentrootอีกชุด

Local testsครอบconfig/discovery, Taskidentity, Generate/Editcarriers, SSEcompletion, actualsaving, contentintegrityและisolatedinstall/update. ไม่มีpaid/liveprovider, installednativeformsหรือproductiondeployment. CIประกาศWindows/macOS/LinuxกับNode22/24 แต่ต้องดูผลรันจริงก่อนเรียกเซลล์ใดverified
