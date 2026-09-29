// Read legacy capitalization variants without renaming or rewriting stored data.
export function resellerNameVariants(name: string): string[] {
  const trimmed = name.trim();
  const titleCase = trimmed.toLowerCase().split(" ").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  return [...new Set([name, trimmed, titleCase, trimmed.toUpperCase(), trimmed.toLowerCase()])];
}
