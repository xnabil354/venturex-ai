import { PageContainer } from "@/components/ui";
import { NotificationCenter } from "@/components/notifications/notification-center";
export default function NotificationsPage() {
  return (
    <PageContainer>
      <div className="grid gap-24 py-32 sm:gap-32 sm:py-48">
        <header className="max-w-[60ch]">
          <p className="mb-8 text-caption font-w540 uppercase tracking-widest text-royal-violet">
            Tetap terhubung
          </p>
          <h1 className="text-heading-lg text-ink-charcoal">Notifikasi</h1>
          <p className="mt-12 text-body text-stone-gray">
            Ringkasan tren pilihan Anda, setiap hari.
          </p>
        </header>
        <NotificationCenter />
      </div>
    </PageContainer>
  );
}
