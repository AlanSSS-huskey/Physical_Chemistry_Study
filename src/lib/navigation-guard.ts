export const BEFORE_STATE_NAVIGATION = "chemistry:before-navigation";

/** Buttons that replace the current page must give pending writing a veto. */
export function requestStateNavigation(target: EventTarget): boolean {
  return target.dispatchEvent(
    new Event(BEFORE_STATE_NAVIGATION, { cancelable: true }),
  );
}
