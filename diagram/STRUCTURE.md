# Nodeclaw-Image-Gen: Structure

> **Current Version:** 0.1.1
> **Status:** Runnable technique tools and AI auto install guidance verified in source/local scope. Publication and OS/Node results require matching GitHub release/CI; prior v0.1.0 evidence remains revision-scoped
> **Session:** 30328a2c-b111-4518-970b-7cf10fc0832a
> **Textual authority:** [Image-generation tool design](../design/nodeclaw-image-gen.design.md)
> **Full history:** [Design history](../changelog/nodeclaw-image-gen.changelog.md)

## สิ่งที่เครื่องมือนี้เชื่อม

ผู้ใช้คุยกับ text model ใน harness เดิม. Skill ช่วยจัด brief/choice form และ CLI เป็นผู้เรียก API/บันทึกภาพ ไม่เพิ่มบริการฝั่ง server

```mermaid
flowchart TD
    User --> Harness
    Harness --> Skill
    Skill --> NativeChoiceTool
    Skill --> ImageCLI
    Config --> ImageCLI
    HarnessEndpointContext --> ImageCLI
    ImageCLI --> ModelDiscovery
    ModelDiscovery --> ApplicableMainCoreCatalog
    ApplicableMainCoreCatalog --> SequentialModelsList
    SequentialModelsList --> MergedModelView
    MergedModelView -. optional exact name .-> ManualModelWhenNeeded
    ImageCLI --> TaskAPI
    TaskAPI --> SameTaskPolling
    SameTaskPolling --> LocalImageFiles
    ImageCLI --> DirectImagesAPI
    DirectImagesAPI --> LocalImageFiles
    Skill -. optional .-> HarnessSearchTool
    Skill -. optional .-> StyleTechniqueData
    StyleTechniqueData --> ShippedTechniqueTools
    ShippedTechniqueTools --> PNGPreparation
    PNGPreparation --> SavedTilePlanAndEditSpecs
    SavedTilePlanAndEditSpecs --> ImageCLI
    LocalImageFiles --> PNGValidationAndMerge
    ShippedTechniqueTools --> PNGValidationAndMerge
    PNGValidationAndMerge --> HiresAndOriginalSizePNGs
    ImageCLI -. optional reference .-> ProviderDocs
```

NativeChoiceTool/HarnessSearchTool หมายถึง tool ที่ harness มีจริง ไม่ใช่บริการที่แพ็กเกจสร้างเอง. ModelDiscovery อยู่ใน CLI เดิม; ลูกศร catalog → models แสดงลำดับการอ่าน ไม่ใช่ server relay. Manual model เป็นทางเลือก ไม่ใช่บังคับผ่าน catalog. Task/Direct เป็นทางเลือก execution เดียวต่อ request ตาม policy ไม่ได้ยิงสองงานขนาน

## ขอบเขต source และ distribution

```mermaid
flowchart LR
    PlatformSubtree --> VerifiedPackagePayload
    VerifiedPackagePayload --> PublicGitHubRepository
    PublicGitHubRepository --> GitHubRelease
    PublicGitHubRepository --> ClaudeMarketplace
    GitHubRelease --> StandaloneSkillInstall
    ClaudeMarketplace --> ManagedPluginInstall
    UserConfig --> StandaloneSkillInstall
    UserConfig --> ManagedPluginInstall
    UserCustomPacks --> StandaloneSkillInstall
    UserCustomPacks --> ManagedPluginInstall
```

| พื้นที่ | Owner |
|---|---|
| `<platform-root>/script/Nodeclaw-Image-Gen/` | Canonical source, design และ verification |
| `skills/nodeclaw-image-gen/` | Portable skill/runtime payload เมื่อพัฒนา |
| User config/state directories | Config, request handles, custom packs; ไม่อยู่ใน plugin cache |
| Public repository/release | Distribution ของ checked package เท่านั้น |
| Existing Main Core catalog | NodeClaw public model metadata, ไม่ใช่ inference endpoint |
| PAYG/custom Image API | Generate/Edit execution ที่เลือก |
| Existing NodeNetwork `/docs` | Downstream Add-On & Skill introduction, ไม่ใช่ tool design authority |

Source changes มาจาก canonical subtree. CLI, config/model discovery, Task/Direct execution, local files, content packs และ install/update มี focused/local proof; v0.1.0 public repo/release เผยแพร่แล้วและ OS/Node CI ผ่านทั้งหกเซลล์. Public release download/staging ตรวจ byte parity กับ canonical allowlist แล้ว. Styles กับ techniques เป็นอิสระโดย text model เดิมเลือกและจัด brief; shipped `technique-tools.mjs` และ `raster.mjs` ทำ deterministic preparation/check/colour/merge ด้วย bundled pngjs7 MIT. Tools สร้าง Edit specs ให้ clientเดิม ไม่ส่ง HTTP เอง. Work dir เป็น local images/geometry owner ไม่ใช่ queue/service; executable helpers มากับ full skill release ส่วน content syncยังJSON/Markdownเท่านั้น. Source releaseมี design/changelog/docs/diagram แต่ installercopyเฉพาะ skill root. Current v0.1.1 local tests26/26, syntax/JSON/package และ Frontendtypecheckผ่าน; new revisionยังไม่อ้าง OS/Node CI จนมีผลจริง. ไม่มี Telegram/storage upload. Installed native forms, Grok Bot integration, paid Provider requests และ production deployment ยังไม่มี proof ในรอบนี้

Runtime sourceอยู่ `skills/nodeclaw-image-gen/scripts/`: `image-gen.mjs` dispatch → config/model selection → images/tasks → output. `http.mjs` เป็น shared bounded HTTP boundary; content/distributionใช้manifest ownerร่วมกัน. `techniques prepare/check/merge` static-dispatch เข้า `technique-tools.mjs` → `raster.mjs` → vendored `pngjs`; ไม่ execute pathจาก downloaded metadata. `script/`เป็นauthoring/install/release tooling ไม่ใช่serviceใหม่
