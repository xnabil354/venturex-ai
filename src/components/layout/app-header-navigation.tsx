"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { LogoutButton } from "@/components/auth/logout-button";
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

type AppHeaderNavigationProps = {
  userEmail?: string;
  availableCredits?: number;
};

export function AppHeaderNavigation({ userEmail, availableCredits }: AppHeaderNavigationProps) {
  const pathname = usePathname();
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
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#14080e]/95 backdrop-blur-[16px] text-paper-white shadow-md">
      <PageContainer>
        <div className="flex min-h-64 items-center justify-between gap-8 sm:gap-16">
          <Link
            aria-label="VENTUREX home"
            className="flex shrink-0 items-center font-w540 text-[24px] sm:text-heading-sm tracking-tight text-paper-white transition-opacity hover:opacity-90"
            href="/dashboard"
          >
            <span>VENTUREX</span>
          </Link>

          <div className="hidden min-w-0 items-center lg:flex">
            <nav aria-label="Primary navigation">
              <ul className="flex items-center gap-12 xl:gap-20">
                {primaryNavigation.map((item) => {
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

          <div className="flex items-center gap-8 sm:gap-12">
            {userEmail && availableCredits !== undefined ? (
              <Link
                aria-label={`${availableCredits} kredit tersedia. Buka paket dan kredit`}
                className="inline-flex min-h-button items-center gap-6 rounded-pills border border-white/15 bg-white/10 px-10 text-caption font-w540 text-paper-white transition-colors hover:border-lilac-mist hover:text-lilac-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lilac-mist"
                href="/billing"
                title="Paket dan kredit"
              >
                <svg aria-hidden="true" className="size-14 shrink-0 text-lilac-mist" fill="none" viewBox="0 0 24 24">
                  <path d="M12 3.75 19.25 8v8L12 20.25 4.75 16V8L12 3.75Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
                  <path d="m4.75 8 7.25 4.25L19.25 8M12 12.25v8" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
                </svg>
                <span>{availableCredits} kredit</span>
              </Link>
            ) : null}
            {userEmail ? <NotificationBell /> : null}
            {userEmail ? (
              <div className="relative lg:ml-8 lg:border-l lg:border-white/15 lg:pl-12" ref={profileMenuRef}>
                <button
                  aria-controls={isProfileMenuOpen ? "profile-account-menu" : undefined}
                  aria-expanded={isProfileMenuOpen}
                  aria-label="Menu profil"
                  className={cx(
                    "inline-flex size-48 items-center justify-center rounded-small-buttons border border-white/20 text-paper-white transition-colors hover:border-lilac-mist hover:text-lilac-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lilac-mist",
                    isNavigationActive(pathname, "/profile") ? "bg-white/10 text-lilac-mist" : "bg-white/5",
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
              className="inline-flex size-48 items-center justify-center rounded-small-buttons border border-white/20 bg-white/10 text-paper-white transition-[background-color,color] duration-150 ease-out hover:bg-white/20 hover:text-lilac-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lilac-mist lg:hidden"
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

        {isMenuOpen ? (
          <div
            className="border-t border-white/10 pb-16 pt-8 lg:hidden"
            id="mobile-navigation-panel"
          >
            <nav aria-label="Mobile navigation">
              <ul className="grid gap-4">
                {appNavigation.map((item, index) => {
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
          </div>
        ) : null}
      </PageContainer>
    </header>
  );
}
