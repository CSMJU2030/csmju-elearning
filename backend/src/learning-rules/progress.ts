/**
 * กติกาการเรียนตามลำดับ — ฟังก์ชันล้วน (ไม่แตะฐานข้อมูล) จึงทดสอบได้ตรง ๆ
 *
 *   สายงาน → วิชา (เรียงตาม sort_order) → หัวข้อ → วิดีโอ → แบบทดสอบท้ายวิชา
 *
 * - เรียนข้ามไม่ได้: วิดีโอเปิดได้เมื่อวิดีโอก่อนหน้า (ข้ามหัวข้อด้วย) จบแล้ว
 * - วิชาถัดไปเปิดได้เมื่อวิชาก่อนหน้า "ผ่าน" แล้ว
 * - วิชาผ่าน = ดูวิดีโอครบ และ (ไม่มีแบบทดสอบ หรือ ทำแบบทดสอบผ่าน)
 * - แบบทดสอบเปิดได้เมื่อดูวิดีโอในวิชานั้นครบ
 * - สายงานจบ = มีอย่างน้อย 1 วิชา และผ่านทุกวิชา
 */

export interface VideoNode {
  id: string;
  durationSeconds: number;
}

export interface TopicNode {
  id: string;
  videos: VideoNode[];
}

export interface CourseNode {
  id: string;
  questionCount: number;
  topics: TopicNode[];
}

export interface LearnerFacts {
  /** videoId ที่ดูจบแล้ว */
  completedVideos: ReadonlySet<string>;
  /** courseId ที่ทำแบบทดสอบผ่านแล้ว */
  passedQuizzes: ReadonlySet<string>;
}

export type ItemState = 'LOCKED' | 'AVAILABLE' | 'COMPLETED';

export interface CourseProgress {
  courseId: string;
  state: ItemState;
  isPassed: boolean;
  videosTotal: number;
  videosCompleted: number;
  quizState: ItemState | 'NONE';
  videoStates: Map<string, ItemState>;
}

export interface TrackProgress {
  courses: CourseProgress[];
  /** หน่วยงานทั้งหมด = วิดีโอ + แบบทดสอบ · ใช้คิดเปอร์เซ็นต์ */
  unitsTotal: number;
  unitsCompleted: number;
  percent: number;
  isCompleted: boolean;
  /** วิชาที่ควรเรียนต่อ (วิชาแรกที่ยังไม่ผ่าน) */
  currentCourseId: string | null;
}

export function computeTrackProgress(courses: CourseNode[], facts: LearnerFacts): TrackProgress {
  const result: CourseProgress[] = [];
  let previousPassed: boolean = true;
  let unitsTotal = 0;
  let unitsCompleted = 0;

  for (const course of courses) {
    const unlocked: boolean = previousPassed;
    const videos = course.topics.flatMap((t) => t.videos);
    const videoStates = new Map<string, ItemState>();
    let previousVideoDone = unlocked;
    let videosCompleted = 0;

    for (const video of videos) {
      const done = facts.completedVideos.has(video.id);
      if (done && unlocked) {
        videoStates.set(video.id, 'COMPLETED');
        videosCompleted += 1;
      } else {
        videoStates.set(video.id, previousVideoDone ? 'AVAILABLE' : 'LOCKED');
      }
      // วิดีโอที่ดูจบไปแล้วแต่อยู่หลังวิดีโอที่ยังไม่จบ (ผู้ดูแลแทรกวิดีโอใหม่) ไม่ปลดล็อกตัวถัดไป
      previousVideoDone = previousVideoDone && done;
    }

    const allVideosDone: boolean = unlocked && videosCompleted === videos.length;
    const hasQuiz = course.questionCount > 0;
    const quizPassed = hasQuiz && facts.passedQuizzes.has(course.id) && allVideosDone;
    const isPassed: boolean = allVideosDone && (!hasQuiz || quizPassed);

    const quizState: CourseProgress['quizState'] = !hasQuiz
      ? 'NONE'
      : quizPassed
        ? 'COMPLETED'
        : allVideosDone
          ? 'AVAILABLE'
          : 'LOCKED';

    unitsTotal += videos.length + (hasQuiz ? 1 : 0);
    unitsCompleted += videosCompleted + (quizPassed ? 1 : 0);

    result.push({
      courseId: course.id,
      state: !unlocked ? 'LOCKED' : isPassed ? 'COMPLETED' : 'AVAILABLE',
      isPassed,
      videosTotal: videos.length,
      videosCompleted,
      quizState,
      videoStates,
    });
    previousPassed = previousPassed && isPassed;
  }

  const isCompleted = courses.length > 0 && result.every((c) => c.isPassed);
  return {
    courses: result,
    unitsTotal,
    unitsCompleted,
    percent: isCompleted ? 100 : unitsTotal === 0 ? 0 : Math.floor((unitsCompleted / unitsTotal) * 100),
    isCompleted,
    currentCourseId: result.find((c) => !c.isPassed)?.courseId ?? null,
  };
}

/** เวลาเรียนขั้นต่ำของวิดีโอ (วินาที) */
export function requiredSeconds(durationSeconds: number, minWatchPercent: number): number {
  return Math.max(1, Math.ceil((durationSeconds * minWatchPercent) / 100));
}

/**
 * เวลาที่ heartbeat ครั้งนี้นับให้ — server จับเวลาเอง ไม่เชื่อตัวเลขจากเบราว์เซอร์
 *
 * - heartbeat แรก หรือห่างจากครั้งก่อนเกิน gap = เริ่มรอบใหม่ (0 วินาที)
 * - ไม่ได้เล่นอยู่ (playing = false) = 0 วินาที
 * - นับได้ไม่เกิน maxCredit ต่อครั้ง และไม่เกินเวลาจริงที่ผ่านไป
 *   → เปิดหลายแท็บ/ยิงถี่ ๆ ก็ได้เวลาไม่เกินเวลาจริง เพราะทุกครั้งนับจาก last_heartbeat_at เดียวกัน
 */
export function heartbeatCredit(
  lastHeartbeatAt: Date | null,
  now: Date,
  playing: boolean,
  maxCreditSec: number,
  gapSec: number,
): number {
  if (!lastHeartbeatAt || !playing) return 0;
  const elapsed = (now.getTime() - lastHeartbeatAt.getTime()) / 1000;
  if (elapsed <= 0 || elapsed > gapSec) return 0;
  return Math.floor(Math.min(elapsed, maxCreditSec));
}
