import dedent from "dedent";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { budgetForkText, budgetForks } from "../lib/fork";
import { remainingUsd, trip, withBudget } from "../lib/trip";

export default defineTool({
  description: dedent`
    When the trip dossier is over budget, return two complete recut plans computed in code:
    Plan A keeps the hotel and caps the flight at budget minus hotel;
    Plan B keeps the flight and caps the hotel at budget minus flight (or flags that the flight alone is still over).
    Call this as soon as get_trip.overBudget is true, or when the user asks for cheaper options / a recut.
    Do not invent alternate prices — send the imessage field as-is.
  `,
  inputSchema: z.object({}),
  label: {
    start: () => "Fork over-budget plans",
  },
  execute() {
    const ready = withBudget(trip.get());
    if (!ready.destination) {
      return {
        ok: false as const,
        error: "No destination on the trip dossier. Call update_trip first.",
      };
    }
    if (ready.budgetUsd === undefined) {
      return {
        ok: false as const,
        error: "No budget on the trip dossier. Call update_trip first.",
      };
    }
    if (!ready.overBudget) {
      return {
        ok: false as const,
        overBudget: false,
        budgetUsd: ready.budgetUsd,
        spentUsd: ready.spentUsd,
        remainingUsd: remainingUsd(ready),
        plans: [],
        imessage: budgetForkText(ready, []),
        error: "On budget. No recut needed.",
      };
    }

    const plans = budgetForks(ready);
    return {
      ok: true as const,
      overBudget: true,
      budgetUsd: ready.budgetUsd,
      spentUsd: ready.spentUsd,
      remainingUsd: remainingUsd(ready),
      plans,
      imessage: budgetForkText(ready, plans),
    };
  },
});
