# Pixel Art: เพิ่มรายละเอียดเป็นชิ้นโดยรักษาภาพเดิม

## ใช้เมื่อใด

มีภาพที่องค์ประกอบถูกแล้วแต่ต้องการรายละเอียดเพิ่ม ไม่ใช้ประกอบฉากใหม่จากชิ้นที่วาดแยกกัน. Style เลือกได้อิสระ แต่ภาพที่ต้องคงกริด Pixel Art ต้องใช้ nearest-neighbor และไม่เปลี่ยนเป็น painted antialiasing โดยไม่เลือกใหม่

นี่เป็น orchestration recipe ไม่ใช่คำสั่ง cut/merge ที่ CLI แถมมา. ต้องมีเครื่องมือ raster ที่ผู้ใช้อนุมัติและทำ crop, nearest resize, Gaussian blur, signed channel arithmetic, alpha/mask และ compositing ได้จริงก่อนเริ่ม tile edits. ImageMagick 7 เป็นตัวเลือก ไม่ใช่ dependency ที่ติดตั้งให้เอง. หากไม่มีให้บอก prerequisite และหยุดเทคนิคนี้; Generate/Edit ปกติยังใช้ได้. ไม่ใช้ Python หรือเขียน codec ใหม่เพื่อข้ามข้อจำกัด

## 1. เลือกต้นฉบับและแผนค่าใช้จ่าย

ใช้ PNG ที่ผู้ใช้เลือก ถ้ายังไม่มีจึงเสนอ Generate ภาพตั้งต้นหนึ่งครั้งและให้ตรวจ composition ก่อน. ระบุ scale (default3, รอบละ2–3), target geometry ที่ API รองรับ, alpha/background mask และ output directory. อย่าสมมุติว่า GPT ทุกรุ่นรับได้แค่1000–1500px หรือทุก API รับ1254²

Scale หมายถึงแต่ละด้าน เช่น1024²→scale2→2048², scale3→3072². จำนวน tiles ไม่ใช่ตัวคูณความกว้าง. กริด3×2ที่แต่ละชิ้นเป็น1024²ต่อได้3072×2048 ไม่ใช่ภาพสี่เหลี่ยมจากต้นฉบับสี่เหลี่ยม; ต้อง preserve aspect ratio/crop geometry ไม่ stretch เพื่อให้ครบหกชิ้น

คำนวณ tile crops/overlap/edge padding จริงก่อนสรุปจำนวนคำขอ; เมื่อมีoverlap จำนวนชิ้นอาจมากกว่ากริดที่คิดจากภาพไม่เหลื่อม. แสดง initial generation (ถ้ามี)+tile edits+outputs ให้ผู้ใช้อนุมัติก่อนส่ง ไม่เปิดparallel workers/multi-chatหรือ paid retries เอง

## 2. ตัดและขยาย

กำหนด source dimensions W,H และ output W×scale,H×scale. ใช้ crop ที่ครอบคลุมทั้งภาพ พร้อม overlap เริ่มประมาณ25% ของ tile; ขอบที่เกิน canvas ใช้ explicit padding/crop ที่บันทึกไว้ ไม่สะท้อน/สร้างเนื้อหาเองโดยไม่บอก

บันทึก tile ID `r00_c00`, original crop coordinates, valid-region dimensions, scale, padding และ overlap ในไฟล์งานที่ user output directory. ใช้ nearest-neighbor ขยายทุก input เป็น geometry ที่ตกลง ไม่ใช้ bilinear/Lanczos. รักษา original alpha แยกไว้; ไม่ convert เป็น RGB แล้วทิ้ง transparency

ข้ามเฉพาะชิ้นว่างที่ตรวจได้ตรง mask/alpha ที่เลือก ไม่ตั้งสีชมพูเป็นค่าแทนพื้นหลังทุกภาพ. หากทั้งภาพเป็นวัตถุเดียวและ Edit ทั้งภาพเพียงพอ เสนอไม่ตัดเพื่อลดค่าใช้จ่าย

