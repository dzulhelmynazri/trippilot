import dedent from "dedent";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { remainingUsd, trip } from "../lib/trip";

export default defineTool({
  description: dedent`
    Read the durable trip dossier for this conversation: destination, dates, budget, selected flight/hotel, spend, packing, day plan, and whether the plan is over budget.
    Call this before recommending options or warning about money. For a ready-to-send iMessage summary, use trip_brief instead.
  `,
  inputSchema: z.object({}),
  label: {
    start: () => "Read trip dossier",
  },
  execute() {
    const dossier = trip.get();
    return {
      ...dossier,
      remainingUsd: remainingUsd(dossier),
    };
  },
});
