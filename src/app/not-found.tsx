import { AppShell } from "@/components/layout/app-shell";
import { ShellNotFoundState } from "@/components/layout/shell-states";

export default function NotFound() {
  return (
    <AppShell>
      <ShellNotFoundState />
    </AppShell>
  );
}
