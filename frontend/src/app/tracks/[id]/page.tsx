import TrackDetailView from "./TrackDetailView";

export const metadata = { title: "รายละเอียดสายงาน" };

export default async function TrackDetailPage({ params }: PageProps<"/tracks/[id]">) {
  const { id } = await params;
  return <TrackDetailView id={id} />;
}
