import dedent from "dedent";
import { defineState } from "eve/context";

export type TripPick = {
  name: string;
  priceUsd?: number;
  bookingUrl?: string;
  notes?: string;
};

export type TripDossier = {
  destination?: string;
  origin?: string;
  departDate?: string;
  returnDate?: string;
  budgetUsd?: number;
  travelers?: number;
  preferences?: string;
  flight?: TripPick;
  hotel?: TripPick;
  spentUsd: number;
  overBudget: boolean;
  notionPageUrl?: string;
  calendarEventCount: number;
};

export const emptyTrip = (): TripDossier => ({
  spentUsd: 0,
  overBudget: false,
  calendarEventCount: 0,
});

export const trip = defineState("trippilot.dossier", emptyTrip);

export function withBudget(next: TripDossier): TripDossier {
  const spentUsd =
    (next.flight?.priceUsd ?? 0) + (next.hotel?.priceUsd ?? 0);
  return {
    ...next,
    spentUsd,
    overBudget:
      next.budgetUsd !== undefined ? spentUsd > next.budgetUsd : false,
  };
}

export function remainingUsd(dossier: TripDossier): number | undefined {
  if (dossier.budgetUsd === undefined) return undefined;
  return dossier.budgetUsd - dossier.spentUsd;
}

export function itineraryMarkdown(dossier: TripDossier): string {
  const dates = [dossier.departDate, dossier.returnDate]
    .filter(Boolean)
    .join(" → ");
  const remaining = remainingUsd(dossier);
  const budgetLine =
    dossier.budgetUsd === undefined
      ? "Not set"
      : `$${dossier.budgetUsd} total · $${dossier.spentUsd} selected${
          remaining === undefined ? "" : ` · $${remaining} remaining`
        }${dossier.overBudget ? " · OVER BUDGET" : ""}`;

  return dedent`
    # TripPilot: ${dossier.destination ?? "Trip"}${dates ? ` — ${dates}` : ""}

    ## Flight Details
    ${pickMarkdown(dossier.flight)}

    ## Hotel Details
    ${pickMarkdown(dossier.hotel)}

    ## Budget Breakdown
    - ${budgetLine}
    - Travelers: ${dossier.travelers ?? "not set"}
    ${dossier.preferences ? `- Preferences: ${dossier.preferences}` : ""}

    ## Important Links
    ${dossier.flight?.bookingUrl ? `- Flight: ${dossier.flight.bookingUrl}` : ""}
    ${dossier.hotel?.bookingUrl ? `- Hotel: ${dossier.hotel.bookingUrl}` : ""}

    ## Packing Notes
    - Add packing items here
  `.replace(/\n{3,}/g, "\n\n");
}

function pickMarkdown(pick?: TripPick): string {
  if (!pick) return "- Not selected yet";
  return [
    `- ${pick.name}`,
    pick.priceUsd !== undefined ? `- Price: $${pick.priceUsd}` : undefined,
    pick.bookingUrl ? `- Book: ${pick.bookingUrl}` : undefined,
    pick.notes ? `- Notes: ${pick.notes}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");
}
