import Image from "next/image";
import { PageContainer } from "@/components/ui";
import { NotificationCenter } from "@/components/notifications/notification-center";
export default function NotificationsPage() {
  return (
    <div className="relative isolate min-h-[calc(100dvh-4rem)] overflow-hidden">
      <Image
        src="/images/hero-editorial.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="pointer-events-none -z-20 object-cover object-center opacity-30"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-warm-parchment/75"
      />
      <PageContainer>
        <div className="grid gap-24 py-32 sm:gap-32 sm:py-48">
          <header className="max-w-[60ch]">
            <p className="mb-8 text-caption font-w540 uppercase tracking-widest text-royal-violet">
              Tetap terhubung
            </p>
            <h1 className="text-heading-lg text-ink-charcoal">Notifikasi</h1>
            <p className="mt-12 text-body text-stone-gray">
              Ringkasan search trends Food &amp; Drink.
            </p>
          </header>
          <NotificationCenter />
        </div>
      </PageContainer>
    </div>
  );
}
