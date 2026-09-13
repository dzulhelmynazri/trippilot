import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "Calendar write parks on human approval instead of creating events immediately.",
  tags: ["reliability"],
  timeoutMs: 150_000,
  async test(t) {
    await t.send(
      "Persist this trip now: destination Tokyo, origin Kuala Lumpur, depart 2026-04-10, return 2026-04-13, budget 2000. Then immediately add the trip to Google Calendar with add_calendar_events.",
    );
    t.calledTool("update_trip", {
      input: { destination: /tokyo/i },
    });
    t.parked();
    t.calledTool("add_calendar_events", { status: "pending", count: 1 });
  },
});
