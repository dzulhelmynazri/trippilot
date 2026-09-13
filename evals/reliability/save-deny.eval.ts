import { defineEval } from "eve/evals";
import { SAVE_ITINERARY_PROMPT, approvalOptionId } from "./hitl";

export default defineEval({
  description:
    "Denying save_itinerary approval rejects the write and never completes a Notion save.",
  tags: ["reliability"],
  timeoutMs: 180_000,
  async test(t) {
    const parked = await t.send(SAVE_ITINERARY_PROMPT);
    parked.calledTool("update_trip", {
      input: { destination: /tokyo/i },
    });
    parked.parked();
    parked.calledTool("save_itinerary", { status: "pending", count: 1 });

    const request = t.requireInputRequest({ toolName: "save_itinerary" });
    await t.respond([
      {
        requestId: request.requestId,
        optionId: approvalOptionId(request, "deny"),
      },
    ]);

    t.succeeded();
    t.calledTool("save_itinerary", { status: "pending", count: 0 });
    t.calledTool("save_itinerary", {
      status: "rejected",
      output: /TOOL_EXECUTION_DENIED|not_run|denied/i,
      count: 1,
    });
    t.calledTool("save_itinerary", { status: "completed", count: 0 });
  },
});
