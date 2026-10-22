import { PageContainer, StatusNotice } from "@/components/ui";

export default function HypothesisScoreLoading() {
  return <PageContainer><div className="py-32 sm:py-48"><StatusNotice role="status" tone="info">Menyiapkan detail peluang...</StatusNotice></div></PageContainer>;
}
