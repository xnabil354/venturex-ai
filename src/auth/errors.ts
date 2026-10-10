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

export class CurrentUserNotFoundError extends Error {
  override readonly name = "CurrentUserNotFoundError";

  constructor() {
    super("Current user tidak ditemukan.");
  }
}
