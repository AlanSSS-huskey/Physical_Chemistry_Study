export function contentLookupOutcome(
  found: boolean,
  databaseAvailable: boolean,
  bundledMode: boolean,
): "found" | "not-found" | "unavailable" {
  if (found) return "found";
  return databaseAvailable || bundledMode ? "not-found" : "unavailable";
}
