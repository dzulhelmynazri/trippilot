import dedent from "dedent";
import { defineTool } from "eve/tools";
import { z } from "zod";
import {
  remainingUsd,
  trip,
  withBudget,
  type TripDay,
  type TripPick,
} from "../lib/trip";

const pickSchema = z.object({
  name: z.string().min(1),
  priceUsd: z.number().nonnegative().optional(),
  bookingUrl: z.string().min(1).optional(),
  notes: z.string().optional(),
  departAt: z
    .string()
    .min(1)
    .optional()
    .describe("Outbound local datetime, e.g. 2026-04-10T22:15:00"),
  returnAt: z
    .string()
    .min(1)
    .optional()
    .describe("Return local datetime, e.g. 2026-04-13T18:40:00"),
});

const daySchema = z.object({
  date: z.string().min(1).describe("YYYY-MM-DD"),
  title: z.string().min(1),
  items: z
    .array(
      z.object({
        name: z.string().min(1),
        mapsQuery: z.string().min(1).optional(),
        notes: z.string().optional(),
      }),
    )
    .default([]),
});

export default defineTool({
  description: dedent`
    Persist facts on the durable trip dossier.
    Call this as soon as the user gives a destination, dates, budget, traveler count, picks a flight/hotel, or names day-plan stops.
    Spend and over-budget are computed in code from the selected prices.
    Packing and the day skeleton are filled by trip_brief if you leave them empty.
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
    packing: z.array(z.string().min(1)).optional(),
    days: z.array(daySchema).optional(),
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
          packing: input.packing,
          days: input.days as TripDay[] | undefined,
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
