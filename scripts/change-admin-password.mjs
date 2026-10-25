import { emitKeypressEvents } from "node:readline";

import argon2 from "argon2";
import pg from "pg";

const ADMIN_EMAIL = "adminventurex@gmail.com";

function readHidden(prompt) {
  return new Promise((resolve, reject) => {
    let value = "";
    process.stdout.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.resume();

    const finish = (error) => {
      process.stdin.removeListener("keypress", onKeypress);
      process.stdin.removeListener("error", onError);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };

    function onKeypress(character, key) {
      if (key?.ctrl && key.name === "c") {
        finish(new Error("Dibatalkan."));
      } else if (key?.name === "return" || key?.name === "enter") {
        finish();
      } else if (key?.name === "backspace" || key?.name === "delete") {
        value = Array.from(value).slice(0, -1).join("");
      } else if (character && !key?.ctrl && !key?.meta && character !== "\t") {
        value += character;
      }
    }

    function onError(error) {
      finish(error);
    }

    process.stdin.on("keypress", onKeypress);
    process.stdin.on("error", onError);
  });
}

async function main() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Jalankan dari terminal interaktif agar password tidak terlihat.");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL belum diatur.");
  }

  emitKeypressEvents(process.stdin);
  const password = await readHidden("Password admin baru: ");
  if (password.length < 8 || password.length > 128) {
    throw new Error("Password harus terdiri dari 8–128 karakter.");
  }
  const confirmation = await readHidden("Ulangi password baru: ");
  if (password !== confirmation) {
    throw new Error("Konfirmasi password tidak cocok.");
  }

  // ASVS 6.2.8: hash the exact input; the login flow verifies Argon2id hashes.
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    // ASVS 1.2.4: bind both values rather than interpolating them into SQL.
    const result = await client.query(
      "UPDATE admins SET password_hash = $1, updated_at = now() WHERE email = $2",
      [passwordHash, ADMIN_EMAIL],
    );
    if (result.rowCount !== 1) {
      throw new Error("Akun admin tidak ditemukan; tidak ada password yang diubah.");
    }
    process.stdout.write(`Password ${ADMIN_EMAIL} berhasil diperbarui.\n`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  // ASVS 13.3: avoid printing driver errors that can include database credentials.
  const safeMessages = new Set([
    "Dibatalkan.",
    "Jalankan dari terminal interaktif agar password tidak terlihat.",
    "DATABASE_URL belum diatur.",
    "Password harus terdiri dari 8–128 karakter.",
    "Konfirmasi password tidak cocok.",
    "Akun admin tidak ditemukan; tidak ada password yang diubah.",
  ]);
  process.stderr.write(`${safeMessages.has(error?.message) ? error.message : "Gagal mengubah password admin. Periksa koneksi database dan migrasi."}\n`);
  process.exitCode = 1;
});
