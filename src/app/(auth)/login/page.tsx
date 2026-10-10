import { AuthPanel } from "@/components/auth/auth-panel";
import { LoginForm } from "@/components/auth/login-form";

type LoginPageProps = {
  searchParams: Promise<{ registered?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const registered = params.registered === "1";

  return (
    <AuthPanel
      active="login"
      description="Masuk untuk melanjutkan ke ruang kerja Anda."
      title="Masuk ke VENTUREX"
    >
      <LoginForm registered={registered} />
    </AuthPanel>
  );
}
