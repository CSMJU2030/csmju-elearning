import TrackCoursesView from "./TrackCoursesView";

export const metadata = { title: "วิชาในสายงาน" };

export default async function TrackCoursesPage({ params }: PageProps<"/manage/tracks/[id]">) {
  const { id } = await params;
  return <TrackCoursesView trackId={id} />;
}
