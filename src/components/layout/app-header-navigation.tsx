"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { createPortal } from "react-dom";

import { LogoutButton } from "@/components/auth/logout-button";
import { useBillingState } from "@/components/billing/billing-state";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { PageContainer } from "@/components/ui";
import {
  appNavigation,
  isNavigationActive,
  primaryNavigation,
} from "@/components/layout/navigation";
import { cx } from "@/lib/cx";

const desktopLinkClasses =
  "inline-flex min-h-button items-center border-b-2 px-4 text-body-sm font-w460 transition-[border-color,color] duration-150 ease-out";

const mobileLinkClasses =
  "flex min-h-button items-center border-l-2 px-12 text-body-sm font-w540 transition-[background-color,border-color,color] duration-150 ease-out";

const headerNavigation = primaryNavigation.filter((item) => item.href !== "/billing");
const mobileNavigation = appNavigation;

const subscribeToHydration = () => () => {};
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

type AppHeaderNavigationProps = {
  userEmail?: string;
  availableCredits?: number;
};

export function AppHeaderNavigation({ userEmail, availableCredits }: AppHeaderNavigationProps) {
  const billing = useBillingState();
  const currentCredits = billing ? billing.stale ? undefined : billing.snapshot?.availableCredits : availableCredits;
  const aiLocked = !billing?.stale && billing?.snapshot?.canUseAi === false;
  const pathname = usePathname();
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  );
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profileActionRef = useRef<HTMLAnchorElement>(null);
  const firstMobileLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

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

  useEffect(() => {
    if (!isProfileMenuOpen) return;

    profileActionRef.current?.focus();

    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !profileMenuRef.current?.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsProfileMenuOpen(false);
        profileButtonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isProfileMenuOpen]);

  function closeMenu() {
    setIsMenuOpen(false);
    menuButtonRef.current?.focus();
  }

  return (
    <>
      <header className="sticky top-0 z-50 text-paper-white shadow-md">
        <div className="absolute inset-0 -z-10 border-b border-white/10 bg-[#14080e]/95 backdrop-blur-[16px]" />
        <PageContainer>
          <div className="flex min-h-64 items-center justify-between gap-8 sm:gap-16">
            <Link
              aria-label="VENTUREX home"
              className="flex shrink-0 items-center font-w540 text-[20px] sm:text-heading-sm tracking-tight text-paper-white transition-opacity hover:opacity-90"
              href="/dashboard"
            >
              <span>VENTUREX</span>
            </Link>

            <div className="hidden min-w-0 items-center lg:flex">
              <nav aria-label="Primary navigation">
                <ul className="flex items-center gap-12 xl:gap-20">
                  {headerNavigation.map((item) => {
                    const isActive = isNavigationActive(pathname, item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          aria-current={isActive ? "page" : undefined}
                          className={cx(
                            desktopLinkClasses,
                            isActive
                              ? "border-lilac-mist text-paper-white font-w540"
                              : "border-transparent text-paper-white/70 hover:border-white/20 hover:text-lilac-mist",
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
            </div>

            <div className="flex items-center gap-4 sm:gap-12">
              {userEmail ? (
                <Link
                  aria-label={currentCredits === undefined ? "Saldo kredit belum tersedia. Buka paket dan kredit" : `${currentCredits} kredit tersisa${aiLocked ? ", AI terkunci" : ""}. Buka paket dan kredit`}
                  className="inline-flex min-h-44 shrink-0 items-center gap-4 rounded-pills border border-white/15 bg-white/10 px-8 text-caption font-w540 tabular-nums text-paper-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lilac-mist sm:px-12"
                  href="/billing"
                  title={aiLocked ? "Kredit tersimpan · AI terkunci" : "Kredit tersisa"}
                >
                  <span aria-hidden="true" className="text-lilac-mist">✦</span>
                  <span>{currentCredits === undefined ? "—" : new Intl.NumberFormat("id-ID").format(currentCredits)}</span>
                  <span className="hidden sm:inline">kredit</span>
                  {aiLocked ? <svg aria-hidden="true" className="size-12 text-lilac-mist" fill="none" viewBox="0 0 16 16"><rect x="3" y="7" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1.4" /><path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.4" /></svg> : null}
                </Link>
              ) : null}
              {userEmail ? <NotificationBell /> : null}
              {userEmail ? (
                <div className="relative hidden lg:ml-8 lg:block lg:border-l lg:border-white/15 lg:pl-12" ref={profileMenuRef}>
                  <button
                    aria-controls={isProfileMenuOpen ? "profile-account-menu" : undefined}
                    aria-expanded={isProfileMenuOpen}
                    aria-label="Menu profil"
                    className={cx(
                      "inline-flex size-48 items-center justify-center text-paper-white transition-colors hover:text-lilac-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lilac-mist",
                      isNavigationActive(pathname, "/profile") && "text-lilac-mist",
                    )}
                    onClick={() => setIsProfileMenuOpen((current) => !current)}
                    ref={profileButtonRef}
                    title="Profil dan akun"
                    type="button"
                  >
                    <svg aria-hidden="true" className="size-20" fill="none" viewBox="0 0 24 24">
                      <circle cx="12" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.6" />
                      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
                    </svg>
                  </button>
                  {isProfileMenuOpen ? (
                    <div className="absolute right-0 top-full z-50 mt-8 w-[min(18rem,calc(100vw-2rem))] rounded-cards border border-white/15 bg-[#14080e] p-16 text-paper-white shadow-xl" id="profile-account-menu">
                      <p className="break-words border-b border-white/10 pb-12 text-caption text-paper-white/70">{userEmail}</p>
                      <Link
                        aria-label={currentCredits === undefined ? "Buka paket dan kredit" : `${currentCredits} kredit tersedia. Buka paket dan kredit`}
                        className="mt-8 flex min-h-button items-center justify-between gap-12 rounded-small-buttons px-12 text-body-sm font-w540 text-paper-white transition-colors hover:bg-white/10 hover:text-lilac-mist focus-visible:outline-2 focus-visible:outline-lilac-mist"
                        href="/billing"
                        onClick={() => setIsProfileMenuOpen(false)}
                      >
                        <span>Paket & kredit</span>
                        {currentCredits === undefined ? null : <span className="text-caption text-lilac-mist">{currentCredits} kredit</span>}
                      </Link>
                      <Link
                        className="mt-8 flex min-h-button items-center rounded-small-buttons px-12 text-body-sm font-w540 text-paper-white transition-colors hover:bg-white/10 hover:text-lilac-mist focus-visible:outline-2 focus-visible:outline-lilac-mist"
                        href="/profile"
                        onClick={() => setIsProfileMenuOpen(false)}
                        ref={profileActionRef}
                      >
                        Edit profil
                      </Link>
                      <div onClick={() => setIsProfileMenuOpen(false)}>
                        <LogoutButton className="mt-4 w-full justify-start px-12 text-paper-white hover:bg-white/10 hover:text-lilac-mist" />
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <button
                aria-controls="mobile-navigation-panel"
                aria-expanded={isMenuOpen}
                aria-label={isMenuOpen ? "Tutup menu navigasi" : "Buka menu navigasi"}
                className="inline-flex size-48 items-center justify-center text-paper-white transition-colors duration-150 ease-out hover:text-lilac-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lilac-mist lg:hidden"
                onClick={() => setIsMenuOpen((current) => !current)}
                ref={menuButtonRef}
                type="button"
              >
                {isMenuOpen ? (
                  <svg aria-hidden="true" className="size-20" fill="none" viewBox="0 0 24 24">
                    <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
                  </svg>
                ) : (
                  <svg aria-hidden="true" className="size-20" fill="none" viewBox="0 0 24 24">
                    <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </PageContainer>
      </header>

      {mounted && isMenuOpen
        ? createPortal(
          <div className="fixed inset-x-0 bottom-0 top-64 z-40 lg:hidden">
            <button
              aria-label="Tutup menu navigasi"
              className="absolute inset-0 bg-black/35 backdrop-blur-sm"
              onClick={closeMenu}
              type="button"
            />
            <div className="relative z-10 max-h-full overflow-y-auto border-b border-white/10 bg-[#14080e] py-16 shadow-xl">
              <PageContainer>
                <nav aria-label="Mobile navigation" id="mobile-navigation-panel">
                  <ul className="grid gap-4">
                    {mobileNavigation.map((item, index) => {
                      const isActive = isNavigationActive(pathname, item.href);
                      return (
                        <li key={item.href}>
                          <Link
                            aria-current={isActive ? "page" : undefined}
                            className={cx(
                              mobileLinkClasses,
                              isActive
                                ? "border-lilac-mist bg-white/10 text-paper-white font-w540"
                                : "border-transparent text-paper-white/70 hover:border-white/20 hover:bg-white/5 hover:text-paper-white",
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
                {userEmail ? (
                  <div className="mt-24 border-t border-white/10 pt-16">

                    <div className="mt-10 grid gap-8 sm:grid-cols-3">


                      <div onClick={closeMenu}>
                        <LogoutButton className="w-full" variant="inverse" />
                      </div>
                    </div>
                  </div>
                ) : null}
              </PageContainer>
            </div>
          </div>,
          document.body,
        )
        : null}
    </>
  );
}
