export type PushEnvironment = { secure: boolean; serviceWorker: boolean; pushManager: boolean; notification: boolean; ios: boolean; standalone: boolean };
export function pushCapability(environment: PushEnvironment): { supported: boolean; hint: string } {
  if (!environment.secure) return { supported: false, hint: "Buka website melalui koneksi HTTPS untuk mengaktifkan notifikasi perangkat." };
  if (environment.ios && !environment.standalone) return { supported: false, hint: "Di iPhone/iPad, buka menu Bagikan → Tambahkan ke Layar Utama. Buka dari ikon tersebut untuk mengaktifkan notifikasi." };
  if (!environment.serviceWorker || !environment.pushManager || !environment.notification) return { supported: false, hint: "Notifikasi perangkat belum didukung browser ini. Ringkasan tetap tersedia di arsip notifikasi." };
  return { supported: true, hint: "Memerlukan izin browser Anda." };
}
