import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

export default defineEval({
  description:
    "Over-budget Tokyo trip returns two code-backed recut plans from budget_fork.",
  tags: ["originality"],
  timeoutMs: 150_000,
  async test(t) {
    await t.send(
      "Persist this trip now: destination Tokyo, budget $400. I picked a flight named JL71 priced at $1800. I am over budget. Call budget_fork and send me both recut plans, including the $400 targets.",
    );
    t.succeeded();
    t.calledTool("update_trip", {
      input: { destination: /tokyo/i },
    });
    t.calledTool("update_trip", {
      input: { flight: { priceUsd: 1800 } },
    });
    t.calledTool("budget_fork");
    t.check(t.reply, includes(/over.?budget|recut|plan a|plan b/i));
    t.check(t.reply, includes(/keep the hotel|recut the flight/i));
    t.check(t.reply, includes(/keep the flight|recut the hotel/i));
    t.check(t.reply, includes(/\$400|400/));
  },
});
