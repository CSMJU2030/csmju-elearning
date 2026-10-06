import { computeTrackProgress, heartbeatCredit, requiredSeconds, type CourseNode } from '../src/learning-rules/progress';
import { permissionsOf } from '../src/auth/permissions';
import { certificateNumber } from '../src/learning/learning.service';

const course = (id: string, videos: string[], questionCount = 1): CourseNode => ({
  id,
  questionCount,
  topics: [{ id: `${id}-t1`, videos: videos.map((v) => ({ id: v, durationSeconds: 60 })) }],
});

const facts = (videos: string[] = [], quizzes: string[] = []) => ({
  completedVideos: new Set(videos),
  passedQuizzes: new Set(quizzes),
});

describe('เรียนตามลำดับ (computeTrackProgress)', () => {
  const tree = [course('c1', ['v1', 'v2']), course('c2', ['v3'])];

  it('เริ่มต้น: เปิดได้แค่วิดีโอแรกของวิชาแรก', () => {
    const p = computeTrackProgress(tree, facts());
    expect(p.courses[0].state).toBe('AVAILABLE');
    expect(p.courses[0].videoStates.get('v1')).toBe('AVAILABLE');
    expect(p.courses[0].videoStates.get('v2')).toBe('LOCKED');
    expect(p.courses[0].quizState).toBe('LOCKED');
    expect(p.courses[1].state).toBe('LOCKED');
    expect(p.percent).toBe(0);
    expect(p.currentCourseId).toBe('c1');
  });

  it('เรียนข้ามไม่ได้: ดูวิดีโอที่ 2 จบก่อนวิดีโอที่ 1 ก็ยังไม่ปลดล็อกแบบทดสอบ', () => {
    const p = computeTrackProgress(tree, facts(['v2']));
    expect(p.courses[0].videoStates.get('v1')).toBe('AVAILABLE');
    expect(p.courses[0].quizState).toBe('LOCKED');
  });

  it('ดูวิดีโอครบ → เปิดแบบทดสอบ · วิชาถัดไปยังล็อกจนกว่าจะสอบผ่าน', () => {
    const p = computeTrackProgress(tree, facts(['v1', 'v2']));
    expect(p.courses[0].quizState).toBe('AVAILABLE');
    expect(p.courses[1].state).toBe('LOCKED');
    expect(p.courses[1].videoStates.get('v3')).toBe('LOCKED');
  });

  it('ผลสอบผ่านของวิชาที่ยังล็อกอยู่ไม่นับ (กันการยิง API ข้ามลำดับ)', () => {
    const p = computeTrackProgress(tree, facts(['v3'], ['c2']));
    expect(p.courses[1].isPassed).toBe(false);
    expect(p.unitsCompleted).toBe(0);
  });

  it('ผ่านทุกวิชา → จบสายงาน 100%', () => {
    const p = computeTrackProgress(tree, facts(['v1', 'v2', 'v3'], ['c1', 'c2']));
    expect(p.isCompleted).toBe(true);
    expect(p.percent).toBe(100);
    expect(p.currentCourseId).toBeNull();
  });

  it('วิชาที่ไม่มีแบบทดสอบ ผ่านเมื่อดูวิดีโอครบ · สายงานที่ไม่มีวิชาไม่ถือว่าจบ', () => {
    const p = computeTrackProgress([course('c1', ['v1'], 0)], facts(['v1']));
    expect(p.courses[0].quizState).toBe('NONE');
    expect(p.isCompleted).toBe(true);
    expect(computeTrackProgress([], facts()).isCompleted).toBe(false);
  });
});

describe('ตัวตรวจเวลาเรียน (heartbeatCredit)', () => {
  const t0 = new Date('2026-10-05T03:00:00.000Z');
  const at = (sec: number) => new Date(t0.getTime() + sec * 1000);

  it('ได้เวลาเท่าที่ผ่านไปจริง ไม่เกินเพดานต่อครั้ง', () => {
    expect(heartbeatCredit(t0, at(10), true, 15, 45)).toBe(10);
    expect(heartbeatCredit(t0, at(30), true, 15, 45)).toBe(15);
  });

  it('heartbeat แรก · หยุดเล่น · ห่างเกิน gap · เวลาย้อน = 0', () => {
    expect(heartbeatCredit(null, at(10), true, 15, 45)).toBe(0);
    expect(heartbeatCredit(t0, at(10), false, 15, 45)).toBe(0);
    expect(heartbeatCredit(t0, at(60), true, 15, 45)).toBe(0);
    expect(heartbeatCredit(at(10), t0, true, 15, 45)).toBe(0);
  });

  it('เวลาขั้นต่ำ = เปอร์เซ็นต์ของความยาว ปัดขึ้น', () => {
    expect(requiredSeconds(100, 90)).toBe(90);
    expect(requiredSeconds(5, 90)).toBe(5);
    expect(requiredSeconds(1, 1)).toBe(1);
  });
});

describe('สิทธิ์ (permissions.ts)', () => {
  it('ผู้เยี่ยมชมดูได้อย่างเดียว · ผู้เรียนจัดการเนื้อหาไม่ได้ · มอบหมายอาจารย์ได้เฉพาะ ADMIN', () => {
    expect(permissionsOf('VISITOR')).not.toContain('enrollment:create:own');
    expect(permissionsOf('LEARNER')).toContain('enrollment:create:own');
    expect(permissionsOf('LEARNER')).not.toContain('content:manage:any');
    expect(permissionsOf('INSTRUCTOR')).toContain('content:manage:own');
    expect(permissionsOf('INSTRUCTOR')).not.toContain('content:manage:any');
    expect(permissionsOf('STAFF')).not.toContain('assignment:manage');
    expect(permissionsOf('ADMIN')).toContain('assignment:manage');
  });
});

it('เลขที่เกียรติบัตรใช้ปี พ.ศ. ตามเวลาไทย', () => {
  const no = certificateNumber('0f3a9c2e-1111-4111-8111-111111111111', new Date('2026-12-31T18:00:00.000Z'));
  expect(no).toBe('CSMJU-EL-2570-0F3A9C2E');
});
