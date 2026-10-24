"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { LogoutButton } from "@/components/auth/logout-button";
import { PageContainer } from "@/components/ui";
import { cx } from "@/lib/cx";

const adminNavigation = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/transactions", label: "Transaksi" },
  { href: "/admin/pricing", label: "Pricing" },
  { href: "/admin/usage", label: "Tarif kredit" },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminHeaderNavigation({ adminEmail }: { readonly adminEmail: string }) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const firstMobileLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;

    firstMobileLinkRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isMenuOpen]);

  function closeMenu() {
    setIsMenuOpen(false);
    menuButtonRef.current?.focus();
  }

  return (
    <header className="sticky top-0 z-50 text-paper-white shadow-md">
      <div className="absolute inset-0 -z-10 border-b border-white/10 bg-[#14080e]/95 backdrop-blur-[16px]" />
      <PageContainer>
        <div className="flex min-h-64 items-center justify-between gap-8 sm:gap-16">
          <Link
            aria-label="VENTUREX Operator dashboard"
            className="flex shrink-0 items-center font-w540 text-[24px] tracking-tight text-paper-white transition-opacity hover:opacity-90 sm:text-heading-sm"
            href="/admin/dashboard"
          >
            <span>VENTUREX</span><span className="ml-6 text-lilac-mist">/ Operator</span>
          </Link>

          <nav aria-label="Navigasi admin" className="hidden min-w-0 lg:block">
            <ul className="flex items-center gap-12 xl:gap-20">
              {adminNavigation.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      aria-current={active ? "page" : undefined}
                      className={cx(
                        "inline-flex min-h-button items-center border-b-2 px-4 text-body-sm font-w460 transition-[border-color,color] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lilac-mist",
                        active ? "border-lilac-mist font-w540 text-paper-white" : "border-transparent text-paper-white/70 hover:border-white/20 hover:text-lilac-mist",
                      )}
                      href={item.href}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="flex items-center gap-8 sm:gap-12">
            <p className="hidden max-w-48 truncate border-r border-white/15 pr-12 text-caption text-paper-white/70 xl:block">{adminEmail}</p>
            <div className="hidden lg:block"><LogoutButton className="border border-white/15 px-10 text-paper-white hover:bg-white/10 hover:text-lilac-mist" /></div>
            <button
              aria-controls="admin-mobile-navigation"
              aria-expanded={isMenuOpen}
              aria-label={isMenuOpen ? "Tutup menu operator" : "Buka menu operator"}
              className="inline-flex size-48 items-center justify-center text-paper-white transition-colors hover:text-lilac-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lilac-mist lg:hidden"
              onClick={() => setIsMenuOpen((current) => !current)}
              ref={menuButtonRef}
              type="button"
            >
              <span className="sr-only">Menu</span>
              {isMenuOpen ? <span aria-hidden="true" className="text-[24px] leading-none">×</span> : <span aria-hidden="true" className="text-[22px] leading-none">☰</span>}
            </button>
          </div>
        </div>
      </PageContainer>

      {isMenuOpen ? (
        <div className="border-b border-white/10 bg-[#14080e] py-16 shadow-xl lg:hidden" id="admin-mobile-navigation">
          <PageContainer>
            <nav aria-label="Menu operator">
              <ul className="grid gap-4">
                {adminNavigation.map((item, index) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        aria-current={active ? "page" : undefined}
                        className={cx(
                          "flex min-h-button items-center border-l-2 px-12 text-body-sm font-w540 transition-[background-color,border-color,color] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-lilac-mist",
                          active ? "border-lilac-mist bg-white/10 text-paper-white" : "border-transparent text-paper-white/70 hover:border-white/20 hover:bg-white/5 hover:text-paper-white",
                        )}
                        href={item.href}
                        onClick={closeMenu}
                        ref={index === 0 ? firstMobileLinkRef : undefined}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <div className="mt-16 border-t border-white/10 pt-16">
              <p className="break-words text-caption text-paper-white/60">{adminEmail}</p>
              <div className="mt-10" onClick={closeMenu}><LogoutButton className="w-full justify-start" variant="inverse" /></div>
            </div>
          </PageContainer>
        </div>
      ) : null}
    </header>
  );
}
