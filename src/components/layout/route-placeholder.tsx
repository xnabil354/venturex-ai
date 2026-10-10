import { AppPage } from "@/components/layout/app-page";

export type RoutePlaceholderProps = {
  message: string;
  title: string;
};

export function RoutePlaceholder({ message, title }: RoutePlaceholderProps) {
  return (
    <AppPage title={title}>
      <p className="max-w-[52ch] text-body leading-body text-stone-gray">{message}</p>
    </AppPage>
  );
}
