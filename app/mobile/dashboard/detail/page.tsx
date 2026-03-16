import { Suspense } from "react";
import SummaryDetailPage from "@/component/mobile/dashboard/SummaryDetailPage";

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f3f6fb]" />}>
      <SummaryDetailPage />
    </Suspense>
  );
}
