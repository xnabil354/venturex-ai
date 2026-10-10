export function cx(
  ...classes: readonly (string | false | null | undefined)[]
): string {
  return classes.filter((value): value is string => Boolean(value)).join(" ");
}
