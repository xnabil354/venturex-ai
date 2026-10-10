export class EntrepreneurProfileForbiddenError extends Error {
  override readonly name = "EntrepreneurProfileForbiddenError";

  constructor() {
    super("Entrepreneur profile hanya tersedia untuk entrepreneur.");
  }
}

export class InvalidReferenceDataError extends Error {
  override readonly name = "InvalidReferenceDataError";

  constructor() {
    super("Reference data tidak valid atau tidak aktif.");
  }
}

export class EntrepreneurProfileStateError extends Error {
  override readonly name = "EntrepreneurProfileStateError";

  constructor() {
    super("Status profile entrepreneur tidak valid.");
  }
}

export class EntrepreneurProfileNotFoundError extends Error {
  override readonly name = "EntrepreneurProfileNotFoundError";

  constructor() {
    super("Entrepreneur profile tidak ditemukan.");
  }
}
