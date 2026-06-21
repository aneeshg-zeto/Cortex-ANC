/** Pick project scope for RAG — requested IDs must be a subset of what the user may access. */
export function resolveEffectiveProjectIds(
  allowedProjectIds: string[],
  requested?: string[] | null,
): string[] {
  if (!requested?.length) return allowedProjectIds;
  const allowed = new Set(allowedProjectIds);
  const filtered = requested.filter((id) => allowed.has(id));
  return filtered.length ? filtered : allowedProjectIds;
}
