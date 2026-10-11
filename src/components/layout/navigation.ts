export const appNavigation = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/trends", label: "Trend Radar" },
  { href: "/opportunities", label: "Opportunity Finder" },
  { href: "/saved", label: "Saved Opportunities" },
] as const;

export const primaryNavigation = appNavigation;

export function isNavigationActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getNavigationLabel(pathname: string) {
  return (
    appNavigation.find((item) => isNavigationActive(pathname, item.href))?.label ??
    "Application"
  );
}
