import { Card, PageContainer } from "@/components/ui";

export default function RoadmapDetailLoading() {
  return (
    <PageContainer>
      <div aria-busy="true" className="grid gap-12 py-32 sm:py-48 lg:py-64">
        <div className="h-8 w-40 animate-pulse bg-soft-mist" />
        <Card className="h-44 animate-pulse bg-paper-white" />
        <Card className="h-72 animate-pulse bg-paper-white" />
      </div>
    </PageContainer>
  );
}
