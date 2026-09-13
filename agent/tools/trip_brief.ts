import dedent from "dedent";
import { defineTool } from "eve/tools";
import { z } from "zod";
import {
  nextActions,
  remainingUsd,
  trip,
  tripBriefText,
  tripNights,
  withTripExtras,
} from "../lib/trip";

export default defineTool({
  description: dedent`
    Build a code-backed trip brief from the durable dossier: nights, remaining budget, day skeleton, packing list, and next actions.
    Call this after the user picks a flight or hotel, or when they ask for a summary, packing list, or day plan.
    Do not invent packing or remaining cash — use this tool's output.
  `,
  inputSchema: z.object({}),
  label: {
    start: () => "Build trip brief",
  },
  execute() {
    const ready = withTripExtras(trip.get());
    trip.update(() => ready);

    if (!ready.destination) {
      return {
        ok: false as const,
        error: "No destination on the trip dossier. Call update_trip first.",
      };
    }

    return {
      ok: true as const,
      destination: ready.destination,
      nights: tripNights(ready),
      remainingUsd: remainingUsd(ready),
      overBudget: ready.overBudget,
      packing: ready.packing,
      days: ready.days,
      nextActions: nextActions(ready),
      imessage: tripBriefText(ready),
    };
  },
});
