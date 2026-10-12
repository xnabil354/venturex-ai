// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
                name: /Ubah tren F&B menjadi keputusan bisnis yang presisi\./i,
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

    it("renders 6-cell trust and benchmark metrics", () => {
        render(<LandingPage />);

        expect(screen.getByText("100%")).toBeDefined();
        expect(screen.getByText("Bukti Pasar Riil")).toBeDefined();
        expect(screen.getByText("7 Sektor")).toBeDefined();
        expect(screen.getByText("Kategori F&B Utama")).toBeDefined();
        expect(screen.getByText("Zero-Hallucination")).toBeDefined();
    });

    it("renders TrendRadarBento and allows switching sub-category tabs", () => {
        render(<LandingPage />);

        expect(screen.getByText(/Tangkap pergeseran pasar sebelum menjadi jenuh\./i)).toBeDefined();

        const snackButtons = screen.getAllByRole("button", { name: "Camilan" });
        const snackSubTab = snackButtons[0];
        if (snackSubTab) {
            fireEvent.click(snackSubTab);
        }

        expect(screen.getByText("Artisan Root & Tubers Chips")).toBeDefined();
    });

    it("renders iconic Lilac Wash TestimonialBand", () => {
        render(<LandingPage />);

        expect(screen.getByText(/VENTUREX menyelamatkan modal tabungan saya/i)).toBeDefined();
        expect(screen.getByText(/Rian Pratama/i)).toBeDefined();
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

        expect(screen.getByText(/Panduan eksekusi bertahap dari ide menuju pembukaan gerai\./i)).toBeDefined();
        expect(screen.getByText("Validasi Resep & Sensory Test")).toBeDefined();
        expect(screen.getByText("Peluncuran Kanal & Go-to-Market")).toBeDefined();
    });

    it("renders Dark Feature Band highlighting data integrity", () => {
        render(<LandingPage />);

        expect(
            screen.getByRole("heading", {
                level: 2,
                name: /Kecerdasan buatan dengan disiplin data nyata\./i,
            }),
        ).toBeDefined();

        expect(screen.getByText(/Protokol Validasi Bukti/i)).toBeDefined();
    });

    it("renders 4-column footer with brand, legal sections, and ghost watermark", () => {
        render(<LandingPage />);

        expect(screen.getByText("Solusi Produk")).toBeDefined();
        expect(screen.getByText("Persona Pengguna")).toBeDefined();
        expect(screen.getByText("Metodologi & Data")).toBeDefined();
        expect(screen.getByText("Platform & Keamanan")).toBeDefined();
        expect(screen.getByText(/Mendukung SDG 8: Pertumbuhan Ekonomi Inklusif & Berkelanjutan\./i)).toBeDefined();

        const venturexMarks = screen.getAllByText("VENTUREX");
        expect(venturexMarks.length).toBeGreaterThanOrEqual(2);
    });
});