## 3. Edit ทีละชิ้น

แต่ละชิ้นใช้ CLI `edit --image FILE` กับ model/profile เดิมและ exact supported output size. ใช้ independent image request ไม่พึ่งประวัติ chat ก่อนหน้า; Task/resume ใช้ client เดิม ไม่ทำ API transport/queue อีกชุด

Prompt หลังแทน scale จากแผน:

> This is a crop of a pixel-art picture enlarged {{scale}}x. Redraw it at the same dimensions as crisp, finer pixel art. Keep every object's position, silhouette, composition, camera, colours and lighting. Do not add, remove or move objects. Preserve the specified alpha/background mask.

เพิ่ม reference pixel scale หรือ mask เฉพาะที่ผู้ใช้เลือกและ profile รองรับ. เก็บผลด้วย tile ID เดิม. Prompt ไม่รับประกันว่ารูปร่างจะไม่เลื่อน ต้องตรวจจริง

## 4. ตรวจและคืนสี

ตรวจขนาดเท่ากับ input tile, overlay edges/objects, missing/new objects และ alpha/mask alignment. Dimension mismatch ต้องเสนอ redraw/แก้แผน ไม่ resize ด้วย smooth interpolation เพื่อปกปิด. Shift/mask comparison เป็น diagnostics ไม่ใช่หลักฐานว่าไม่มี object drift ทุกจุด

คืนสีบน original-scaled และ edited tile ที่ align แล้ว:

`output = blur(original_scaled) + (edited - blur(edited))`

ทำ RGB arithmetic แบบ signed/floating intermediate ก่อน clamp; alpha/mask ไม่ปนกับ RGB. Blur radiusราว2–3 original pixelsหลังคูณ scale เป็นจุดเริ่มปรับ ไม่ใช่ค่ามาตรฐานทุกภาพ. Original low-frequencyให้สี/แสง ส่วน edited high-frequencyให้รายละเอียด แต่ไม่ได้รับประกันสี/โครงสร้างเหมือนเดิม100%

คง maskสีที่ผู้ใช้เลือกตรงตำแหน่งเดิม และคืน alphaตามต้นฉบับ. Colour-difference scoreหรือthresholdเช่น5ขึ้นกับrepresentation/metric จึงใช้เป็นheuristicพร้อมดูภาพ ไม่เป็นautomatic accept/retry rule

## 5. ต่อและส่งออก

ใช้ saved coordinatesและvalid regionsวางชิ้นกลับ, blendเฉพาะoverlapด้วยweightsที่ชัดเจน. Gaussian featherไม่เท่ากับpixel dither; ถ้าต้องคงhardpixel gridให้เลือกedge/dither strategyที่เครื่องมือรองรับจริงและตรวจรอยต่อ ไม่รับประกัน seamless จากการblendอย่างเดียว

Missing/rejected tilesให้แสดงตำแหน่งและใช้nearest-upscaled originalเป็นpartial previewเท่านั้น ไม่เรียกว่าrefinedครบ. ไม่overwriteต้นฉบับ

ส่งสองไฟล์:
- `refined-hires.png` — ขนาด W×scale,H×scale ของผลต่อจริง
- `refined-original-size.png` — ย่อกลับW,H; Pixel Art defaultใช้nearestแบบgrid-alignedและแจ้งว่าไม่เก็บรายละเอียดทุกpixelจากภาพใหญ่

แสดงก่อน/หลังทั้งภาพที่ย่อและรอยต่อ100%เมื่อมีvision/image-view toolจริง. หากไม่มีไม่อ้างว่าภาพผ่านvisualacceptance. หยุดให้ผู้ใช้ดูและอนุมัติก่อนนำไปใช้; redrawเฉพาะtileที่เลือกพร้อมadditional call count ไม่มีauto-loopหรือforceผ่านwarning

ผลคือรายละเอียดที่AIสังเคราะห์ตามreference ไม่ใช่การกู้ข้อมูลภาพจริงที่หายไป. ไม่uploadผลไปTelegram/storageหรือrehostใด ๆ
