export function parsePrivateListPage(value: string | readonly string[] | undefined): number {
  if (typeof value !== "string" || !/^[1-9]\d{0,5}$/u.test(value)) return 1;
  const page = Number(value);
  return page <= 100000 ? page : 1;
}
