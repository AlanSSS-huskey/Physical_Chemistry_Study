import test from "node:test";
import assert from "node:assert/strict";
import {
  requestStateNavigation,
  BEFORE_STATE_NAVIGATION,
} from "../src/lib/navigation-guard.ts";

test("pending writing can cancel a language or sign-out action before state changes", () => {
  const target = new EventTarget();
  let changed = false;
  const preserveWriting = (event) => event.preventDefault();
  target.addEventListener(BEFORE_STATE_NAVIGATION, preserveWriting);
  if (requestStateNavigation(target)) changed = true;
  assert.equal(changed, false);
  target.removeEventListener(BEFORE_STATE_NAVIGATION, preserveWriting);
  if (requestStateNavigation(target)) changed = true;
  assert.equal(changed, true);
});

test("the navigation event is cancelable and never runs a state mutation itself", () => {
  const target = new EventTarget();
  let observed = 0;
  target.addEventListener(BEFORE_STATE_NAVIGATION, (event) => {
    assert.equal(event.cancelable, true);
    observed++;
  });
  assert.equal(requestStateNavigation(target), true);
  assert.equal(observed, 1);
});
