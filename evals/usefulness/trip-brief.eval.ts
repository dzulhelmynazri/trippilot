import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

export default defineEval({
  description:
    "Trip brief is code-backed: remaining budget, April Tokyo packing, and a day skeleton.",
  tags: ["usefulness"],
  timeoutMs: 150_000,
  async test(t) {
    await t.send(
      "Persist this trip now: destination Tokyo, origin Kuala Lumpur, depart 2026-04-10, return 2026-04-13, budget 2000. I picked flight JL71 priced at $800 and hotel Park Hyatt priced at $600. Then call trip_brief and send me that brief with packing and the day plan.",
    );
    t.succeeded();
    t.calledTool("update_trip", {
      input: { destination: /tokyo/i },
    });
    t.calledTool("trip_brief");
    t.check(t.reply, includes(/tokyo/i));
    t.check(t.reply, includes(/\$600|600 left|600 remaining/i));
    t.check(
      t.reply,
      includes(/passport|walking shoes|suica|light layers/i),
    );
    t.check(t.reply, includes(/2026-04-10|arrive/i));
  },
});
