import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

export default defineEval({
  description:
    "Trip brief is code-backed: remaining budget, Tokyo stops with Maps links, and packing.",
  tags: ["usefulness"],
  timeoutMs: 150_000,
  async test(t) {
    await t.send(
      "Persist this trip now: destination Tokyo, origin Kuala Lumpur, depart 2026-04-10, return 2026-04-13, budget 2000. I picked flight JL71 priced at $800 departing 2026-04-10T22:15:00 and hotel Park Hyatt priced at $600. Then call trip_brief and send me that brief with packing, the day plan, weather, and the Maps links.",
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
    t.check(
      t.reply,
      includes(/shibuya|senso-ji|meiji|tsukiji|skytree/i),
    );
    t.check(t.reply, includes(/google\.com\/maps/i));
    t.check(t.reply, includes(/22:15/)).soft();
    t.check(t.reply, includes(/°C|wet|dry|typical|umbrella/i)).soft();
  },
});
