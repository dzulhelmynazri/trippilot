import { defineEval } from "eve/evals";

export default defineEval({
  description: "TripPilot responds to a greeting without crashing.",
  tags: ["smoke"],
  timeoutMs: 90_000,
  async test(t) {
    await t.send("Hi TripPilot!");
    t.succeeded();
    t.messageIncludes(/trip|travel|help|assist|plan/i);
  },
});
