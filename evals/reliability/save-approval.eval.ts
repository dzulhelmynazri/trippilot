import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "Notion save parks on human approval instead of writing immediately.",
  tags: ["reliability"],
  timeoutMs: 150_000,
  async test(t) {
    await t.send(
      "Persist this trip now: destination Tokyo, origin Kuala Lumpur, depart 2026-04-10, return 2026-04-13, budget 2000. Then immediately save the itinerary to Notion with save_itinerary.",
    );
    t.calledTool("update_trip", {
      input: { destination: /tokyo/i },
    });
    t.parked();
    t.calledTool("save_itinerary", { status: "pending", count: 1 });
  },
});
