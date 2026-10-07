import type { INestApplication } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';

import { PrismaClient } from '../src/generated/prisma/client';
import { applyEnv, jwksBody, makeKeys, sign, type TestKeys } from './helpers';

/**
 * เส้นทางการเรียนจริงทั้งเส้นบน PostgreSQL — รันเมื่อมี TEST_DATABASE_URL เท่านั้น
 * (CI ไม่มีฐานข้อมูล · ในเครื่อง: TEST_DATABASE_URL=postgresql://... pnpm --filter backend test)
 * ฐานต้อง migrate แล้ว · เทสต์สร้างข้อมูลของตัวเองและลบทิ้งตอนจบ
 */
const DB_URL = process.env.TEST_DATABASE_URL;
const describeDb = DB_URL ? describe : describe.skip;

jest.setTimeout(30_000);

describeDb('การเรียนตามสายงาน (PostgreSQL)', () => {
  let app: INestApplication;
  let keys: TestKeys;
  let db: PrismaClient;
  const original = global.fetch;
  const tag = `t${Date.now().toString(36)}`;
  const trackIds: string[] = [];

  const http = () => request(app.getHttpServer());
  const as = async (role: string, sub: string) =>
    `Bearer ${await sign(keys, { role, email: `${sub}@example.test` }, { sub })}`;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  beforeAll(async () => {
    applyEnv();
    process.env.DATABASE_URL = DB_URL;
    keys = await makeKeys();
    const jwks = await jwksBody(keys);
    // JWKS ปลอม + Core Hub ที่ไม่มีข้อมูลบุคคล (บัญชีทดสอบไม่ผูกบุคคล → /people/me = null)
    global.fetch = (async (input: unknown) => {
      const url = String(input);
      if (url.endsWith('/.well-known/jwks.json')) return new Response(JSON.stringify(jwks), { status: 200 });
      if (url.includes('/people/me')) return new Response(JSON.stringify({ success: true, data: null }), { status: 200 });
      return new Response('{}', { status: 404 });
    }) as typeof fetch;
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: DB_URL }) });
    const { createApp } = await import('../src/main');
    ({ app } = await createApp());
    await app.init();
  });

  afterAll(async () => {
    for (const trackId of trackIds) {
      await db.certificate.deleteMany({ where: { trackId } });
      await db.enrollment.deleteMany({ where: { trackId } });
      await db.track.delete({ where: { id: trackId } }).catch(() => undefined);
    }
    await db.$disconnect();
    await app.close();
    global.fetch = original;
  });

  async function buildTrack(staff: string, name: string, videoSeconds = 2) {
    const track = await http().post('/api/v1/tracks').set('Authorization', staff).send({ nameTh: name, nameEn: `${tag} ${name}`, color: 'PURPLE' }).expect(201);
    trackIds.push(track.body.data.id);
    const course = await http().post('/api/v1/courses').set('Authorization', staff).send({ trackId: track.body.data.id, title: `${name} วิชา 1`, quizPassCount: 1 }).expect(201);
    const topic = await http().post('/api/v1/topics').set('Authorization', staff).send({ courseId: course.body.data.id, title: 'หัวข้อ 1' }).expect(201);
    const v1 = await http().post('/api/v1/videos').set('Authorization', staff).send({ topicId: topic.body.data.id, title: 'วิดีโอ 1', videoUrl: 'https://example.test/a.mp4', durationSeconds: videoSeconds }).expect(201);
    const v2 = await http().post('/api/v1/videos').set('Authorization', staff).send({ topicId: topic.body.data.id, title: 'วิดีโอ 2', videoUrl: 'https://example.test/b.mp4', durationSeconds: videoSeconds }).expect(201);
    const q = await http()
      .post('/api/v1/quiz-questions')
      .set('Authorization', staff)
      .send({ courseId: course.body.data.id, prompt: '1 + 1 = ?', choices: [{ label: '1', isCorrect: false }, { label: '2', isCorrect: true }] })
      .expect(201);
    return { trackId: track.body.data.id, courseId: course.body.data.id, v1: v1.body.data.id, v2: v2.body.data.id, question: q.body.data };
  }

  async function watch(auth: string, videoId: string, seconds: number) {
    await http().post(`/api/v1/videos/${videoId}/heartbeats`).set('Authorization', auth).send({ positionSeconds: 0, playing: false }).expect(200);
    await sleep(seconds * 1000 + 150);
    return http().post(`/api/v1/videos/${videoId}/heartbeats`).set('Authorization', auth).send({ positionSeconds: seconds, playing: true }).expect(200);
  }

  it('สมัคร → เรียนตามลำดับ → สอบผ่าน → จบสายงาน + เกียรติบัตร → สมัครสายงานอื่นได้', async () => {
    const staff = await as('staff', `${tag}-staff`);
    const student = await as('student', `${tag}-s1`);
    const a = await buildTrack(staff, 'สายงาน A');
    const b = await buildTrack(staff, 'สายงาน B');

    const enroll = await http().post('/api/v1/enrollments').set('Authorization', student).send({ trackId: a.trackId }).expect(201);
    expect(enroll.body.data).toMatchObject({ status: 'ACTIVE', percent: 0 });

    // กำลังเรียนได้ทีละ 1 สายงาน
    const second = await http().post('/api/v1/enrollments').set('Authorization', student).send({ trackId: b.trackId }).expect(409);
    expect(second.body.error).toMatchObject({ code: 'CONFLICT', details: { reason: 'ACTIVE_ENROLLMENT_EXISTS' } });

    // เรียนข้ามไม่ได้
    const skip = await http().post(`/api/v1/videos/${a.v2}/heartbeats`).set('Authorization', student).send({ positionSeconds: 0, playing: false }).expect(409);
    expect(skip.body.error.details.reason).toBe('VIDEO_LOCKED');
    const earlyQuiz = await http().get(`/api/v1/courses/${a.courseId}/quiz`).set('Authorization', student).expect(409);
    expect(earlyQuiz.body.error.details.reason).toBe('QUIZ_LOCKED');

    // ยิง heartbeat ถี่ ๆ ไม่ได้เวลาเพิ่ม (server จับเวลาเอง)
    await http().post(`/api/v1/videos/${a.v1}/heartbeats`).set('Authorization', student).send({ positionSeconds: 0, playing: false }).expect(200);
    const spam = await http().post(`/api/v1/videos/${a.v1}/heartbeats`).set('Authorization', student).send({ positionSeconds: 2, playing: true }).expect(200);
    expect(spam.body.data).toMatchObject({ isCompleted: false, watchedSeconds: 0 });

    const w1 = await watch(student, a.v1, 2);
    expect(w1.body.data).toMatchObject({ isCompleted: true, justCompleted: true });
    await watch(student, a.v2, 2);

    const outline = await http().get(`/api/v1/courses/${a.courseId}/outline`).set('Authorization', student).expect(200);
    expect(outline.body.data.quiz.state).toBe('AVAILABLE');
    expect(outline.body.data.topics[0].videos.every((v: { state: string }) => v.state === 'COMPLETED')).toBe(true);

    const quiz = await http().get(`/api/v1/courses/${a.courseId}/quiz`).set('Authorization', student).expect(200);
    expect(JSON.stringify(quiz.body.data)).not.toContain('isCorrect');

    const wrongChoice = a.question.choices.find((c: { isCorrect: boolean }) => !c.isCorrect).id;
    const rightChoice = a.question.choices.find((c: { isCorrect: boolean }) => c.isCorrect).id;
    const fail = await http().post('/api/v1/quiz-attempts').set('Authorization', student).send({ courseId: a.courseId, answers: [{ questionId: a.question.id, choiceId: wrongChoice }] }).expect(201);
    expect(fail.body.data).toMatchObject({ isPassed: false, trackCompleted: false });

    const pass = await http().post('/api/v1/quiz-attempts').set('Authorization', student).send({ courseId: a.courseId, answers: [{ questionId: a.question.id, choiceId: rightChoice }] }).expect(201);
    expect(pass.body.data).toMatchObject({ isPassed: true, trackCompleted: true });
    const certificateId = pass.body.data.certificateId;
    expect(certificateId).toBeTruthy();

    const cert = await http().get(`/api/v1/certificates/${certificateId}`).set('Authorization', student).expect(200);
    expect(cert.body.data).toMatchObject({ isMine: true, recipientName: `${tag}-s1` });
    expect(cert.body.data.certificateNo).toMatch(/^CSMJU-EL-25\d\d-[0-9A-F]{8}$/);

    // คนอื่นดูเกียรติบัตรนี้ไม่ได้ · ผู้ดูแลดูได้
    await http().get(`/api/v1/certificates/${certificateId}`).set('Authorization', await as('student', `${tag}-other`)).expect(403);
    await http().get(`/api/v1/certificates/${certificateId}`).set('Authorization', staff).expect(200);

    // จบแล้ว: ออกไม่ได้ · สมัครซ้ำไม่ได้ · สมัครสายงานอื่นได้
    const done = await http().post(`/api/v1/enrollments/${enroll.body.data.id}/withdraw`).set('Authorization', student).expect(409);
    expect(done.body.error.details.reason).toBe('ENROLLMENT_COMPLETED');
    const again = await http().post('/api/v1/enrollments').set('Authorization', student).send({ trackId: a.trackId }).expect(409);
    expect(again.body.error.details.reason).toBe('TRACK_ALREADY_COMPLETED');
    await http().post('/api/v1/enrollments').set('Authorization', student).send({ trackId: b.trackId }).expect(201);

    const profile = await http().get('/api/v1/learner-profile').set('Authorization', student).expect(200);
    expect(profile.body.data.completedTracks).toHaveLength(1);
    expect(profile.body.data.activeEnrollment.track.id).toBe(b.trackId);

    const detail = await http().get(`/api/v1/tracks/${a.trackId}`).set('Authorization', student).expect(200);
    expect(detail.body.data.graduates).toEqual([expect.objectContaining({ isMe: true })]);
    expect(detail.body.data.graduateCount).toBe(1);

    // ลบสายงานที่มีผู้เรียนไม่ได้
    const del = await http().delete(`/api/v1/tracks/${a.trackId}`).set('Authorization', staff).expect(409);
    expect(del.body.error.details.reason).toBe('TRACK_HAS_LEARNERS');
  });

  it('ออกจากสายงาน → ความคืบหน้ากลับเป็น 0 · สถิติยังนับ · สมัครใหม่เริ่มจากศูนย์', async () => {
    const staff = await as('staff', `${tag}-staff`);
    const student = await as('student', `${tag}-s2`);
    const c = await buildTrack(staff, 'สายงาน C', 1);

    const e = await http().post('/api/v1/enrollments').set('Authorization', student).send({ trackId: c.trackId }).expect(201);
    await watch(student, c.v1, 1);
    expect(await db.videoProgress.count({ where: { enrollmentId: e.body.data.id } })).toBe(1);

    // คนอื่นกดออกแทนไม่ได้
    await http().post(`/api/v1/enrollments/${e.body.data.id}/withdraw`).set('Authorization', await as('student', `${tag}-x`)).expect(403);

    const out = await http().post(`/api/v1/enrollments/${e.body.data.id}/withdraw`).set('Authorization', student).expect(200);
    expect(out.body.data).toMatchObject({ status: 'WITHDRAWN', percent: 0 });
    expect(await db.videoProgress.count({ where: { enrollmentId: e.body.data.id } })).toBe(0);

    const profile = await http().get('/api/v1/learner-profile').set('Authorization', student).expect(200);
    expect(profile.body.data.activeEnrollment).toBeNull();

    const back = await http().post('/api/v1/enrollments').set('Authorization', student).send({ trackId: c.trackId }).expect(201);
    const outline = await http().get(`/api/v1/courses/${c.courseId}/outline`).set('Authorization', student).expect(200);
    expect(outline.body.data.topics[0].videos[0]).toMatchObject({ state: 'AVAILABLE', watchedSeconds: 0 });
    expect(back.body.data.percent).toBe(0);

    const stats = await http().get('/api/v1/track-statistics?limit=100').set('Authorization', staff).expect(200);
    const row = stats.body.data.find((s: { trackId: string }) => s.trackId === c.trackId);
    expect(row).toMatchObject({ enrollmentCount: 2, activeCount: 1, withdrawnCount: 1, withdrawRate: 50 });
    await http().get('/api/v1/track-statistics').set('Authorization', student).expect(403);
  });

  it('อาจารย์แก้ได้เฉพาะวิชาที่ได้รับมอบหมาย', async () => {
    const staff = await as('staff', `${tag}-staff`);
    const lecturerSub = `${tag}-lect`;
    const lecturer = await as('lecturer', lecturerSub);
    const d = await buildTrack(staff, 'สายงาน D');

    await http().patch(`/api/v1/courses/${d.courseId}`).set('Authorization', lecturer).send({ title: 'แก้ชื่อ' }).expect(403);
    await db.instructorAssignment.create({
      data: { personCode: 'lect01', coreUserId: lecturerSub, courseId: d.courseId, assignedByCoreUserId: `${tag}-admin` },
    });
    const ok = await http().patch(`/api/v1/courses/${d.courseId}`).set('Authorization', lecturer).send({ title: 'แก้ชื่อ' }).expect(200);
    expect(ok.body.data.title).toBe('แก้ชื่อ');
    // วิชาเดียว ≠ ทั้งสายงาน: เพิ่มวิชาใหม่ในสายงานไม่ได้
    await http().post('/api/v1/courses').set('Authorization', lecturer).send({ trackId: d.trackId, title: 'วิชาใหม่' }).expect(403);
    const mine = await http().get('/api/v1/instructor-assignments').set('Authorization', lecturer).expect(200);
    expect(mine.body.data).toHaveLength(1);
  });

  it('ส่ง body ผิด → 400 VALIDATION_ERROR (probe ของ conformance)', async () => {
    const staff = await as('staff', `${tag}-staff`);
    const res = await http().post('/api/v1/tracks').set('Authorization', staff).send({ nameTh: '' }).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const list = await http().get('/api/v1/tracks').set('Authorization', staff).expect(200);
    expect(list.body.meta).toMatchObject({ page: 1, limit: 20 });
    await http().get('/api/v1/tracks/99999999-9999-4999-8999-999999999999').set('Authorization', staff).expect(404);
  });
});
