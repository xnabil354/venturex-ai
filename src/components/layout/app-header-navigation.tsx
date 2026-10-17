"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { LogoutButton } from "@/components/auth/logout-button";
import { PageContainer } from "@/components/ui";
import {
  appNavigation,
  getNavigationLabel,
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
};

export function AppHeaderNavigation({ userEmail }: AppHeaderNavigationProps) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const firstMobileLinkRef = useRef<HTMLAnchorElement>(null);
  const currentLabel = getNavigationLabel(pathname);

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

  function closeMenu() {
    setIsMenuOpen(false);
    menuButtonRef.current?.focus();
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#14080e]/95 backdrop-blur-[16px] text-paper-white shadow-md">
      <PageContainer>
        <div className="flex min-h-64 items-center justify-between gap-16">
          <Link
            aria-label="VENTUREX home"
            className="flex items-center gap-8 font-w540 text-heading-sm tracking-tight text-paper-white transition-opacity hover:opacity-90 shrink-0"
            href="/dashboard"
          >
            <span className="h-8 w-8 rounded-full bg-lilac-mist" aria-hidden="true" />
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

          <div className="flex items-center gap-12">
            {userEmail ? (
              <details className="relative hidden lg:block">
                <summary
                  aria-current={
                    isNavigationActive(pathname, "/profile") ? "page" : undefined
                  }
                  className={cx(
                    "flex min-h-button cursor-pointer list-none items-center border-l border-white/15 pl-12 text-body-sm font-w540 transition-colors duration-150 ease-out focus-visible:rounded-small-buttons",
                    isNavigationActive(pathname, "/profile")
                      ? "text-paper-white"
                      : "text-paper-white/70 hover:text-lilac-mist",
                  )}
                >
                  Profile
                </summary>
                <div className="absolute right-0 top-full z-30 mt-8 w-72 rounded-cards border border-white/15 bg-[#14080e] p-16 text-paper-white shadow-2xl backdrop-blur-md">
                  <p className="break-words text-caption text-paper-white/70">{userEmail}</p>
                  <LogoutButton className="mt-12 w-full justify-center" />
                </div>
              </details>
            ) : null}
            <button
              aria-controls="mobile-navigation-panel"
              aria-expanded={isMenuOpen}
              aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              className="inline-flex min-h-button items-center justify-center rounded-small-buttons border border-white/20 bg-white/10 px-12 text-body-sm font-w540 text-paper-white transition-[background-color,color] duration-150 ease-out hover:bg-white/20 hover:text-lilac-mist lg:hidden"
              onClick={() => setIsMenuOpen((current) => !current)}
              ref={menuButtonRef}
              type="button"
            >
              {isMenuOpen ? "Close" : "Menu"}
            </button>
          </div>
        </div>

        <div className="flex min-h-40 items-center border-t border-white/10 lg:hidden">
          <p className="text-caption font-w540 text-paper-white/70">Halaman saat ini: <span className="text-paper-white">{currentLabel}</span></p>
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
            {userEmail ? (
              <div className="mt-12 border-t border-white/10 pt-12">
                <p className="break-words text-caption text-paper-white/70">{userEmail}</p>
                <LogoutButton className="mt-8 w-full justify-start px-12" />
              </div>
            ) : null}
          </div>
        ) : null}
      </PageContainer>
    </header>
  );
}
