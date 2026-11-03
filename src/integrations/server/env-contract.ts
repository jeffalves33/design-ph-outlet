import "server-only";

/** Validate names at the server boundary without logging or returning values. */
export function missingServerEnvNames(
  source: Readonly<Record<string, string | undefined>>,
  names: readonly string[],
): string[] {
  for (const name of names) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(name) || name.startsWith("NEXT_PUBLIC_")) {
      throw new Error("Invalid server environment variable name");
    }
  }

  return names.filter((name) => !source[name]?.trim());
}
