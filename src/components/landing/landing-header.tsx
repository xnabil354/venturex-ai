"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { LogoutButton } from "@/components/auth/logout-button";

type LandingHeaderProps = Readonly<{
  userEmail?: string;
}>;

export function LandingHeader({ userEmail }: LandingHeaderProps) {
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

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        isScrolled || mobileMenuOpen
          ? "border-b border-white/10 bg-[#14080e]/85 backdrop-blur-[16px] shadow-lg"
          : "border-b border-transparent bg-transparent backdrop-blur-none"
      }`}
    >
      <div className="mx-auto flex h-64 min-h-64 max-w-[1280px] items-center justify-between px-16 sm:px-24">
        {/* Left: Brand Logo + Desktop Nav Items */}
        <div className="flex items-center gap-28 lg:gap-36">
          <Link
            href="/"
            className="flex items-center gap-8 font-w540 text-heading-sm tracking-heading-sm text-paper-white transition-opacity hover:opacity-90 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac-mist focus-visible:ring-offset-2 focus-visible:ring-offset-[#14080e] rounded-sm"
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
              href="#fitur-utama"
              className="text-body-sm lg:text-body font-w460 text-paper-white/80 transition-colors hover:text-lilac-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac-mist focus-visible:ring-offset-2 focus-visible:ring-offset-[#14080e] rounded-sm py-4 px-2"
            >
              Fitur Utama
            </a>
            <a
              href="#alur-solusi"
              className="text-body-sm lg:text-body font-w460 text-paper-white/80 transition-colors hover:text-lilac-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac-mist focus-visible:ring-offset-2 focus-visible:ring-offset-[#14080e] rounded-sm py-4 px-2"
            >
              Alur Solusi
            </a>
            <a
              href="#pricing"
              className="text-body-sm lg:text-body font-w460 text-paper-white/80 transition-colors hover:text-lilac-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac-mist focus-visible:ring-offset-2 focus-visible:ring-offset-[#14080e] rounded-sm py-4 px-2"
            >
              Harga
            </a>
          </nav>
        </div>

        {/* Right: Auth CTA Controls */}
        {userEmail ? (
          <LandingProfileMenu userEmail={userEmail} />
        ) : (
          <div className="hidden shrink-0 items-center gap-16 md:flex">
            <Link
              href="/login"
              className="inline-flex min-h-[44px] items-center px-12 text-body font-w460 text-paper-white/80 transition-colors hover:text-lilac-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac-mist focus-visible:ring-offset-2 focus-visible:ring-offset-[#14080e] rounded-sm"
            >
              Masuk
            </Link>
            <Link
              href="/register"
              className="inline-flex min-h-[44px] items-center justify-center rounded-small-buttons bg-paper-white px-20 text-body-sm font-w540 text-midnight-wine transition-all duration-200 hover:bg-lilac-mist hover:scale-[1.02] active:scale-[0.98] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac-mist focus-visible:ring-offset-2 focus-visible:ring-offset-[#14080e]"
            >
              Daftar
            </Link>
          </div>
        )}

        {/* Mobile Menu Button (Accessible 44x44px Touch Target) */}
        <button
          type="button"
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-nav-menu"
          aria-label="Menu navigasi mobile"
          className="inline-flex h-44 w-44 min-h-[44px] min-w-[44px] items-center justify-center rounded-small-buttons border border-white/15 bg-white/10 text-paper-white backdrop-blur-md md:hidden hover:bg-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac-mist focus-visible:ring-offset-2 focus-visible:ring-offset-[#14080e]"
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
        <div
          id="mobile-nav-menu"
          className="border-b border-white/10 bg-[#160a10]/95 backdrop-blur-2xl px-16 py-20 md:hidden sm:px-24"
        >
          <nav className="flex flex-col gap-16" aria-label="Navigasi Mobile">
            <a
              href="#fitur-utama"
              className="text-body font-w460 text-paper-white/85 hover:text-lilac-mist py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac-mist rounded-sm"
              onClick={() => setMobileMenuOpen(false)}
            >
              Fitur Utama
            </a>
            <a
              href="#alur-solusi"
              className="text-body font-w460 text-paper-white/85 hover:text-lilac-mist py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac-mist rounded-sm"
              onClick={() => setMobileMenuOpen(false)}
            >
              Alur Solusi
            </a>
            <a
              href="#pricing"
              className="text-body font-w460 text-paper-white/85 hover:text-lilac-mist py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac-mist rounded-sm"
              onClick={() => setMobileMenuOpen(false)}
            >
              Harga
            </a>
            {userEmail ? null : <div className="mt-8 flex flex-col gap-12 border-t border-white/10 pt-16">
              <Link
                href="/login"
                className="text-center text-body font-w460 text-paper-white/85 py-10 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac-mist"
                onClick={() => setMobileMenuOpen(false)}
              >
                Masuk
              </Link>
              <Link
                href="/register"
                className="inline-flex min-h-[44px] items-center justify-center rounded-small-buttons bg-paper-white px-16 text-body font-w540 text-midnight-wine hover:bg-lilac-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac-mist"
                onClick={() => setMobileMenuOpen(false)}
              >
                Daftar
              </Link>
            </div>}
          </nav>
        </div>
      ) : null}
    </header>
  );
}

function LandingProfileMenu({ userEmail }: Readonly<{ userEmail: string }>) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const profileLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    profileLinkRef.current?.focus();

    const closeOnOutsidePress = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setIsOpen(false);
      buttonRef.current?.focus();
    };

    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        aria-controls={isOpen ? "landing-profile-menu" : undefined}
        aria-expanded={isOpen}
        aria-label="Menu profil"
        className="inline-flex size-48 items-center justify-center text-paper-white transition-colors hover:text-lilac-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lilac-mist"
        onClick={() => setIsOpen((current) => !current)}
        ref={buttonRef}
        title="Profil dan akun"
        type="button"
      >
        <svg aria-hidden="true" className="size-20" fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.6" />
          <path d="M5.5 20a6.5 6.5 0 0 1 13 0" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
        </svg>
      </button>
      {isOpen ? <div className="absolute right-0 top-full z-50 mt-8 w-[min(18rem,calc(100vw-2rem))] rounded-cards border border-white/15 bg-[#14080e] p-16 text-paper-white shadow-xl" id="landing-profile-menu">
        <p className="break-words border-b border-white/10 pb-12 text-caption text-paper-white/70">{userEmail}</p>
        <Link
          className="mt-8 flex min-h-button items-center rounded-small-buttons px-12 text-body-sm font-w540 text-paper-white transition-colors hover:bg-white/10 hover:text-lilac-mist focus-visible:outline-2 focus-visible:outline-lilac-mist"
          href="/profile"
          onClick={() => setIsOpen(false)}
          ref={profileLinkRef}
        >
          Edit profil
        </Link>
        <div onClick={() => setIsOpen(false)}>
          <LogoutButton className="mt-4 w-full justify-start px-12 text-paper-white hover:bg-white/10 hover:text-lilac-mist" />
        </div>
      </div> : null}
    </div>
  );
}
