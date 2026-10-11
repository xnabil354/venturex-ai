import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ONBOARDING_STATUSES, USER_TYPES, parseUserId } from "../../auth/user-types";
import { createUnavailableDashboardModules, type DashboardDto } from "../../dashboard/dto";

import { DashboardPage } from "./dashboard-page";

const entrepreneurDashboard = {
  userType: USER_TYPES.ENTREPRENEUR,
  onboardingStatus: ONBOARDING_STATUSES.COMPLETED,
  profile: {
    location: {
      text: "Jakarta Pusat",
      city: "Jakarta Pusat",
      province: "DKI Jakarta",
      countryCode: "ID",
    },
    budget: { min: 5_000_000, max: 10_000_000 },
    experienceLevel: "BEGINNER",
    timeCommitment: "PART_TIME",
    preferredProductType: "Minuman",
    interests: [{ code: "BEVERAGES", name: "Minuman" }],
    customerSegments: [{ code: "STUDENTS", name: "Pelajar dan mahasiswa" }],
    salesChannels: [{ code: "OFFLINE_STORE", name: "Gerai atau toko offline" }],
  },
  modules: createUnavailableDashboardModules(),
} satisfies DashboardDto;

const businessDashboard = {
  userType: USER_TYPES.UMKM_EXISTING,
  onboardingStatus: ONBOARDING_STATUSES.COMPLETED,
  profile: {
    businessName: "Kedai Pagi",
    businessCategory: { code: "BEVERAGES", name: "Minuman" },
    location: {
      text: "Bandung",
      city: "Bandung",
      province: "Jawa Barat",
      countryCode: "ID",
    },
    averagePrice: { min: 15_000, max: 35_000 },
    productCount: 3,
    customerSegments: [{ code: "OFFICE_WORKERS", name: "Pekerja kantor dan komuter" }],
    salesChannels: [{ code: "DIRECT_ONLINE", name: "Penjualan langsung online" }],
  },
  modules: createUnavailableDashboardModules(),
} satisfies DashboardDto;

const entrepreneurWithTrend = {
  ...entrepreneurDashboard,
  modules: {
    ...entrepreneurDashboard.modules,
    trends: {
      status: "AVAILABLE",
      preview: [
        {
          id: "60000000-0000-4000-8000-000000000001",
          title: "Pilihan minuman berbasis tanaman meningkat",
          categoryName: "Consumer Behavior",
          summary: "Lebih banyak pelanggan memilih minuman berbasis tanaman.",
        },
      ],
    },
  },
} satisfies DashboardDto;

const businessTrendError = {
  ...businessDashboard,
  modules: {
    ...businessDashboard.modules,
    trends: { status: "ERROR", preview: [] },
  },
} satisfies DashboardDto;

function withSavedOpportunity(dashboard: DashboardDto, id: string, name: string): DashboardDto {
  return {
    ...dashboard,
    modules: {
      ...dashboard.modules,
      savedOpportunities: {
        status: "AVAILABLE",
        preview: [{
          id,
          name,
          categoryName: "Minuman",
          summary: "Peluang yang sebelumnya disimpan.",
        }],
      },
    },
  };
}

function withOpportunity(dashboard: DashboardDto, id: string, name: string): DashboardDto {
  return {
    ...dashboard,
    modules: {
      ...dashboard.modules,
      opportunities: {
        status: "AVAILABLE",
        preview: [{
          id,
          name,
          categoryName: "Minuman",
          summary: "Ringkasan dari katalog peluang.",
          relatedTrendTitle: "Kebiasaan memilih minuman praktis meningkat",
        }],
      },
    },
  };
}

function renderDashboard(dashboard: DashboardDto, profileUpdated = false): string {
  return renderToStaticMarkup(
    <DashboardPage dashboard={dashboard} profileUpdated={profileUpdated} />,
  ).replace(/\s+/gu, " ");
}

