import test from "node:test";
import assert from "node:assert/strict";
import { contentAccessPolicy } from "../src/lib/content-access.ts";
const content = {
  isPublic: true,
  isPublished: true,
  moduleKey: null,
  previewRatio: 0.2,
};
test("public ungated content is fully accessible", () =>
  assert.equal(
    contentAccessPolicy(content, { isAdmin: false, hasEntitlement: false }),
    "full",
  ));
test("drafts are visible only to admins", () => {
  assert.equal(
    contentAccessPolicy(
      { ...content, isPublished: false },
      { isAdmin: false, hasEntitlement: true },
    ),
    "denied",
  );
  assert.equal(
    contentAccessPolicy(
      { ...content, isPublished: false },
      { isAdmin: true, hasEntitlement: false },
    ),
    "full",
  );
});
test("private lessons never receive public previews", () => {
  assert.equal(
    contentAccessPolicy(
      { ...content, isPublic: false, moduleKey: "thermo-pack" },
      { isAdmin: false, hasEntitlement: false },
    ),
    "denied",
  );
  assert.equal(
    contentAccessPolicy(
      { ...content, isPublic: false },
      { isAdmin: false, hasEntitlement: false },
    ),
    "denied",
  );
  assert.equal(
    contentAccessPolicy(
      { ...content, isPublic: false, moduleKey: "thermo-pack" },
      { isAdmin: false, hasEntitlement: true },
    ),
    "full",
  );
});
test("public module lesson requires entitlement or bounded preview", () => {
  assert.equal(
    contentAccessPolicy(
      { ...content, moduleKey: "thermo-pack" },
      { isAdmin: false, hasEntitlement: false },
    ),
    "preview",
  );
  assert.equal(
    contentAccessPolicy(
      { ...content, moduleKey: "thermo-pack", previewRatio: 0 },
      { isAdmin: false, hasEntitlement: false },
    ),
    "denied",
  );
  assert.equal(
    contentAccessPolicy(
      { ...content, moduleKey: "thermo-pack" },
      { isAdmin: false, hasEntitlement: true },
    ),
    "full",
  );
});
