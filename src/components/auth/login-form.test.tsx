// @vitest-environment jsdom

import { act } from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const { replaceMock, signInMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  signInMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock("next-auth/react", () => ({
  signIn: signInMock,
}));

import { signIn, type SignInResponse } from "next-auth/react";

import { LoginForm } from "./login-form";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  writable: true,
  value: true,
});

const signInResponse = {
  code: undefined,
  error: undefined,
  ok: true,
  status: 200,
  url: null,
};

describe("LoginForm hydration security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(signIn).mockResolvedValue(signInResponse);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a disabled POST form before hydration", () => {
    const html = renderToString(<LoginForm />);
    const container = document.createElement("div");
    container.innerHTML = html;

    const form = container.querySelector("form");
    const email = container.querySelector<HTMLInputElement>('[name="email"]');
    const password = container.querySelector<HTMLInputElement>('[name="password"]');
    const submit = container.querySelector<HTMLButtonElement>('button[type="submit"]');

    expect(form?.getAttribute("method")).toBe("post");
    expect(email?.disabled).toBe(true);
    expect(password?.disabled).toBe(true);
    expect(submit?.disabled).toBe(true);
    expect(container.textContent).toContain("Menyiapkan formulir masuk…");
    expect(signIn).not.toHaveBeenCalled();
  });

  it("enables controls after hydration without a markup mismatch", async () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<LoginForm />);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let root: Root | undefined;

    try {
      await act(async () => {
        root = hydrateRoot(container, <LoginForm />);
      });

      await waitFor(() => {
        expect(container.querySelector<HTMLInputElement>('[name="email"]')?.disabled).toBe(false);
        expect(container.querySelector<HTMLInputElement>('[name="password"]')?.disabled).toBe(false);
        expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
      });

      expect(container.textContent).not.toContain("Menyiapkan formulir masuk…");
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      if (root) {
        await act(async () => root?.unmount());
      }
      consoleError.mockRestore();
    }
  });

  it("keeps fields disabled until the mounted state is ready, then signs in through NextAuth", async () => {
    render(<LoginForm />);

    const email = screen.getByRole("textbox", { name: "Email" });
    const password = screen.getByLabelText("Password");
    const submit = screen.getByRole("button", { name: "Masuk" });

    expect(email).toHaveProperty("disabled", false);
    expect(password).toHaveProperty("disabled", false);
    expect(submit).toHaveProperty("disabled", false);

    fireEvent.change(email, { target: { value: "synthetic@example.test" } });
    fireEvent.change(password, { target: { value: "synthetic-test-password" } });
    fireEvent.submit(submit.closest("form")!);

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/dashboard"));
    expect(signIn).toHaveBeenCalledWith("credentials", {
      email: "synthetic@example.test",
      password: "synthetic-test-password",
      redirect: false,
    });
    expect(window.location.search).toBe("");
  });

  it("preserves the generic invalid-credentials message", async () => {
    vi.mocked(signIn).mockResolvedValue({
      ...signInResponse,
      error: "CredentialsSignin",
      ok: false,
      status: 401,
    });

    render(<LoginForm />);
    const email = screen.getByRole("textbox", { name: "Email" });
    const password = screen.getByLabelText("Password");
    await waitFor(() => expect(email).toHaveProperty("disabled", false));

    fireEvent.change(email, { target: { value: "synthetic@example.test" } });
    fireEvent.change(password, { target: { value: "synthetic-test-password" } });
    fireEvent.submit(screen.getByRole("button", { name: "Masuk" }).closest("form")!);

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Email atau password tidak sesuai.",
    );
    expect(window.location.search).toBe("");
  });

  it("disables repeated submission while NextAuth sign-in is pending", async () => {
    let resolveSignIn: ((value: SignInResponse) => void) | undefined;
    vi.mocked(signIn).mockImplementation(
      () => new Promise<SignInResponse>((resolve) => { resolveSignIn = resolve; }),
    );

    render(<LoginForm />);
    const email = screen.getByRole("textbox", { name: "Email" });
    const password = screen.getByLabelText("Password");
    await waitFor(() => expect(email).toHaveProperty("disabled", false));

    fireEvent.change(email, { target: { value: "synthetic@example.test" } });
    fireEvent.change(password, { target: { value: "synthetic-test-password" } });
    const form = screen.getByRole("button", { name: "Masuk" }).closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => expect(screen.getByRole("button", { name: "Loading" })).toHaveProperty("disabled", true));
    fireEvent.submit(form);
    expect(signIn).toHaveBeenCalledTimes(1);

    await act(async () => resolveSignIn?.(signInResponse));
    await waitFor(() => expect(screen.getByRole("button", { name: "Masuk" })).toHaveProperty("disabled", false));
  });

  it("retains client validation after hydration", async () => {
    render(<LoginForm />);
    const email = screen.getByRole("textbox", { name: "Email" });
    await waitFor(() => expect(email).toHaveProperty("disabled", false));

    fireEvent.submit(screen.getByRole("button", { name: "Masuk" }).closest("form")!);

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Periksa kembali data yang diisi.",
    );
    expect(signIn).not.toHaveBeenCalled();
  });
});
