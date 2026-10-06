import { Suspense } from "react";

import { PageSkeleton } from "@/components/states";
import CertificatePageView from "./CertificatePageView";

export const metadata = { title: "เกียรติบัตร" };

export default async function CertificatePage({ params }: PageProps<"/certificates/[id]">) {
  const { id } = await params;
  return (
    <Suspense fallback={<PageSkeleton rows={1} />}>
      <CertificatePageView id={id} />
    </Suspense>
  );
}
