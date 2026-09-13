import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

export default defineEval({
  description:
    "Over-budget flight selection is persisted and the reply warns in code-backed terms.",
  tags: ["reliability"],
  timeoutMs: 120_000,
  async test(t) {
    await t.send(
      "Persist this trip now: destination Tokyo, budget $400. I picked a flight named JL71 priced at $1800. Then tell me if I am over budget.",
    );
    t.succeeded();
    t.calledTool("update_trip", {
      input: { destination: /tokyo/i },
    });
    t.calledTool("update_trip", {
      input: { budgetUsd: 400 },
    });
    t.calledTool("update_trip", {
      input: { flight: { priceUsd: 1800 } },
    });
    t.check(
      t.reply,
      includes(/over.?budget|exceed|over the budget|too expensive|overspent/i),
    );
  },
});
