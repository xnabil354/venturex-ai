import { LoadingSkeleton, PageContainer } from "@/components/ui";

export default function SavedLoading() {
  return (
    <PageContainer>
      <div aria-busy="true" className="grid gap-16 py-32 sm:py-48 lg:py-64">
        <p className="text-body-sm text-stone-gray" role="status">Memuat peluang tersimpan…</p>
        <LoadingSkeleton className="h-32 w-2/3" />
        <LoadingSkeleton className="h-120 w-full" />
        <LoadingSkeleton className="h-120 w-full" />
      </div>
    </PageContainer>
  );
}
