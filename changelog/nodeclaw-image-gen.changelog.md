# Nodeclaw-Image-Gen: Changelog

> **Current Version:** 0.1.3
> **Status:** v0.1.3 native configuration refresh source/local verified. Publication/OS-Node CI use the matching release revision; installed same-session adoption remains a separate acceptance gate
> **Session:** b3b4111c-5f9a-4ec7-8bcf-fd76bb593619
> **Target Design:** [nodeclaw-image-gen.design.md](../design/nodeclaw-image-gen.design.md)
> **Structure:** [STRUCTURE.md](../diagram/STRUCTURE.md)
> **Chain shape:** Single-file changelog parent; design uses mapped flat sibling shards

## 0.1.0: Design baseline

### Selected direction

- แยก tool authority ใต้ `script/Nodeclaw-Image-Gen/` จาก Main Core design; sourceยังอยู่ใน platform และ public GitHub repoเป็น downstream distribution
- Node.js ESM built-ins + JSON config + portable `SKILL.md`; ไม่มี Python, third-party runtime dependencies, daemon, database หรือ MCP serverใหม่
- NodeNetwork native default, preferred `gpt-image-2`, Task-first Generate/Edit พร้อม Direct selection; custom OpenAI-compatible endpoint/manual modelยังใช้ได้แม้ไม่มี catalog
- Model discoveryทำตามลำดับ applicable `payg-model-data` → `/v1/models`; merge exact model IDsไม่ซ้ำและรักษา source/operation provenance; ไม่มีทั้งสองยังใช้ model nameเองได้
- เก็บ Task signatureก่อนPOST, poll/resumeงานเดิม, แยก known-no-effectจากunknown acceptance และกำหนด configurable bounded method fallbackโดยไม่อ้าง failed/expiredว่าnocharge
- Compact native-choice wizard, optional style/search/technique suggestions, custom packsแยกจากofficialsync และ optional provider-specific API docs
- เตรียมขอบเขต GitHub release/update, Claude marketplace, READMEและAdd-On & Skill docsintegration โดยไม่เริ่มpublication/deployment

### Checked evidence

- อ่าน canonical PAYG OpenAPI และ public development YAML ที่ผู้ใช้ระบุได้ `openapi: 3.1.0`, `info.version: 1.2.0`
- Public development model catalog HTTP200พบ `gpt-image-2`, `gpt-image-2.5`, `gpt-image-2.5-flare`, `gpt-image-2.5-sunburst` พร้อมGenerate/Edit compatibility pairs; ไม่ใช่per-key liveexecutionหรือbillingproof
- Checked Gateway sourceของ `/v1/models` ส่ง `chat.completions` label; จึงไม่ใช้Chat-onlylistตัดสินImageabsence
- ตรวจเดิมCLIProxyAPI scriptและHelperpublicationboundaryเป็นreference ไม่reactivateหรือเปลี่ยนsourceเหล่านั้น

### Verification and limits

- รอบนี้ตรวจ document references, embedded JSON examples, namespace/scope consistency และ requirement coverage; ไม่มี runtimecode/test/installation/inference
- Production docs/catalog serving, Grok Bot file-import/native-choice integration, paidGenerate/Edit, updater/pluginruntimeและpublicationยังไม่ได้ตรวจ
- Claude artifactเทคนิคให้เพียงshellในการอ่านครั้งนี้; suppliedTarotpromptเป็นตัวอย่างที่ตรวจอ่านได้จริง
- Written designรอuserreviewก่อนimplementationplan/code. ไม่สร้างGitHubrepo, commit, push, tag, releaseหรือproductiondocsdeploymentในรอบนี้

## 0.1.0: Client and skill source implementation

