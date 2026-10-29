export function reconcileStudySave<T extends { revision: number }>(
  local: T,
  saved: T,
  changedWhileSaving: boolean,
) {
  return changedWhileSaving
    ? {
        value: { ...local, revision: saved.revision },
        phase: "pending" as const,
      }
    : { value: saved, phase: "synced" as const };
}
export function resolveStudyConflict<T extends { revision: number }>(
  local: T,
  remote: T,
  choice: "keep-local" | "use-cloud",
) {
  return choice === "keep-local"
    ? {
        value: { ...local, revision: remote.revision },
        phase: "pending" as const,
      }
    : { value: remote, phase: "synced" as const };
}
