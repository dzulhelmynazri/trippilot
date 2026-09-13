import { defineEval } from "eve/evals";
import { SAVE_ITINERARY_PROMPT, approvalOptionId } from "./hitl";

export default defineEval({
  description:
    "Approving save_itinerary releases the HITL gate so the tool can execute.",
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
        optionId: approvalOptionId(request, "approve"),
      },
    ]);

    t.calledTool("save_itinerary", { status: "rejected", count: 0 });
    t.eventsSatisfy(
      "save_itinerary produced an action result after approve",
      (events) =>
        events.some((event) => {
          if (event.type !== "action.result") return false;
          const result = event.data.result;
          return (
            result.kind === "tool-result" && result.toolName === "save_itinerary"
          );
        }),
    );
  },
});
