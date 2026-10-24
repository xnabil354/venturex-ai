"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { USER_TYPES, type UserType } from "@/auth/user-types";
import { Button } from "@/components/ui";

function targetFor(userType: UserType): { readonly label: string; readonly href: string } {
  return userType === USER_TYPES.ENTREPRENEUR
    ? { label: "UMKM existing", href: "/onboarding/business" }
    : { label: "entrepreneur", href: "/onboarding/entrepreneur" };
}

export function UserTypeSwitcher({ currentUserType }: { readonly currentUserType: UserType }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const target = targetFor(currentUserType);

  function openDialog(): void {
    setErrorMessage(null);
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function closeDialog(): void {
    if (dialogRef.current?.open) dialogRef.current.close();
  }

  async function switchType(): Promise<void> {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/v1/me/user-type/switch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userType: currentUserType === USER_TYPES.ENTREPRENEUR ? USER_TYPES.UMKM_EXISTING : USER_TYPES.ENTREPRENEUR,
        }),
      });
      const body = (await response.json()) as { readonly error?: { readonly message?: string } };
      if (!response.ok) {
        setErrorMessage(body.error?.message ?? "Persona belum dapat diganti. Coba lagi.");
        return;
      }
      closeDialog();
      router.push(target.href);
      router.refresh();
    } catch {
      setErrorMessage("Koneksi bermasalah. Coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Button
        aria-haspopup="dialog"
        className="mt-12 w-full sm:w-auto"
        onClick={openDialog}
        variant="secondary"
      >
        Pindah ke {target.label}
      </Button>
      <dialog
        aria-labelledby="user-type-switch-title"
        className="fixed left-1/2 top-1/2 m-0 max-h-[calc(100dvh-2rem)] w-[min(34rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-cards border border-soft-mist bg-paper-white p-0 text-ink-charcoal shadow-xl backdrop:bg-midnight-wine/60"
        ref={dialogRef}
        role="alertdialog"
        onCancel={() => setErrorMessage(null)}
      >
        <div className="p-20 sm:p-28">
          <p className="text-caption font-w540 uppercase tracking-[0.12em] text-royal-violet">Ganti persona</p>
          <h2 className="mt-8 text-heading-sm font-w460" id="user-type-switch-title">Pindah ke {target.label}?</h2>
          <p className="mt-12 text-body-sm leading-relaxed text-stone-gray">
            Profil {target.label} yang pernah Anda simpan akan dipakai sebagai draf untuk ditinjau. Histori persona ini tetap terpisah dari workspace yang sedang aktif.
          </p>
          {errorMessage ? (
            <p aria-live="polite" className="mt-12 rounded-small-buttons border border-red-300 bg-red-50 px-12 py-10 text-body-sm text-red-800">
              {errorMessage}
            </p>
          ) : null}
          <div className="mt-20 flex flex-col-reverse gap-10 sm:flex-row sm:justify-end">
            <Button disabled={isSubmitting} onClick={closeDialog} variant="ghost">Batal</Button>
            <Button loading={isSubmitting} loadingText="Memindahkan…" onClick={() => void switchType()}>
              Ya, pindah persona
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
