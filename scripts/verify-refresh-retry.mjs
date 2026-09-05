import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveRefreshAfterLoad,
} from "../plugins/com.xsec.attack-path/com.xsec.desktop/frontend/index.js";

const MAX = 3;
const BASE = 750;

test("idle refresh failure schedules first bounded retry and keeps dirty intent", () => {
  const plan = resolveRefreshAfterLoad({
    succeeded: false,
    refreshQueued: false,
    refreshDirty: true,
    refreshRetryAttempt: 0,
    maxRetries: MAX,
    retryBaseMs: BASE,
  });
  assert.equal(plan.action, "schedule-retry");
  assert.equal(plan.refreshDirty, true);
  assert.equal(plan.refreshQueued, false);
  assert.equal(plan.refreshRetryAttempt, 1);
  assert.equal(plan.delay, BASE);
});

test("consecutive retry failures without new resource updates keep scheduling until cap", () => {
  let state = {
    refreshQueued: false,
    refreshDirty: true,
    refreshRetryAttempt: 0,
  };

  for (let expectedAttempt = 1; expectedAttempt <= MAX; expectedAttempt += 1) {
    const plan = resolveRefreshAfterLoad({
      succeeded: false,
      ...state,
      maxRetries: MAX,
      retryBaseMs: BASE,
    });
    assert.equal(plan.action, "schedule-retry");
    assert.equal(plan.refreshDirty, true);
    assert.equal(plan.refreshRetryAttempt, expectedAttempt);
    assert.equal(plan.delay, BASE * (2 ** (expectedAttempt - 1)));
    state = {
      refreshQueued: plan.refreshQueued,
      refreshDirty: plan.refreshDirty,
      refreshRetryAttempt: plan.refreshRetryAttempt,
    };
  }

  const giveUp = resolveRefreshAfterLoad({
    succeeded: false,
    ...state,
    maxRetries: MAX,
    retryBaseMs: BASE,
  });
  assert.equal(giveUp.action, "give-up");
  assert.equal(giveUp.refreshDirty, false);
  assert.equal(giveUp.refreshRetryAttempt, 0);
});

test("mid-flight queued failure schedules retry instead of dropping dirty intent", () => {
  const plan = resolveRefreshAfterLoad({
    succeeded: false,
    refreshQueued: true,
    refreshDirty: false,
    refreshRetryAttempt: 0,
    maxRetries: MAX,
    retryBaseMs: BASE,
  });
  assert.equal(plan.action, "schedule-retry");
  assert.equal(plan.refreshDirty, true);
  assert.equal(plan.refreshQueued, false);
});

test("success clears dirty intent; queued success reloads with dirty retained", () => {
  const idle = resolveRefreshAfterLoad({
    succeeded: true,
    refreshQueued: false,
    refreshDirty: true,
    refreshRetryAttempt: 2,
  });
  assert.equal(idle.action, "idle");
  assert.equal(idle.refreshDirty, false);
  assert.equal(idle.refreshRetryAttempt, 0);

  const reload = resolveRefreshAfterLoad({
    succeeded: true,
    refreshQueued: true,
    refreshDirty: true,
    refreshRetryAttempt: 2,
  });
  assert.equal(reload.action, "reload");
  assert.equal(reload.refreshDirty, true);
  assert.equal(reload.refreshRetryAttempt, 0);
});
