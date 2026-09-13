import { defineEval } from "eve/evals";
import {
  SAVE_ITINERARY_PROMPT,
  approvalOptionId,
  tapbackDecision,
} from "../reliability/hitl";

export default defineEval({
  description:
    "A 👎 tapback maps to deny and rejects the parked save_itinerary write.",
  tags: ["originality"],
  timeoutMs: 180_000,
  async test(t) {
    const parked = await t.send(SAVE_ITINERARY_PROMPT);
    parked.calledTool("update_trip", {
      input: { destination: /tokyo/i },
    });
    parked.parked();
    parked.calledTool("save_itinerary", { status: "pending", count: 1 });

    const request = t.requireInputRequest({ toolName: "save_itinerary" });
    const decision = tapbackDecision("👎");
    if (decision !== "deny") {
      throw new Error("tapbackDecision(👎) must resolve to deny");
    }
    await t.respond([
      {
        requestId: request.requestId,
        optionId: approvalOptionId(request, decision),
      },
    ]);

    t.calledTool("save_itinerary", { status: "pending", count: 0 });
    t.calledTool("save_itinerary", {
      status: "rejected",
      output: /TOOL_EXECUTION_DENIED|not_run|denied/i,
      count: 1,
    });
    t.calledTool("save_itinerary", { status: "completed", count: 0 });
  },
});
