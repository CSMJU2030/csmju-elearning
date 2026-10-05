import ClassroomView from "./ClassroomView";

export const metadata = { title: "ห้องเรียน" };

export default async function ClassroomPage({ params }: PageProps<"/learn/[courseId]">) {
  const { courseId } = await params;
  return <ClassroomView courseId={courseId} />;
}
