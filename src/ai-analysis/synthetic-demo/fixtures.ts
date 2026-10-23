import "server-only";

import { createHash } from "node:crypto";

import { opportunityAnalysisSchema, type OpportunityAnalysis } from "../domain";
import type { SyntheticDemoFixtureId } from "./contracts";

const fixtureVersion = "synthetic-fixture-v1" as const;

type FixtureContent = {
  readonly fixtureId: SyntheticDemoFixtureId;
  readonly fixtureVersion: typeof fixtureVersion;
  readonly userType: "ENTREPRENEUR" | "UMKM_EXISTING";
  readonly personaLabel: string;
  readonly profile: { readonly summary: string };
  readonly opportunity: {
    readonly name: string;
    readonly description: string;
    readonly hypothesisLabel: "Hipotesis simulasi";
  };
  readonly evidence: {
    readonly status: "UNAVAILABLE";
    readonly records: readonly [];
    readonly reason: string;
  };
  readonly decisionSupport: {
    readonly opportunityScore: { readonly status: "UNAVAILABLE"; readonly reason: string };
    readonly fitScore: { readonly status: "UNAVAILABLE"; readonly reason: string };
    readonly riskAssessment: { readonly status: "UNAVAILABLE"; readonly reason: string };
  };
  readonly limitations: readonly string[];
  readonly mockAnalysis: OpportunityAnalysis;
};

export type SyntheticDemoFixture = FixtureContent & {
  readonly fixtureContentHash: string;
};

