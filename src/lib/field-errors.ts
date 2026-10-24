export function fieldErrorsFromIssues(
  issues: readonly { readonly path: readonly PropertyKey[]; readonly message: string }[],
): Readonly<Record<string, string>> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const field = issue.path.map(String).join(".") || "form";
    errors[field] ??= issue.message;
  }
  return errors;
}
