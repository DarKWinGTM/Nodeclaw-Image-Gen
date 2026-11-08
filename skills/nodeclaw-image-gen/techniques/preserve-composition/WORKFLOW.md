# Preserve composition

รับภาพที่ผู้ใช้เลือก, สิ่งที่จะเปลี่ยน และสิ่งที่ต้องรักษา ใช้ style ใดร่วมก็ได้โดยให้คำสั่ง change/preserve ชัดเจนไม่ขัดกัน หากสไตล์เปลี่ยนสิ่งที่ผู้ใช้ต้องรักษาให้เสนอ trade-off ก่อน ไม่เพิ่มข้อห้ามตายตัวตามชื่อ style

ทำหนึ่ง Edit request ผ่าน client เดิม แนบ selected image และ optional mask เฉพาะที่อนุญาต. Prompt ระบุการเปลี่ยนพร้อมคง camera/composition/object positions/identity ที่ต้องรักษา ไม่สร้างภาพใหม่อิสระ. ตรวจ dry-run และขอยืนยันแบบ compact ก่อนส่ง

บันทึกผลใหม่ไม่ทับต้นฉบับ หากมี vision tool ให้เทียบสิ่งที่เปลี่ยนกับสิ่งที่ต้องรักษา; ถ้าไม่มีให้ยืนยันเฉพาะ result/files ที่ตรวจได้. ไม่ทำ paid refinement เพิ่มอัตโนมัติ ไม่อัปโหลดไป storage และไม่ถือ prompt เป็นการรับประกัน likeness/geometry