- Mainสร้างNode.jsESMclientในcanonicalpackage: setup/config/envprecedence, activeharness→configured→nativeendpointbinding, orderedcatalogmergeและmanualmodel
- Generate/Editใช้Task-firstหรือDirectตามprofile พร้อมsignatureก่อนPOST, sameidentitypoll/resume, finiteJSON/SSEcompletion, actualimagefilesและpartial-save recoveryโดยไม่สร้างงานใหม่
- Skillใช้compactnativechoicesตามcapabilityจริง; stylesกับtechnique workflowsเป็นอิสระโดยtext modelเดิมorchestrate. Bundled3stylesและ2techniquesรวมPixelArtdetailrecipeซึ่งต้องมีlocalrastertoolก่อนเริ่มtileedits
- Officialcontentเพิ่มผ่านGitHubpacksyncหรือfullskillupdateโดยsharedmanifestowner; customnamespaceแยก. Standaloneinstall/update, plugin/marketplacemetadataและallowlistedreleasepackagingมีsourceแล้ว
- ไม่มีTelegramstorageupload/rehosting, Pythonruntime, newserver/daemon/MCPหรือplatforminference/catalog/billingchanges
- Final source reviewพบresume handleเลือกendpoint/key-envเองได้; Mainยืนยันfocusedregression RED→GREENแล้วrebindจากcurrenttrustedcandidateเท่านั้น ปฏิเสธorigin/proxypathที่ไม่ได้ตั้งค่า และไม่ใช้secretnameจากhandle
- CheckedTaskcontractไม่มีclosedpublicterminalretryenumและqueue429ซ้ำกับgloballimiter; เอาprovisionalerrorallowlistออกหลังregressionยืนยันว่าเดิมส่ง2POST. รุ่นนี้ไม่autoInferenceใหม่หลังTaskPOST/terminalerrorแม้advancedopt-in; knownDirect-onlypreselectionยังใช้ได้
- Localverification: `npm test` ผ่าน20casesบนLinuxNode22.9.0; `npm run check`ตรวจESM/JSON; realreleaseassets→hashverification→isolatedinstall→CLIhelpผ่าน. Plugin/marketplacemanifestsvalidateผ่าน; directorysubmissionยังขาดchosenlicense/iconไม่ใช่self-hostedmarketplacegate. Fresh-contextskill reviewเป็นsyntheticinterpretationเท่านั้น ไม่ใช่harness execution proof
- READMEและAdd-On&Skillsource/EN-THlocalesอัปเดตหลังsourceimplementationchecks ไม่ใช่productiondeployment
- ยังไม่อ้างpaid/liveprovider, nativeharnessforms, Windows/macOSruntime, GrokBotintegrationหรือautomaticPixelArtcut/merge/visualquality. GitHubrepo/releasepublicationเป็นgateแยก

## 0.1.0: Public distribution

