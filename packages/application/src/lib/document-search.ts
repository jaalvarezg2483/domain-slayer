export { tokenizeSearchQuery } from "@domain-slayer/shared";

import { buildLibrarySearchSnippet } from "@domain-slayer/shared";

/** @deprecated Preferir buildLibrarySearchSnippet desde shared (acentos + comas). */
export function buildSearchSnippet(
  haystack: { title: string; description: string | null; searchText: string | null },
  tokens: string[]
): string | null {
  return buildLibrarySearchSnippet(haystack, tokens);
}
