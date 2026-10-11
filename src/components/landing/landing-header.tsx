"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function LandingHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        isScrolled || mobileMenuOpen
          ? "border-b border-white/10 bg-[#14080e]/85 backdrop-blur-[16px] shadow-lg"
          : "border-b border-transparent bg-transparent backdrop-blur-none"
      }`}
    >
      <div className="mx-auto flex h-64 min-h-64 max-w-[1280px] items-center justify-between px-16 sm:px-24">
        {/* Left: Brand Logo + Desktop Nav Items (didekat brand logo) */}
        <div className="flex items-center gap-28 lg:gap-36">
          <Link
            href="/"
            className="flex items-center gap-8 font-w540 text-heading-sm tracking-heading-sm text-paper-white transition-opacity hover:opacity-90 shrink-0"
            aria-label="VENTUREX AI Beranda"
          >
            <span className="h-8 w-8 rounded-full bg-lilac-mist" aria-hidden="true" />
            <span className="tracking-tight text-paper-white">VENTUREX</span>
          </Link>

          {/* Desktop Nav Items */}
          <nav
            aria-label="Navigasi Halaman Utama"
            className="hidden items-center gap-20 lg:gap-28 md:flex"
          >
            <a
              href="#alur-solusi"
              className="text-body-sm lg:text-body font-w460 text-paper-white/80 transition-colors hover:text-lilac-mist"
            >
              Alur Solusi
            </a>
            <a
              href="#fitur-utama"
              className="text-body-sm lg:text-body font-w460 text-paper-white/80 transition-colors hover:text-lilac-mist"
            >
              Fitur Utama
            </a>
            <a
              href="#kualitas-data"
              className="text-body-sm lg:text-body font-w460 text-paper-white/80 transition-colors hover:text-lilac-mist"
            >
              Integritas Data
            </a>
            <a
              href="#simulasi-skor"
              className="text-body-sm lg:text-body font-w460 text-paper-white/80 transition-colors hover:text-lilac-mist"
            >
              Simulasi Fit
            </a>
          </nav>
        </div>

        {/* Right: Auth CTA Controls */}
        <div className="hidden items-center gap-16 md:flex shrink-0">
          <Link
            href="/login"
            className="px-8 py-6 text-body font-w460 text-paper-white/80 transition-colors hover:text-lilac-mist"
          >
            Masuk
          </Link>
          <Link
            href="/register"
            className="inline-flex min-h-[38px] items-center justify-center rounded-small-buttons bg-paper-white px-16 py-6 text-body-sm font-w540 text-midnight-wine transition-all duration-200 hover:bg-lilac-mist hover:scale-[1.02] active:scale-[0.98] shadow-sm"
          >
            Mulai Analisis
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          type="button"
          aria-expanded={mobileMenuOpen}
          aria-label="Menu navigasi mobile"
          className="inline-flex h-40 w-40 items-center justify-center rounded-small-buttons border border-white/15 bg-white/10 text-paper-white backdrop-blur-md md:hidden hover:bg-white/20 transition-colors"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
        >
          {mobileMenuOpen ? (
            <svg
              className="h-20 w-20"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg
              className="h-20 w-20"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen ? (
        <div className="border-b border-white/10 bg-[#160a10]/95 backdrop-blur-2xl px-16 py-20 md:hidden sm:px-24">
          <nav className="flex flex-col gap-16" aria-label="Navigasi Mobile">
            <a
              href="#alur-solusi"
              className="text-body font-w460 text-paper-white/85 hover:text-lilac-mist"
              onClick={() => setMobileMenuOpen(false)}
            >
              Alur Solusi
            </a>
            <a
              href="#fitur-utama"
              className="text-body font-w460 text-paper-white/85 hover:text-lilac-mist"
              onClick={() => setMobileMenuOpen(false)}
            >
              Fitur Utama
            </a>
            <a
              href="#kualitas-data"
              className="text-body font-w460 text-paper-white/85 hover:text-lilac-mist"
              onClick={() => setMobileMenuOpen(false)}
            >
              Integritas Data
            </a>
            <a
              href="#simulasi-skor"
              className="text-body font-w460 text-paper-white/85 hover:text-lilac-mist"
              onClick={() => setMobileMenuOpen(false)}
            >
              Simulasi Fit
            </a>
            <div className="mt-8 flex flex-col gap-12 border-t border-white/10 pt-16">
              <Link
                href="/login"
                className="text-center text-body font-w460 text-paper-white/85 py-8"
                onClick={() => setMobileMenuOpen(false)}
              >
                Masuk
              </Link>
              <Link
                href="/register"
                className="inline-flex min-h-[44px] items-center justify-center rounded-small-buttons bg-paper-white px-16 text-body font-w540 text-midnight-wine hover:bg-lilac-mist"
                onClick={() => setMobileMenuOpen(false)}
              >
                Mulai Analisis
              </Link>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
