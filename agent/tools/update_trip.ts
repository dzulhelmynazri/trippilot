import dedent from "dedent";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { remainingUsd, trip, withBudget, type TripPick } from "../lib/trip";

const pickSchema = z.object({
  name: z.string().min(1),
  priceUsd: z.number().nonnegative().optional(),
  bookingUrl: z.string().min(1).optional(),
  notes: z.string().optional(),
});

export default defineTool({
  description: dedent`
    Persist facts on the durable trip dossier.
    Call this as soon as the user gives a destination, dates, budget, traveler count, or picks a flight/hotel.
    Spend and over-budget are computed in code from the selected prices.
  `,
  inputSchema: z.object({
    destination: z.string().min(1).optional(),
    origin: z.string().min(1).optional(),
    departDate: z.string().min(1).optional(),
    returnDate: z.string().min(1).optional(),
    budgetUsd: z.number().nonnegative().optional(),
    travelers: z.number().int().positive().optional(),
    preferences: z.string().optional(),
    flight: pickSchema.optional(),
    hotel: pickSchema.optional(),
  }),
  label: {
    start: ({ destination }) =>
      destination ? `Update trip: ${destination}` : "Update trip dossier",
  },
  execute(input) {
    trip.update((current) =>
      withBudget({
        ...current,
        ...omitUndefined({
          destination: input.destination,
          origin: input.origin,
          departDate: input.departDate,
          returnDate: input.returnDate,
          budgetUsd: input.budgetUsd,
          travelers: input.travelers,
          preferences: input.preferences,
          flight: input.flight as TripPick | undefined,
          hotel: input.hotel as TripPick | undefined,
        }),
      }),
    );
    const dossier = trip.get();

    return {
      ...dossier,
      remainingUsd: remainingUsd(dossier),
    };
  },
});

function omitUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as Partial<T>;
}
