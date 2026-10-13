import Link from "next/link";
import { useId } from "react";
import type { ReactNode } from "react";

import { ShieldCheckIcon } from "./auth-icons";

export type AuthMode = "login" | "register";

type AuthPanelProps = {
    active: AuthMode;
    children: ReactNode;
    description: string;
    title: string;
};

export function AuthPanel({ active, children, description, title }: AuthPanelProps) {
    const titleId = useId();

    return (
        <section
            aria-labelledby={titleId}
            className="rounded-cards border border-soft-mist bg-paper-white p-28 sm:p-40 shadow-[0_4px_24px_rgba(41,40,39,0.04)]"
        >
            <header className="text-center">
                <h1 className="text-[28px] sm:text-[32px] font-w460 leading-tight tracking-tight text-ink-charcoal" id={titleId}>
                    {title}
                </h1>
                <p className="mx-auto mt-8 max-w-[42ch] text-body-sm leading-relaxed text-stone-gray">{description}</p>
            </header>

            <div className="mt-28">{children}</div>

            <nav aria-label="Authentication navigation" className="mt-28 border-t border-soft-mist pt-20">
                <div className="flex flex-col items-center justify-center gap-8 text-center text-body-sm">
                    <p className="text-stone-gray">
                        {active === "login" ? "Belum punya akun?" : "Sudah punya akun?"}{" "}
                        {active === "login" ? (
                            <Link
                                className="font-w540 text-royal-violet hover:text-midnight-wine hover:underline transition-colors inline-flex items-center gap-4"
                                href="/register"
                            >
                                <span>Buat akun</span>
                                <span aria-hidden="true">&rarr;</span>
                            </Link>
                        ) : (
                            <Link
                                className="font-w540 text-royal-violet hover:text-midnight-wine hover:underline transition-colors inline-flex items-center gap-4"
                                href="/login"
                            >
                                <span>Masuk ke akun</span>
                                <span aria-hidden="true">&rarr;</span>
                            </Link>
                        )}
                    </p>
                </div>
            </nav>
        </section>
    );
}