- เผยแพร่ [DarKWinGTM/Nodeclaw-Image-Gen](https://github.com/DarKWinGTM/Nodeclaw-Image-Gen) และ [release v0.1.0](https://github.com/DarKWinGTM/Nodeclaw-Image-Gen/releases/tag/v0.1.0) จาก canonical subtree เท่านั้น ไม่มี platform push, nested development repository หรือ license ที่เลือกแทนเจ้าของ
- Tag/main ตรง commit `8df6b37c9dc849e9a52da09b051c2983a09308a4`; payload 31 ไฟล์, release assets 35 ไฟล์รวม archive/manifests/SHA256SUMS. Remote size/digest ตรง local และ actual public updater download/staging ตรวจ code 31 ไฟล์ตรง canonical bytes พร้อม content pack 7 ไฟล์
- [CI run 42533452340](https://github.com/DarKWinGTM/Nodeclaw-Image-Gen/actions/runs/42533452340) ผ่าน Windows/macOS/Linux × Node.js 22/24 ครบหกเซลล์ ทั้ง syntax/JSON,20 tests,package dry-run. Initial macOS test ล้มจาก symlink ใน temp path; แก้ test ใช้ canonical realpath โดยไม่เปลี่ยน installer guard
- Local Git รุ่นเก่าไม่รองรับ initial-branch option จึงใช้ init+symbolic-ref. Snapped gh อ่าน host `/tmp` ไม่ได้และ stdin upload ไม่มี Content-Length ที่ต้องใช้; ตรวจ release ว่างก่อนเปลี่ยนไป existing package-owned dist output ไม่ retry แบบไม่ทราบผล. เปลี่ยนเฉพาะห้า assets ที่แก้ใน unpublished draft โดยเก็บชุดเดิม local ก่อน publish; public release ไม่ถูก force-replaced
- Existing Add-On & Skill source เปิด repository/release links และ EN/TH labels แล้ว; frontend typecheck:with-chat ผ่าน exit0. ไม่ deploy website หรือ platform commit
- Paid inference/billing, installed harness/native forms, Grok Bot และ automated Pixel Art raster/visual quality ไม่อยู่ใน proof นี้;ไม่มี Telegram/storage upload. Public marketplace manifests ไม่เท่ากับ Anthropic directory submission

## 0.1.1: Runnable technique tools and quick installation

- แก้ขอบเขต technique จาก context-only recipe เป็น workflow + shipped tools: modelเลือก brief/style/เทคนิค/ยืนยันค่าใช้จ่าย/ประเมินภาพ; scriptsทำ deterministic preparation/coordinates/validation/processing โดยไม่ต้องให้แต่ละ model เขียนโค้ดภาพใหม่
- Existing `techniques` CLI เพิ่ม prepare/check/merge: Pixel Art snapshot/hash, grid-aligned overlap/transparent padding, nearest tiles, skipped transparent/protected tiles, per-tile Edit specs, actual PNG geometry/alpha diagnostics, signed colour restoration ด้วย alpha-aware three-box Gaussian approximation, linear overlap และสอง output sizes. Missing/invalid block normal merge; explicit partialมีชื่อ/สถานะต่างและexit3; no overwrite
- Preserve-compositionใช้ shipped prepare/checkสร้างone-call specและตรวจdimensions/alpha/protection diagnosticsผ่าน Image Edit clientเดิม. No new API client/queue/orchestrator/storage uploader
- Bundle unmodified pngjs7.0.0 lib sources + MIT licenseและsource-integrity provenance. Node.js22+ปลายทางไม่ต้องมีPython/ImageMagick/npm install; PNGtoolsรับเฉพาะsingle-frame non-interlaced8-bitเพื่อให้decodeมีchecked byte/pixel bounds. OrdinaryAPI result savingยังpreserveactualformat
- README, SKILL.md, bundled technique workflows/descriptions และ style descriptionsเป็นEnglish base. User interactionยังตามภาษาที่เลือก. Quick installมี AI Auto Install promptให้assistantดำเนินการติดตั้งจนจบผ่านinstallerเดิม: detect harness, preview user-scope target, execute`--yes`, offlineCLIchecksและversion/path summary; ถามเฉพาะprerequisite/trust/permission/replacementโดยไม่อ่านsecretsหรือเรียกAPI. มีsupported Claude Code `/plugin` commands และManualClaude/Codex; existing NodeNetwork docs cardใช้copy component/native disclosuresพร้อมEN/THโดยไม่เพิ่มCSS/state/renderer
- Source repository/release allowlistรวมexisting design/changelog/docs/diagram; installed runtimeยังcopyเฉพาะskill. แก้5outside-package hyperlinksเป็นpublicreferenceหรือexplicitplatformsourcecontext. Content syncยังJSON/Markdownเท่านั้น; newpack/techniqueminClientVersion0.1.1ป้องกันการใช้helperที่oldclientไม่มี
- Developer proof: ก่อนimplement CLIปฏิเสธmissingtoolcommands (RED); หลังimplement actualPNGworkflowsผ่าน. Final local `npm test`26/26,0fail0skip รวมreal prepare→existing Edit planner→check/merge, signed detail/colour, alpha/protected mask, overlap blend, missing/wrong dimensions, partial/no-clobber/tampered job, minimum-client/content restrictions และisolated installed helper. `npm run check`41scripts/11JSON, packaging dry-run66files/7content และ frontend`typecheck:with-chat`exit0. LocalMarkdownlinks34จุดผ่าน; README/installedguidanceไม่มีThai base textในscopeที่ตรวจ
- Source-local checkpointนี้ไม่ยืนยันpublication/new revision CI; ตรวจสถานะจริงจาก[v0.1.1 release](https://github.com/DarKWinGTM/Nodeclaw-Image-Gen/releases/tag/v0.1.1)และ[revision CI](https://github.com/DarKWinGTM/Nodeclaw-Image-Gen/actions/workflows/verify.yml). Publishedv0.1.0ไม่ถูกแก้ทับ. Bounded read-only reviewไม่พบconfirmedpath/overwrite/protection/false-completion/input-boundbypassในscopeที่ตรวจ; syntheticguidancecasesเป็นinterpretationเท่านั้น. Source-derivedmergeaccumulatorที่pixelcap320MiBยังไม่ใช่benchmarkหรือtotalRAMguarantee และระบุในworkflow/README. PaidProvider/financialfinality, actualnativeharness/nativeform, GrokBot, visualquality/seamlessness และproductionwebsitedeployไม่อยู่ในproofนี้

## 0.1.2: Address/key setup, explicit native wire and additional styles

- User-selected extensionของexistinginstaller/setupรับ`--api-base-url`กับ`--api-key`โดยตรง; `--interactive`ซ่อนlocalkeyentryและ`--api-key-stdin`รับboundedsecurepipe. Previewไม่รับinput/ไม่write; ordinarykeyargumentsมีhistory/process-listlimitที่ระบุ. Existingconfigต้องexplicitreplace; installerแยก`--replace-config`จากcodereplacement. Storeเป็นprivateplaintextuserconfigนอกskill; POSIXnewfile0600 ไม่อ้างencryption/WindowsACL
- Existingconfig/authownerผูกkeyกับexactnormalizedbase/proxyprefix; context/endpointJSON/handles/statusไม่มีkey. Address/keysetupเลือกpersistentconfiguredpin; legacyautomodeharness→configured→nativeยังอยู่. OptionalENVaddress/keypairoverrideได้แต่ไม่ย้ายkeyตามanotherpin; modeldiscoveryและresumeใช้samecurrentbinding. Addresschangeไม่retainoldkey
- Claudepluginmanifestประกาศnativeaddressและ`sensitive:true`key. Exec-formSessionStarthookส่งtwooptionenvผ่านsupportedowner-onlysessionexportเข้าสู่clientเดิม ไม่injectkeyในskilltext/argvและไม่extractsecurestore. ต้องnewsessionหลังconfigure; bridgefileเป็นplaintext/subprocessenvและมีPowerShelllimitations จึงมีlocalsetuprecovery. NativeUI/keychain/OSacceptanceยังไม่ได้ทดสอบ
- Existingclientต่อTask/Imagesrouteจากbaseและnormalizeknown`/v1|/v1beta`boundaryพร้อมproxyprefix. Explicit`apiMode=gemini`เป็นDirectnativecontents/parts/inlineDataผ่าน`/v1beta/models/{model}:generateContent`; existing`google_image_generate_content`Images/Taskrouteยังเดิม ไม่เดาจากmodelname. NativeText-familytransportไม่ใช่DirectImagepricing/readinessproof. Text-only/safetycandidateไม่อ้างsavedimage
- QuickinstallDocsแก้ตามlatestuserdirectionเหลือAIautoinstallpromptเป็นหลัก+Claudemarketplace/nativeAPIaddressกับsensitivekeyform; เอาManualblockและNoextra server/Telegramintrocopyออก. Promptต้องdownload/verifypackageก่อนรันinstaller แล้วคืนexactinstalled-pathsetup/config/updatecommandsให้user ไม่collectkeyในchatหรือclaimconfiguredก่อนuserกรอก. ExistingDocsCopyableCodeBlock/localesใช้ต่อไม่มีCSS/state/componentใหม่. README/EN-THpromptparityและfrontendtypecheckผ่าน; ยังไม่deploy/publicv0.1.2
- Focused RED→GREEN ครอบคลุม unsupported setup/install flags, env-only auth และ missing native wire/hook; local proof รวม actual files/HTTP, private modes, no-clobber/replacement, key isolation/serialization, masked entry/cancel, literal hook exports/shell-injection negative และ no-replay. Initial full-package run 34/35 ล้มเพราะ supplied collections ไม่ใช่ individual style schema; หลังผู้ใช้เลือกแปลงข้อมูล ใช้ existing data owner แก้โดยไม่เปลี่ยน loader หรือผ่อน rejection.
- เพิ่ม 55 additional presets จาก supplied collections รวม bundled 58 styles พร้อม `exampleImages[]` URLs; Tarot ink เดิมเพิ่ม sample URL โดยไม่เปลี่ยน prompt. รวม duplicate exact IDs, ไม่สร้าง prompt ให้ preview-only item, ไม่ import auto-send/action/system hints, และปรับ personal-context wording ให้ใช้เฉพาะข้อมูลที่ผู้ใช้อนุมัติ. ต้นฉบับทั้งสองคง bytes/modes ใน `references/style-imports/` นอก active discovery/content-sync ไม่มี runtime fallback หรือ media download/upload ใหม่.
- Final source/local checks: 37/37 tests, 0 fail/skip; ESM/JSON 41 scripts/68 JSON; package dry-run 123 files/62 content; exact plugin/marketplace schemas, frontend with-chat types และ EN/TH/README prompt parity ผ่าน. Directory-submission license/icon ยังเป็น unselected limit ไม่ใช่ self-hosted marketplace failure. Installed native UI/keychain, actual OS harness, real keys, paid API calls, visual quality และ website deployment ไม่อยู่ใน proof.
- ผู้ใช้เลือก git push/release จาก canonical allowlist โดยไม่ push platform หรือแก้ published prior releases. Matching publication/CI evidence: [v0.1.2 release](https://github.com/DarKWinGTM/Nodeclaw-Image-Gen/releases/tag/v0.1.2) และ [revision workflows](https://github.com/DarKWinGTM/Nodeclaw-Image-Gen/actions/workflows/verify.yml). Git-backed marketplace เลือก repository revision; standalone/content update ใช้ release assets. ผลรุ่นก่อนเป็น history ไม่ใช่ proof ของ revision นี้.

## 0.1.3: Native configuration refresh on plugin load/reload

- แทน classic `SessionStart` → `plugin-env` → session export file ด้วย native `register(on, options)` → module `session.start` → one `NODECLAW_IMAGE_GEN_PLUGIN_CONFIG` JSON pair → existing `resolveContext`/`authorization`. Native sensitive configuration ยังเป็น authority เดิม; hook เป็น transport-only ไม่มี Node import, secret-store reader, credential file, extra resolver หรือ tool interceptor.
- Existing ingress parse/validate native pair แบบ fail-closed; native-present path ignore former address/key/mode exports แม้ค่าเก่า invalid และไม่ fallback ไป saved/legacy key. Explicit CLI pin ยังมีผล แต่ native credential ใช้ได้เฉพาะ exact normalized base/proxy prefix. Context/status/dry-run/Task serialization และ persistence ไม่เพิ่ม native key.
- ถอด old writer/import/dispatch/manifest registration ใน cutover เดียว. Old export-file bytes คง untouched ไม่ถูกอ่านเป็น native authority เมื่อ binding ใหม่ present. Denied/rejected env publication แจ้ง static sanitized diagnostic โดยไม่พิมพ์ key/raw error/policy text และไม่ retry หรือเปิด fallback writer.
- เพิ่ม native hooks payload กับ release allowlist เดิม; regression ตรวจ source→asset bytes/size/SHA-256. Full package 41/41 tests ผ่าน, 0 fail/skip; ESM/JSON check 42 scripts/69 JSON และ package dry-run 126 files/62 content ผ่าน. Focused native-config และ packaging cases มี matching RED→GREEN; native sandbox 4/4 ผ่านและ hooks validation ไม่มี errors/warnings บน Claude Code 2.1.318. Running-engine declarations 2.1.312 เป็น API evidence ไม่ใช่ parent-session adoption.
- README/SKILL/design/diagram และ package/skill/plugin/marketplace versions align 0.1.3. Reconfigure/update ใช้ native reload ใน session เดิม ไม่กำหนด restart เป็น normal route. Production default, standalone setup/update, Image/Task/HTTP/output owners และ original unknown Task handle bytes/mode คงเดิมใน source-local checkpoint; ไม่มี paid/API call หรือ remote replay.
- Bounded read-only credential/architecture review ไม่พบ material finding ใน selected delta; Main ตรวจ matching anchors และ protected owners. Native kit/source tests ไม่พิสูจน์ actual Save UI, installed same-session adoption, native Windows/PowerShell, key acceptance หรือ stability. Publication/CI ดู matching [v0.1.3 release](https://github.com/DarKWinGTM/Nodeclaw-Image-Gen/releases/tag/v0.1.3)/[workflows](https://github.com/DarKWinGTM/Nodeclaw-Image-Gen/actions/workflows/verify.yml); installed update/adoption เป็น gate ถัดไป ไม่ถือว่าเสร็จจาก source checks.

## Version navigation

0.1.0 เริ่มจาก design baseline → source/local implementation → public release ใน version เดียวกัน. 0.1.1 เพิ่ม runnable technique tools และ English/Quick install. 0.1.2 เพิ่ม private config/native bridge/explicit Gemini, additional styles และ prompt-first Docs. 0.1.3 แทน startup-only native transport ด้วย load/reload module และ single-pair ingress. Public distribution/CI ใช้ matching references ของแต่ละ revision. History คงผลที่ตรวจในเวลานั้น; current status อยู่ metadata และหัวข้อ version ล่าสุด. Parent ยัง compact/coherent จึงใช้ single-file chain ไม่มี version child/inactive history ใหม่
