import dedent from "dedent";
import { defineState } from "eve/context";

export type TripPick = {
  name: string;
  priceUsd?: number;
  bookingUrl?: string;
  notes?: string;
};

export type TripDayItem = {
  name: string;
  mapsQuery?: string;
  notes?: string;
};

export type TripDay = {
  date: string;
  title: string;
  items: TripDayItem[];
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
  packing: string[];
  days: TripDay[];
  notionPageUrl?: string;
  calendarEventCount: number;
};

export const emptyTrip = (): TripDossier => ({
  spentUsd: 0,
  overBudget: false,
  packing: [],
  days: [],
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

export function withTripExtras(dossier: TripDossier): TripDossier {
  const next = withBudget(dossier);
  return {
    ...next,
    packing: next.packing?.length ? next.packing : defaultPacking(next),
    days: next.days?.length ? next.days : defaultDays(next),
  };
}

export function tripNights(dossier: TripDossier): number | undefined {
  const start = parseYmd(dossier.departDate);
  const end = parseYmd(dossier.returnDate);
  if (start === undefined || end === undefined || end < start) return undefined;
  return Math.round((end - start) / 86_400_000);
}

export function tripDates(dossier: TripDossier): string[] {
  const start = parseYmd(dossier.departDate);
  const end = parseYmd(dossier.returnDate);
  if (start === undefined) {
    return dossier.departDate ? [dossier.departDate] : [];
  }
  if (end === undefined || end < start) return [ymd(start)];
  const dates: string[] = [];
  for (let time = start; time <= end; time += 86_400_000) {
    dates.push(ymd(time));
  }
  return dates;
}

export function defaultPacking(dossier: TripDossier): string[] {
  const nights = tripNights(dossier) ?? 3;
  const destination = (dossier.destination ?? "").toLowerCase();
  const month = dossier.departDate?.slice(5, 7);
  const items = [
    "Passport / travel ID",
    "Phone charger and power bank",
    `${nights} days of clothes`,
    "Toiletries and any prescriptions",
  ];

  if (destination.includes("tokyo") || destination.includes("japan")) {
    items.push("Comfortable walking shoes");
    items.push("Suica / Pasmo IC card or Apple Wallet transit");
    if (month === "03" || month === "04" || month === "05") {
      items.push("Light layers for spring weather");
    }
  }

  if (dossier.flight?.bookingUrl || dossier.hotel?.bookingUrl) {
    items.push("Offline copies of booking confirmations");
  }

  if (dossier.preferences?.toLowerCase().includes("rain")) {
    items.push("Compact umbrella");
  }

  return items;
}

export function defaultDays(dossier: TripDossier): TripDay[] {
  const dates = tripDates(dossier);
  if (dates.length === 0) return [];
  const destination = dossier.destination ?? "destination";
  return dates.map((date, index) => {
    const title =
      index === 0
        ? `Arrive · ${destination}`
        : index === dates.length - 1
          ? `Depart · ${destination}`
          : `Explore · ${destination}`;
    const items: TripDayItem[] = [];
    if (index === 0 && dossier.hotel) {
      items.push({
        name: `Check in · ${dossier.hotel.name}`,
        mapsQuery: dossier.hotel.name,
      });
    }
    if (index === dates.length - 1 && dossier.hotel) {
      items.push({
        name: `Check out · ${dossier.hotel.name}`,
        mapsQuery: dossier.hotel.name,
      });
    }
    return { date, title, items };
  });
}

export function nextActions(dossier: TripDossier): string[] {
  const actions: string[] = [];
  if (!dossier.flight) actions.push("Pick a flight and save it on the dossier");
  if (!dossier.hotel) actions.push("Pick a hotel and save it on the dossier");
  if (dossier.overBudget) {
    actions.push("Choose a cheaper flight or hotel — the plan is over budget");
  }
  if (!dossier.notionPageUrl) {
    actions.push("Approve save_itinerary to write the plan to Notion");
  }
  if (dossier.calendarEventCount === 0) {
    actions.push("Approve add_calendar_events to block the trip on Calendar");
  }
  if (dossier.hotel) {
    actions.push(`Open Maps for ${dossier.hotel.name}`);
  }
  if (actions.length === 0) actions.push("You're set — travel day checklist is ready");
  return actions;
}

export function itineraryMarkdown(dossier: TripDossier): string {
  const ready = withTripExtras(dossier);
  const dates = [ready.departDate, ready.returnDate]
    .filter(Boolean)
    .join(" → ");
  const remaining = remainingUsd(ready);
  const nights = tripNights(ready);
  const budgetLine =
    ready.budgetUsd === undefined
      ? "Not set"
      : `$${ready.budgetUsd} total · $${ready.spentUsd} selected${
          remaining === undefined ? "" : ` · $${remaining} remaining`
        }${ready.overBudget ? " · OVER BUDGET" : ""}`;

  const dayLines =
    ready.days.length === 0
      ? "- Dates not set yet"
      : ready.days
          .map((day) => {
            const items =
              day.items.length === 0
                ? "  - Open day"
                : day.items
                    .map((item) => `  - ${item.name}`)
                    .join("\n");
            return `- ${day.date} · ${day.title}\n${items}`;
          })
          .join("\n");

  return dedent`
    # TripPilot: ${ready.destination ?? "Trip"}${dates ? ` — ${dates}` : ""}

    ## Flight Details
    ${pickMarkdown(ready.flight)}

    ## Hotel Details
    ${pickMarkdown(ready.hotel)}

    ## Day plan${nights === undefined ? "" : ` · ${nights} nights`}
    ${dayLines}

    ## Budget Breakdown
    - ${budgetLine}
    - Travelers: ${ready.travelers ?? "not set"}
    ${ready.preferences ? `- Preferences: ${ready.preferences}` : ""}

    ## Important Links
    ${ready.flight?.bookingUrl ? `- Flight: ${ready.flight.bookingUrl}` : ""}
    ${ready.hotel?.bookingUrl ? `- Hotel: ${ready.hotel.bookingUrl}` : ""}

    ## Packing
    ${ready.packing.map((item) => `- ${item}`).join("\n")}
  `.replace(/\n{3,}/g, "\n\n");
}

export function tripBriefText(dossier: TripDossier): string {
  const ready = withTripExtras(dossier);
  const remaining = remainingUsd(ready);
  const nights = tripNights(ready);
  const dates = [ready.departDate, ready.returnDate]
    .filter(Boolean)
    .join(" → ");
  const money =
    ready.budgetUsd === undefined
      ? "Budget not set"
      : `$${ready.spentUsd} / $${ready.budgetUsd}${
          remaining === undefined ? "" : ` · $${remaining} left`
        }${ready.overBudget ? " · OVER BUDGET" : ""}`;

  return [
    `📋 ${ready.destination ?? "Trip"}${dates ? ` · ${dates}` : ""}${
      nights === undefined ? "" : ` · ${nights} nights`
    }`,
    money,
    ready.flight ? `✈️ ${ready.flight.name}` : "✈️ Flight not picked",
    ready.hotel ? `🏨 ${ready.hotel.name}` : "🏨 Hotel not picked",
    "",
    "📅 DAYS",
    ...ready.days.map((day) => `• ${day.date} · ${day.title}`),
    "",
    "🎒 PACK",
    ...ready.packing.slice(0, 6).map((item) => `• ${item}`),
    "",
    "➡️ NEXT",
    ...nextActions(ready).map((action) => `• ${action}`),
  ].join("\n");
}

function parseYmd(value?: string): number | undefined {
  if (!value) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return undefined;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function ymd(utcMs: number): string {
  return new Date(utcMs).toISOString().slice(0, 10);
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
