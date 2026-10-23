import type { PrivateOpportunityIdeaDto } from "@/opportunity/private-hypothesis";
import { conciseRoadmapText } from "./private-startup-text";
import { ROADMAP_STAGES } from "./domain";
import { privateStartupRoadmapSchema } from "./private-startup-contract";

export function generatePrivateStartupRoadmap(item: PrivateOpportunityIdeaDto, now = new Date()) {
  const analysis = item.hypothesis.analysis;
  if (!item.saved || !analysis?.requirements || analysis.opportunity.score === null || analysis.fit.score === null) throw new Error("ANALYSIS_REQUIRED");
  const title = item.hypothesis.title;
  const target = conciseRoadmapText(analysis.targetConsumer, 70, "pada analisis tersimpan");
  const capital = analysis.capitalMin === null ? "Tentukan batas biaya uji sendiri sebelum mengeluarkan dana." : `Gunakan estimasi modal terkonfirmasi Rp ${new Intl.NumberFormat("id-ID").format(analysis.capitalMin)} sebagai batas rencana yang perlu diperiksa, bukan harga pasar terverifikasi.`;
  const competitorAction = analysis.competitors?.places.length
    ? `Tinjau contoh listing pada bukti analisis ${title}. Amati penawaran, kanal dan harga yang benar-benar tercantum; perluas observasi lokal bila sampelnya terbatas.`
    : `Cari penawaran sejenis ${title} yang dapat dijangkau calon pelanggan. Catat sumber, tanggal, kanal dan harga yang benar-benar tercantum; jangan menganggap sampel sebagai seluruh pasar.`;
  const factors = [...analysis.opportunity.factors, ...analysis.fit.factors];
  const value = (key: string) => factors.find(factor => factor.key === key)?.value;
  const constrained = (key: string) => value(key) != null && value(key)! < 70;
  // Weighted deficit measures contribution to the stored score, not failure probability.
  const priority = factors.filter(factor => factor.value !== null && factor.value < 70)
    .sort((a, b) => (100 - b.value!) * b.weight - (100 - a.value!) * a.weight || a.key.localeCompare(b.key))
    .slice(0, 2).map(factor => conciseRoadmapText(factor.label, 60, "faktor pada analisis")).join(" dan ");
  const channels = analysis.referenceLabels?.channels.length ? conciseRoadmapText(analysis.referenceLabels.channels.join(", "), 70, "lihat rincian analisis") : undefined;
  const unknown = (key: string) => value(key) == null;
  const trend = analysis.trend;
  const weakTrend = trend && (trend.count < 40 || trend.observedMonths < 10 || trend.spanDays < 270 || unknown("trendMomentum") || unknown("marketSustainability"));
  const adjustments = [
    !trend ? " Lengkapi histori pencarian; jangan simpulkan arah atau kestabilan minat dari sinyal tunggal."
      : weakTrend ? " Histori belum cukup untuk menilai arah dan kestabilan; lengkapi periode serta pengamatan valid, lalu cocokkan dengan wawancara pelanggan." : "",
    !analysis.competitors?.sampleCount ? " Sampel lokal belum memadai; verifikasi alamat dan alternatif pelanggan sebelum menilai persaingan." : "",
    `${unknown("experienceFit") || !analysis.requirements.requiredExperience ? " Konfirmasi kebutuhan pengalaman dan kemampuan proses inti sebelum membuat prototipe." : constrained("experienceFit") ? " Latih proses inti atau minta pendamping meninjau prototipe sebelum menerima pesanan." : ""}${constrained("budgetFit") ? " Kurangi lingkup prototipe agar sesuai dana; periksa biaya aktual sebelum membeli." : ""}${constrained("executionFeasibility") ? " Uji satu proses inti dahulu sebelum menambah variasi." : ""}`,
    `${channels ? ` Kanal usulan: ${channels}.` : " Konfirmasi kanal uji sebelum menawarkan."}${unknown("channelFit") || !analysis.requirements.salesChannelIds.length ? " Kecocokan kanal belum diketahui; periksa akses dan preferensi sebelum memilih kanal." : constrained("channelFit") ? " Kanal usulan belum cocok dengan preferensi; validasi akses atau pilih alternatif yang dapat dijalankan." : ""}${unknown("timeFit") || !analysis.requirements.requiredTime ? " Konfirmasi kebutuhan waktu dan jam tersedia sebelum menjadwalkan uji." : constrained("timeFit") ? " Batasi jadwal dan pesanan sesuai waktu yang tersedia; ukur waktu pengerjaan aktual." : ""}`,
    priority ? ` Dahulukan evaluasi ${priority}; catat bukti perubahan sebelum memperbesar skala.` : "",
    factors.some(factor => factor.value === null) ? " Faktor yang belum diketahui harus tetap dicatat sebagai belum terbukti dalam keputusan." : "",
  ];
  const capacity = analysis.planningContext?.timeCommitment;
  const pace = capacity === "LIMITED" ? "Waktu terbatas: satu tugas kecil per sesi, sesuai jam tersedia."
    : capacity === "PART_TIME" ? "Paruh waktu: jadwalkan sesi di luar komitmen utama."
    : capacity === "FULL_TIME" ? "Penuh waktu: kerjakan bertahap, evaluasi tiap sesi."
    : "Konfirmasi jam tersedia sebelum menetapkan jadwal.";
  const actions = [
    [`Bahas kebutuhan dan keberatan calon pelanggan ${target} terhadap konsep ${title}. Catat pendapat yang mendukung maupun menolak.`, "Memeriksa asumsi target dan masalah pelanggan.", "Sebelum membuat prototipe", "Catatan percakapan dan asumsi yang perlu diperbaiki."],
    [competitorAction, "Memahami alternatif yang sudah dapat dipilih pelanggan.", "Setelah kebutuhan awal ditinjau", "Daftar pembanding beserta sumber, tanggal dan keterbatasan sampel."],
    [`Siapkan prototipe kecil ${title}. Gunakan rincian kebutuhan awal di bawah. ${capital}`, "Menguji bentuk penawaran dengan komitmen biaya terbatas.", "Setelah meninjau alternatif", "Prototipe dan catatan biaya aktual serta kebutuhan operasional."],
    [`Tawarkan prototipe kepada ${target}. Catat respons dan pemenuhan pesanan aktual.`, "Mengamati respons dan kendala pelaksanaan nyata.", "Setelah prototipe dan aturan setempat diperiksa", "Catatan penawaran, respons, transaksi aktual bila ada, dan kendala."],
    [`Bandingkan hasil uji ${title} dengan asumsi, risiko dan estimasi modal pada analisis tersimpan. Bedakan fakta hasil uji dari skor awal dan perkiraan AI.`, "Menilai kelayakan langkah berikutnya berdasarkan bukti aktual.", "Setelah uji penawaran selesai", "Evaluasi respons, biaya, kapasitas waktu dan asumsi yang belum terbukti."],
    ["Pilih lanjut, revisi lalu uji kembali, atau berhenti berdasarkan catatan evaluasi dan batas biaya Anda. Tulis alasan serta langkah berikutnya.", "Membantu keputusan pribadi tanpa menjanjikan keberhasilan.", "Setelah evaluasi", "Keputusan Go, Revise, atau Stop beserta alasan yang dapat ditinjau."],
  ];
  return privateStartupRoadmapSchema.parse({ version: "private-startup-v1", generatorVersion: "personalized-v4", createdAt: now.toISOString(), sourceFingerprint: analysis.inputFingerprint,
    steps: actions.map((row, index) => ({ sequence: index + 1, stage: ROADMAP_STAGES[index], action: row[0]! + adjustments[index], objective: row[1], timeline: `${row[2]}. ${pace}`, expectedOutput: row[3] })),
  });
}
