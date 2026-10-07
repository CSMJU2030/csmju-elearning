import CourseEditorView from "./CourseEditorView";

export const metadata = { title: "จัดการเนื้อหาวิชา" };

export default async function CourseEditorPage({ params }: PageProps<"/manage/courses/[id]">) {
  const { id } = await params;
  return <CourseEditorView courseId={id} />;
}