describe("DashboardPage", () => {
  it("renders the entrepreneur summary and honest unavailable modules", () => {
    const markup = renderDashboard(entrepreneurDashboard);

    expect(markup).toContain("Selamat datang kembali");
    expect(markup).toContain("Ringkasan profil calon pengusaha Anda");
    expect(markup).toContain("Profil siap");
    expect(markup).toContain('href="/profile"');
    expect(markup).toContain("Edit profil");
    expect(markup).toContain("Rp 5.000.000");
    expect(markup).toContain("Trend Radar");
    expect(markup).toContain("Belum tersedia");
    expect(markup).not.toContain("passwordHash");
    expect(markup).not.toContain("userId");
    expect(markup).not.toContain("profileId");
  });

  it("renders the UMKM summary with a product count and no product collection", () => {
    const markup = renderDashboard(businessDashboard);

    expect(markup).toContain("Ringkasan bisnis Kedai Pagi");
    expect(markup).toContain("Kategori bisnis");
    expect(markup).toContain("3 produk");
    expect(markup).toContain('href="/profile"');
    expect(markup).toContain("Edit profil");
    expect(markup).toContain("Jelajahi Peluang");
    expect(markup).not.toContain("productId");
    expect(markup).not.toContain("passwordHash");
    expect(markup).not.toContain("Buka Roadmap");
  });

  it("links the Entrepreneur roadmap module to saved Startup Roadmaps", () => {
    const markup = renderDashboard({
      ...entrepreneurDashboard,
      modules: { ...entrepreneurDashboard.modules, roadmap: { status: "AVAILABLE" } },
    });
    expect(markup).toContain('href="/roadmaps"');
    expect(markup).toContain("Buka Roadmap");
  });

  it("confirms a saved profile update alongside the current profile summary", () => {
    const markup = renderDashboard(entrepreneurDashboard, true);

    expect(markup).toContain("Profil berhasil diperbarui.");
    expect(markup).toContain("Ringkasan ini menampilkan data terbaru.");
    expect(markup).toContain("Jakarta Pusat");
  });

  it("offers UMKM profile editing and confirms the latest business profile after save", () => {
    const markup = renderDashboard(businessDashboard, true);

    expect(markup).toContain('href="/profile"');
    expect(markup).toContain("Edit profil");
    expect(markup).toContain("Profil berhasil diperbarui.");
    expect(markup).toContain("Ringkasan ini menampilkan data terbaru.");
    expect(markup).toContain("Kedai Pagi");
  });

  it("renders a real Trend preview and navigation to the Trend list", () => {
    const markup = renderDashboard(entrepreneurWithTrend);

    expect(markup).toContain("Pilihan minuman berbasis tanaman meningkat");
    expect(markup).toContain("Lebih banyak pelanggan memilih minuman berbasis tanaman.");
    expect(markup).toContain('href="/trends/60000000-0000-4000-8000-000000000001"');
    expect(markup).toContain('href="/trends"');
    expect(markup).toContain("Lihat semua Trend");
  });

  it.each([
    [entrepreneurDashboard, "92000000-0000-4000-8000-000000000001", "Menu praktis", "Ringkasan profil calon pengusaha Anda"],
    [businessDashboard, "92000000-0000-4000-8000-000000000002", "Paket sarapan", "Ringkasan bisnis Kedai Pagi"],
  ] as const)("renders the neutral Opportunity preview and links for each Dashboard type", (dashboard, id, name, profileLabel) => {
    const markup = renderDashboard(withOpportunity(dashboard, id, name));

    expect(markup).toContain("Jelajahi Peluang");
    expect(markup).toContain(name);
    expect(markup).toContain("Ringkasan dari katalog peluang.");
    expect(markup).toContain("Minuman");
    expect(markup).toContain("Kebiasaan memilih minuman praktis meningkat");
    expect(markup).toContain(`href="/opportunities/${id}"`);
    expect(markup).toContain('href="/opportunities"');
    expect(markup).toContain(profileLabel);
    expect(markup).not.toContain("Top Recommendation");
    expect(markup).not.toContain("Paling Cocok untuk Anda");
  });

  it("renders honest Opportunity EMPTY and ERROR states without hiding other modules", () => {
    const empty = renderDashboard({
      ...entrepreneurDashboard,
      modules: {
        ...entrepreneurDashboard.modules,
        opportunities: { status: "EMPTY", preview: [] },
        trends: { status: "AVAILABLE", preview: [] },
      },
    });
    const error = renderDashboard({
      ...businessDashboard,
      modules: {
        ...businessDashboard.modules,
        opportunities: { status: "ERROR", preview: [] },
        savedOpportunities: {
          status: "AVAILABLE",
          preview: [{
            id: "93000000-0000-4000-8000-000000000001",
            name: "Peluang tersimpan",
            categoryName: "Minuman",
            summary: "Disimpan oleh pengguna.",
          }],
        },
      },
    });

    expect(empty).toContain("Belum ada peluang dengan Trend terpublikasi untuk tipe akun Anda.");
    expect(empty).toContain('href="/opportunities"');
    expect(error).toContain("Katalog peluang belum dapat dimuat. Bagian Dashboard lainnya tetap tersedia.");
    expect(error).toContain('href="/opportunities"');
    expect(error).toContain("Ringkasan bisnis Kedai Pagi");
    expect(error).toContain("Peluang tersimpan");
  });

  it("keeps the UMKM summary visible when the Trend section reports an error", () => {
    const markup = renderDashboard(businessTrendError);

    expect(markup).toContain("Ringkasan bisnis Kedai Pagi");
    expect(markup).toContain("Trend belum dapat dimuat saat ini. Ringkasan Dashboard tetap tersedia.");
    expect(markup).toContain("Tidak dapat dimuat");
    expect(markup).toContain('href="/trends"');
  });

  it.each([
    [entrepreneurDashboard, "60000000-0000-4000-8000-000000000011", "Menu minuman kemasan"],
    [businessDashboard, "60000000-0000-4000-8000-000000000012", "Paket sarapan"],
  ] as const)("renders saved-opportunity detail and list links for each Dashboard type", (dashboard, id, name) => {
    const markup = renderDashboard(withSavedOpportunity(dashboard, id, name));

    expect(markup).toContain(name);
    expect(markup).toContain("Peluang tersimpan yang masih sesuai untuk tipe akun Anda.");
    expect(markup).toContain(`href="/opportunities/${id}"`);
    expect(markup).toContain('href="/saved"');
  });

  it("renders honest empty and error states with access to the saved-opportunities list", () => {
    const empty = renderDashboard({
      ...entrepreneurDashboard,
      modules: {
        ...entrepreneurDashboard.modules,
        savedOpportunities: { status: "EMPTY", preview: [] },
      },
    });
    const error = renderDashboard({
      ...businessDashboard,
      modules: {
        ...businessDashboard.modules,
        savedOpportunities: { status: "ERROR", preview: [] },
      },
    });

    expect(empty).toContain("Belum ada peluang eligible yang tersimpan.");
    expect(empty).toContain('href="/saved"');
    expect(error).toContain("Peluang tersimpan belum dapat dimuat saat ini. Ringkasan Dashboard tetap tersedia.");
    expect(error).toContain('href="/saved"');
    expect(error).toContain("Ringkasan bisnis Kedai Pagi");
  });

  it("does not render raw ownership identifiers", () => {
    const userId = parseUserId("00000000-0000-4000-8000-000000000101");
    const markup = renderDashboard(entrepreneurDashboard);

    expect(markup).not.toContain(userId);
  });
});
