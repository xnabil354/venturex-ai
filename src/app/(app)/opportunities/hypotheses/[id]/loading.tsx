import { PageContainer, StatusNotice } from "@/components/ui";

export default function HypothesisScoreLoading() {
  return <PageContainer><div className="py-24 sm:py-32 lg:py-40"><StatusNotice role="status" tone="info">Menyiapkan detail peluang...</StatusNotice></div></PageContainer>;
}
