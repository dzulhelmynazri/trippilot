import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

export default defineEval({
  description: "TripPilot engages with a trip-planning request.",
  tags: ["smoke"],
  timeoutMs: 120_000,
  async test(t) {
    await t.send("Plan a 3-day trip to Tokyo in April, budget $2000.");
    t.succeeded();
    t.check(
      t.reply,
      includes(/tokyo|flight|hotel|date|budget|depart|travel|trip/i),
    );
  },
});
