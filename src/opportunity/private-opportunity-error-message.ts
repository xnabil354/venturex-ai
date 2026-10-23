import type { PrivateOpportunityErrorCode } from "./private-hypothesis-service";

type SafeProviderDiagnostic = Readonly<{
  category?: string;
  failure?: string;
  rejectedRule?: string;
  outboundAttempted?: boolean;
  responseHeadersReceivedAfterMs?: number | null;
}>;

type PrivateOpportunityErrorMessageInput = Readonly<{
  code: PrivateOpportunityErrorCode;
  providerDiagnostic: SafeProviderDiagnostic | null;
}>;

export function messageForPrivateOpportunityError(error: PrivateOpportunityErrorMessageInput): string {
  const diagnostic = error.providerDiagnostic;
  if (error.code === "AI_RESPONSE_INVALID" && diagnostic?.failure === "SCHEMA_VALIDATION_FAILED") {
    return "Hasil analisis tidak valid. Coba lagi.";
  }
  if (error.code === "AI_RESPONSE_INVALID" && diagnostic?.failure === "INVALID_JSON") {
    return "Hasil analisis tidak valid. Coba lagi.";
  }
  if (error.code === "AI_RESPONSE_INVALID" && diagnostic?.failure === "EMPTY_TEXT") {
    return "Hasil analisis kosong. Coba lagi.";
  }
  if (error.code === "AI_RESPONSE_INVALID" && diagnostic?.category === "CONTENT_POLICY_REJECTED") {
    return "Hasil analisis belum cukup didukung data. Coba lagi.";
  }
  if (error.code === "AI_UPSTREAM_UNAVAILABLE" && diagnostic?.category === "TIMEOUT") {
    return "Analisis belum selesai. Coba lagi.";
  }
  if (error.code === "AI_UPSTREAM_UNAVAILABLE" && diagnostic?.category === "UPSTREAM_TIMEOUT") {
    return "Analisis belum selesai. Coba lagi.";
  }
  if (error.code === "AI_UPSTREAM_UNAVAILABLE" && diagnostic?.category === "CLIENT_ABORTED") {
    return "Analisis dibatalkan.";
  }
  switch (error.code) {
    case "UNAUTHENTICATED": return "Silakan masuk untuk melanjutkan.";
    case "FORBIDDEN": return "Lengkapi profil Anda terlebih dahulu.";
    case "PROFILE_INCOMPLETE": return "Periksa kembali profil usaha Anda.";
    case "PROFILE_CONTEXT_TOO_LARGE": return "Ringkas catatan profil, lalu coba lagi.";
    case "INVALID_REQUEST": return "Permintaan analisis tidak valid.";
    case "CONSENT_REQUIRED": return "Setujui pemrosesan profil untuk melanjutkan.";
    case "AI_FEATURE_DISABLED": return "Analisis AI belum tersedia.";
    case "SOURCE_PROCESSING_NOT_APPROVED": return "Sinyal belum dapat digunakan.";
    case "SOURCE_TOKEN_CONFIGURATION_UNAVAILABLE": return "Sesi sumber tidak dapat diverifikasi. Muat ulang sinyal.";
    case "INSECURE_PROVIDER_TRANSPORT": return "Koneksi tidak aman. Analisis diblokir.";
    case "AI_PROVIDER_CONFIGURATION_UNAVAILABLE": return "Analisis belum siap digunakan.";
    case "SOURCE_SIGNAL_UNAVAILABLE": return "Sinyal Google Trends tidak tersedia. Muat ulang sinyal.";
    case "AI_RATE_LIMITED": return "Tunggu sebelum meminta hipotesis lagi.";
    case "AI_RESPONSE_INVALID": return "Hasil analisis tidak valid. Coba lagi.";
    case "AI_UPSTREAM_AUTH_FAILED": return "Analisis belum tersedia. Coba lagi nanti.";
    case "PERSISTENCE_UNAVAILABLE": return "Hasil analisis belum dapat disimpan.";
    case "AI_UPSTREAM_UNAVAILABLE": return "Analisis belum selesai. Coba lagi.";
  }
}
