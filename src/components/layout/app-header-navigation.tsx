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
    <header className="sticky top-0 z-20 border-b border-soft-mist bg-warm-parchment/95 backdrop-blur-[12px]">
      <PageContainer>
        <div className="flex min-h-64 items-center justify-between gap-16">
          <Link
            aria-label="VENTUREX home"
            className="shrink-0 text-body font-w540 tracking-[0.02em] text-ink-charcoal transition-colors hover:text-royal-violet"
            href="/dashboard"
          >
            VENTUREX
          </Link>

          <div className="hidden min-w-0 items-center gap-24 lg:flex">
            <p className="shrink-0 text-caption text-stone-gray">
              Current: <span className="font-w540 text-ink-charcoal">{currentLabel}</span>
            </p>
            <nav aria-label="Primary navigation">
              <ul className="flex items-center gap-8">
                {primaryNavigation.map((item) => {
                  const isActive = isNavigationActive(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        aria-current={isActive ? "page" : undefined}
                        className={cx(
                          desktopLinkClasses,
                          isActive
                            ? "border-midnight-wine text-ink-charcoal"
                            : "border-transparent text-stone-gray hover:border-soft-mist hover:text-ink-charcoal",
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
                    "flex min-h-button cursor-pointer list-none items-center border-l border-soft-mist pl-12 text-body-sm font-w540 transition-colors duration-150 ease-out focus-visible:rounded-small-buttons",
                    isNavigationActive(pathname, "/profile")
                      ? "text-ink-charcoal"
                      : "text-stone-gray hover:text-royal-violet",
                  )}
                >
                  Profile
                </summary>
                <div className="absolute right-0 top-full z-30 mt-8 w-64 border border-soft-mist bg-paper-white p-12">
                  <p className="break-words text-body-sm text-stone-gray">{userEmail}</p>
                  <LogoutButton className="mt-12 w-full" />
                </div>
              </details>
            ) : null}
            <button
              aria-controls="mobile-navigation-panel"
              aria-expanded={isMenuOpen}
              aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              className="inline-flex min-h-button items-center justify-center rounded-small-buttons border border-ink-charcoal px-12 text-body-sm font-w540 text-ink-charcoal transition-[background-color,color] duration-150 ease-out hover:bg-paper-white hover:text-royal-violet lg:hidden"
              onClick={() => setIsMenuOpen((current) => !current)}
              ref={menuButtonRef}
              type="button"
            >
              {isMenuOpen ? "Close" : "Menu"}
            </button>
          </div>
        </div>

        <div className="flex min-h-48 items-center border-t border-soft-mist lg:hidden">
          <p className="text-body-sm font-w540 text-ink-charcoal">{currentLabel}</p>
        </div>

        {isMenuOpen ? (
          <div
            className="border-t border-soft-mist pb-16 pt-8 lg:hidden"
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
                            ? "border-midnight-wine bg-paper-white text-ink-charcoal"
                            : "border-transparent text-stone-gray hover:border-soft-mist hover:bg-paper-white hover:text-ink-charcoal",
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
              <div className="mt-12 border-t border-soft-mist pt-12">
                <p className="break-words text-body-sm text-stone-gray">{userEmail}</p>
                <LogoutButton className="mt-8 w-full justify-start px-12" />
              </div>
            ) : null}
          </div>
        ) : null}
      </PageContainer>
    </header>
  );
}
