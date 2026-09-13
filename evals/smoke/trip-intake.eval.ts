import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

export default defineEval({
  description:
    "Trip-planning prompt persists destination and budget on the trip dossier.",
  tags: ["smoke"],
  timeoutMs: 120_000,
  async test(t) {
    await t.send(
      "Plan a 3-day trip to Tokyo in April, budget $2000. Persist the destination and budget on the trip dossier now.",
    );
    t.succeeded();
    t.calledTool("update_trip", {
      input: { destination: /tokyo/i },
    });
    t.calledTool("update_trip", {
      input: { budgetUsd: 2000 },
    }).soft();
    t.check(
      t.reply,
      includes(/tokyo|flight|hotel|date|budget|depart|travel|trip/i),
    );
  },
});
