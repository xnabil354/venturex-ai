import { AuthPanel } from "@/components/auth/auth-panel";
import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <AuthPanel
      active="register"
      description="Buat akun untuk memulai. Detail usaha disiapkan pada tahap berikutnya."
      title="Buat akun VENTUREX"
    >
      <RegisterForm />
    </AuthPanel>
  );
}