const content: readonly FixtureContent[] = [
  {
    fixtureId: "DEMO_ENTREPRENEUR",
    fixtureVersion,
    userType: "ENTREPRENEUR",
    personaLabel: "Calon pengusaha — profil sintetis",
    profile: {
      summary: "Profil simulasi: tertarik mengeksplorasi konsep minuman berbasis teh dan masih berada pada tahap awal. Tidak mewakili orang atau usaha nyata.",
    },
    opportunity: {
      name: "Konsep minuman teh racikan",
      description: "Gagasan simulasi untuk merancang satu minuman teh racikan dan menguji apakah calon konsumen memahami proposisi produknya.",
      hypothesisLabel: "Hipotesis simulasi",
    },
    evidence: {
      status: "UNAVAILABLE",
      records: [],
      reason: "Demo ini tidak memuat sumber pasar atau evidence eksternal.",
    },
    decisionSupport: {
      opportunityScore: { status: "UNAVAILABLE", reason: "Skor Opportunity tidak dihitung dalam simulasi." },
      fitScore: { status: "UNAVAILABLE", reason: "Fit Score tidak dihitung dari profil sintetis." },
      riskAssessment: { status: "UNAVAILABLE", reason: "Risk Indicator tidak dihitung tanpa policy dan data yang disetujui." },
    },
    limitations: [
      "Seluruh profil dan konsep adalah data sintetis tetap.",
      "Tidak ada evidence pasar, data pesaing, metrik permintaan, atau sumber eksternal.",
      "Uraian analisis adalah bantuan eksplorasi dan bukan validasi pasar atau jaminan kelayakan bisnis.",
    ],
    mockAnalysis: opportunityAnalysisSchema.parse({
      summary: "Ini contoh analisis untuk gagasan minuman teh racikan pada profil calon pengusaha sintetis; bukan temuan pasar.",
      whyRelevant: "Profil simulasi menyebut minat pada minuman berbasis teh. Kaitan ini hanya menunjukkan kecocokan dengan minat sintetis, bukan bukti adanya permintaan.",
      targetConsumer: "Segmen konsumen belum ditentukan oleh evidence. Wawancarai calon konsumen yang Anda pilih sebelum menetapkan sasaran.",
      competition: "Tidak tersedia data pesaing dalam simulasi. Periksa menu dan harga di area yang benar-benar akan dilayani.",
      potential: "Potensi usaha belum dapat dinilai dari data ini. Perlakukan gagasan sebagai hipotesis yang perlu diuji.",
      risks: [
        "Tidak ada evidence pasar atau data pesaing yang mendukung kelayakan konsep.",
        "Profil sintetis tidak menggambarkan kondisi, sumber daya, atau batasan pengusaha nyata.",
      ],
      nextAction: "Susun pertanyaan wawancara singkat, lalu catat tanggapan calon konsumen sebelum mengeluarkan biaya untuk pengembangan produk.",
    }),
  },
  {
    fixtureId: "DEMO_UMKM",
    fixtureVersion,
    userType: "UMKM_EXISTING",
    personaLabel: "Pelaku UMKM — profil sintetis",
    profile: {
      summary: "Profil simulasi: menjalankan usaha minuman fiktif dan ingin menilai sebuah gagasan varian. Tidak mewakili orang atau usaha nyata.",
    },
    opportunity: {
      name: "Eksplorasi varian minuman teh",
      description: "Gagasan simulasi untuk menguji satu varian minuman teh pada usaha fiktif sebelum mempertimbangkan perubahan menu.",
      hypothesisLabel: "Hipotesis simulasi",
    },
    evidence: {
      status: "UNAVAILABLE",
      records: [],
      reason: "Demo ini tidak memuat sumber pasar atau evidence eksternal.",
    },
    decisionSupport: {
      opportunityScore: { status: "UNAVAILABLE", reason: "Skor Opportunity tidak dihitung dalam simulasi." },
      fitScore: { status: "UNAVAILABLE", reason: "Fit Score tidak dihitung dari profil sintetis." },
      riskAssessment: { status: "UNAVAILABLE", reason: "Risk Indicator tidak dihitung tanpa policy dan data yang disetujui." },
    },
    limitations: [
      "Seluruh profil dan konsep adalah data sintetis tetap.",
      "Tidak ada evidence pasar, data pesaing, metrik permintaan, atau sumber eksternal.",
      "Uraian analisis adalah bantuan eksplorasi dan bukan validasi pasar atau jaminan kelayakan bisnis.",
    ],
    mockAnalysis: opportunityAnalysisSchema.parse({
      summary: "Ini contoh analisis untuk mengeksplorasi varian minuman pada profil UMKM sintetis; bukan temuan pasar.",
      whyRelevant: "Tujuan simulasi adalah menilai gagasan varian untuk usaha minuman fiktif. Relevansi ini berasal dari skenario yang disediakan, bukan hasil pengukuran usaha nyata.",
      targetConsumer: "Data pelanggan usaha tidak tersedia. Tentukan pelanggan yang akan dimintai tanggapan berdasarkan kondisi usaha nyata Anda.",
      competition: "Simulasi tidak menyediakan data pesaing atau menu di sekitar usaha. Tinjau lingkungan usaha sebelum membandingkan produk.",
      potential: "Belum ada evidence untuk menilai potensi varian atau dampaknya pada usaha. Jangan menafsirkan contoh ini sebagai proyeksi.",
      risks: [
        "Tidak ada evidence pasar, biaya, atau penjualan yang mendukung keputusan menu.",
        "Skenario usaha sintetis tidak memuat operasi atau pelanggan UMKM nyata.",
      ],
      nextAction: "Catat hipotesis tentang varian, minta umpan balik pelanggan secara langsung, dan tinjau biaya bahan sebelum memutuskan uji menu.",
    }),
  },
];

function fingerprint(value: FixtureContent): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

export const SYNTHETIC_DEMO_FIXTURES: Readonly<Record<SyntheticDemoFixtureId, SyntheticDemoFixture>> =
  Object.freeze(Object.fromEntries(content.map((fixture) => [
    fixture.fixtureId,
    deepFreeze({ ...fixture, fixtureContentHash: fingerprint(fixture) }),
  ])) as Record<SyntheticDemoFixtureId, SyntheticDemoFixture>);

export function getSyntheticDemoFixture(id: SyntheticDemoFixtureId): SyntheticDemoFixture {
  return SYNTHETIC_DEMO_FIXTURES[id];
}
