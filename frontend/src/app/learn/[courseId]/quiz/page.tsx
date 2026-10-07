import QuizView from "./QuizView";

export const metadata = { title: "แบบทดสอบท้ายวิชา" };

export default async function QuizPage({ params }: PageProps<"/learn/[courseId]/quiz">) {
  const { courseId } = await params;
  return <QuizView courseId={courseId} />;
}
