export class BusinessProfileForbiddenError extends Error {
  override readonly name = "BusinessProfileForbiddenError";

  constructor() {
    super("Business profile hanya tersedia untuk UMKM existing.");
  }
}

export class BusinessProfileStateError extends Error {
  override readonly name = "BusinessProfileStateError";

  constructor() {
    super("Status profile bisnis tidak valid.");
  }
}

export class BusinessProfileNotFoundError extends Error {
  override readonly name = "BusinessProfileNotFoundError";

  constructor() {
    super("Business profile tidak ditemukan.");
  }
}

export class InvalidBusinessReferenceDataError extends Error {
  override readonly name = "InvalidBusinessReferenceDataError";

  constructor() {
    super("Reference data bisnis tidak valid atau tidak aktif.");
  }
}
