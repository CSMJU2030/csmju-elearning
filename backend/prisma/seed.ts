/**
 * ข้อมูลตั้งต้นสำหรับเครื่องพัฒนา — `pnpm --filter backend db:seed`
 *
 * - สร้าง 5 สายงานหลัก · วิชาจากหมวดวิชาเฉพาะของหลักสูตร (อ้าง course_code ของ Core Hub)
 *   · หัวข้อละ 1 วิดีโอตัวอย่าง · แบบทดสอบท้ายวิชา 3 ข้อ (ต้องตอบถูก 2 ข้อ) · เทมเพลตเกียรติบัตรตั้งต้น
 * - รันซ้ำได้: ถ้ามีสายงานอยู่แล้วจะไม่แตะข้อมูลเดิม
 * - ไม่สร้างผู้ใช้ ไม่สร้างข้อมูลบุคคล และไม่สร้างสำเนาข้อมูลกลางของ Core Hub
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma/client';
import { COURSES, SAMPLE_VIDEO_SECONDS, SAMPLE_VIDEO_URL, TRACKS } from './seed-data';

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    if ((await prisma.track.count()) > 0) {
      console.log('มีสายงานอยู่แล้ว — ข้ามการ seed');
      return;
    }

    const template = await prisma.certificateTemplate.create({
      data: {
        name: 'เทมเพลตมาตรฐาน',
        heading: 'เกียรติบัตร',
        bodyText: 'ขอมอบเกียรติบัตรฉบับนี้ให้ไว้เพื่อแสดงว่า {name} ได้ผ่านการเรียนรู้ครบทุกวิชาในสายงาน {track} เมื่อวันที่ {date}',
        signerName: 'หัวหน้าสาขาวิชาวิทยาการคอมพิวเตอร์',
        signerTitle: 'คณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้',
        isDefault: true,
      },
    });

    for (const [trackIndex, t] of TRACKS.entries()) {
      const track = await prisma.track.create({
        data: {
          slug: t.slug,
          nameTh: t.nameTh,
          nameEn: t.nameEn,
          summary: t.summary,
          description: t.description,
          color: t.color,
          sortOrder: trackIndex,
          certificateTemplateId: template.id,
        },
      });
      for (const [courseIndex, code] of t.courses.entries()) {
        const c = COURSES[code];
        if (!c) throw new Error(`ไม่มีเนื้อหาของวิชา ${code} ใน seed-data.ts`);
        await prisma.course.create({
          data: {
            trackId: track.id,
            courseCode: c.courseCode,
            title: c.title,
            description: c.description,
            sortOrder: courseIndex,
            quizPassCount: 2,
            topics: {
              create: c.topics.map((title, topicIndex) => ({
                title,
                sortOrder: topicIndex,
                videos: {
                  create: [
                    {
                      title: `${title} (วิดีโอตัวอย่าง)`,
                      videoUrl: SAMPLE_VIDEO_URL,
                      durationSeconds: SAMPLE_VIDEO_SECONDS,
                      sortOrder: 0,
                    },
                  ],
                },
              })),
            },
            questions: {
              create: c.questions.map((q, questionIndex) => ({
                prompt: q.prompt,
                explanation: q.explanation,
                sortOrder: questionIndex,
                choices: {
                  create: q.choices.map((label, choiceIndex) => ({
                    label,
                    isCorrect: choiceIndex === q.answer,
                    sortOrder: choiceIndex,
                  })),
                },
              })),
            },
          },
        });
      }
      console.log(`สร้างสายงาน ${t.nameEn} (${t.courses.length} วิชา)`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
