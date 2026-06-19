import assert from "node:assert/strict";
import test from "node:test";

import { getRefreshAllToastMessage } from "../../src/ui/refresh.js";

test("refresh-all toast helper returns the correct message for each outcome", () => {
  assert.equal(getRefreshAllToastMessage(9, 0), "All generators refreshed.");
  assert.equal(getRefreshAllToastMessage(9, 9), "Refresh failed for every generator.");
  assert.equal(getRefreshAllToastMessage(9, 2), "Refreshed 7/9 generators.");
});
