// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LandingPage } from "./landing-page";

afterEach(() => {
    cleanup();
});

describe("LandingPage Component", () => {
    it("renders main hero headline, value proposition, and toolkits", () => {
        render(<LandingPage />);

        expect(
            screen.getByRole("heading", {
                level: 1,
                name: /Future Trend Intelligence & Business Growth Navigator untuk Ekosistem Food & Beverage Indonesia\./i,
            }),
        ).toBeDefined();

        expect(screen.getAllByText("Trend Radar").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Opportunity Fit Engine").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Action Roadmap").length).toBeGreaterThan(0);
    });

    it("renders key public navigation links and CTAs", () => {
        render(<LandingPage />);

        // Header Links
        const loginLinks = screen.getAllByRole("link", { name: /Masuk/i });
        expect(loginLinks.length).toBeGreaterThan(0);
        expect(loginLinks[0]?.getAttribute("href")).toBe("/login");

        const registerLinks = screen.getAllByRole("link", { name: /Mulai Analisis/i });
        expect(registerLinks.length).toBeGreaterThan(0);
        expect(registerLinks[0]?.getAttribute("href")).toBe("/register");
    });

    it("replaces public header CTAs with the profile control for an authenticated user", () => {
        render(<LandingPage isAuthenticated userEmail="owner@example.com" />);

        const header = screen.getByRole("banner");
        expect(within(header).getByRole("button", { name: "Menu profil" }).getAttribute("aria-expanded")).toBe("false");
        expect(within(header).queryByRole("link", { name: "Masuk" })).toBeNull();
        expect(within(header).queryByRole("link", { name: "Daftar" })).toBeNull();
    });

    it("renders evidence-oriented trust metrics", () => {
        render(<LandingPage />);

        expect(screen.getByText("Dengan sumber")).toBeDefined();
        expect(screen.getByText("Tren terkurasi")).toBeDefined();
        expect(screen.getByText("2 Persona")).toBeDefined();
        expect(screen.getByText("Batasan jelas")).toBeDefined();
    });

    it("renders TrendRadarBento feature cards and evidence metrics", () => {
        render(<LandingPage />);

        expect(screen.getByText(/Tangkap pergeseran pasar sebelum menjadi jenuh\./i)).toBeDefined();
        expect(screen.getByText("Deteksi Tren Berbasis Bukti")).toBeDefined();
        expect(screen.getByText("Tren dengan konteks yang dapat ditelusuri")).toBeDefined();
        expect(screen.getByText("Eksplorasi Peluang Menu")).toBeDefined();
        expect(screen.getByText("Konteks Pengguna yang Dipersonalisasi")).toBeDefined();
    });

    it("does not render an unverified customer testimonial", () => {
        render(<LandingPage />);

        expect(screen.queryByText(/Rian Pratama/i)).toBeNull();
    });

    it("toggles between Calon Pengusaha and UMKM Existing tabs in SuiteTabStrip", () => {
        render(<LandingPage />);

        const entrepreneurTab = screen.getByRole("tab", { name: /Calon Pengusaha F&B/i });
        const umkmTab = screen.getByRole("tab", { name: /UMKM F&B Existing/i });

        // Initially Entrepreneur tab is active
        expect(entrepreneurTab.getAttribute("aria-selected")).toBe("true");
        expect(umkmTab.getAttribute("aria-selected")).toBe("false");
        expect(screen.getByText(/Validasi ide usaha sebelum modal tabungan Anda terpakai\./i)).toBeDefined();

        // Click UMKM tab
        fireEvent.click(umkmTab);

        expect(entrepreneurTab.getAttribute("aria-selected")).toBe("false");
        expect(umkmTab.getAttribute("aria-selected")).toBe("true");
        expect(screen.getByText(/Inovasi menu dan diversifikasi produk dengan risiko terukur\./i)).toBeDefined();

        // Click back to Entrepreneur tab
        fireEvent.click(entrepreneurTab);
        expect(entrepreneurTab.getAttribute("aria-selected")).toBe("true");
        expect(screen.getByText(/Validasi ide usaha sebelum modal tabungan Anda terpakai\./i)).toBeDefined();
    });

    it("interactively updates simulation results when parameters change", () => {
        render(<LandingPage />);

        // Default is beverages + medium -> Artisan Tea & Functional Herb Hub
        expect(screen.getByText(/Artisan Tea & Functional Herb Hub/i)).toBeDefined();

        // Click "Camilan" in simulator (second Camilan button on the page)
        const snacksButtons = screen.getAllByRole("button", { name: "Camilan" });
        const simulatorSnacksButton = snacksButtons[snacksButtons.length - 1];
        if (simulatorSnacksButton) {
            fireEvent.click(simulatorSnacksButton);
        }

        expect(screen.getByText(/Fresh Baked Artisan Pastry Pod/i)).toBeDefined();

        // Click "Mikro: Rp5 – 15 Juta"
        const lowCapitalButton = screen.getByRole("button", {
            name: /Mikro: Rp5 – 15 Juta/i,
        });
        fireEvent.click(lowCapitalButton);

        expect(screen.getByText(/Gourmet Spiced Keripik & Root Chips Stand/i)).toBeDefined();
    });

    it("renders RoadmapBento milestone stages", () => {
        render(<LandingPage />);

        expect(screen.getByText(/Roadmap validasi untuk mengambil langkah berikutnya dengan lebih terarah\./i)).toBeDefined();
        expect(screen.getByText("Pilih peluang untuk divalidasi")).toBeDefined();
        expect(screen.getByText("Tinjau hasil dan tentukan langkah")).toBeDefined();
    });

    it("renders the brand at left and product solutions at right in the footer", () => {
        render(<LandingPage />);

        expect(screen.getByText("Solusi Produk")).toBeDefined();
        expect(screen.getByText("Growth Roadmap (UMKM Existing)")).toBeDefined();

        const venturexMarks = screen.getAllByText("VENTUREX");
        expect(venturexMarks.length).toBeGreaterThanOrEqual(2);
    });
});
