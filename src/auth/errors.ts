export class EmailAlreadyExistsError extends Error {
  override readonly name = "EmailAlreadyExistsError";

  constructor() {
    super("Email sudah digunakan.");
  }
}

export class UserTypeAlreadySelectedError extends Error {
  override readonly name = "UserTypeAlreadySelectedError";

  constructor() {
    super("User type sudah dipilih.");
  }
}

export class UserTypeSwitchNotAllowedError extends Error {
  override readonly name = "UserTypeSwitchNotAllowedError";

  constructor() {
    super("User type hanya dapat diganti setelah onboarding selesai.");
  }
}

export class UserTypeAlreadyActiveError extends Error {
  override readonly name = "UserTypeAlreadyActiveError";

  constructor() {
    super("User type tersebut sudah aktif.");
  }
}

export class CurrentUserNotFoundError extends Error {
  override readonly name = "CurrentUserNotFoundError";

  constructor() {
    super("Current user tidak ditemukan.");
  }
}
