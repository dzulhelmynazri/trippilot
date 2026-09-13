import dedent from "dedent";
import { defineState } from "eve/context";
import { isStayTransition, walkableStops } from "./calendar";
import type { WriteConnection } from "../session";
import { flightBookUrl, hotelBookUrl } from "./booking";
import { playbookStops } from "./destinations";
import { mapsSearchUrl } from "./maps";
import type { TripWeather } from "./weather";

export type TripPick = {
  name: string;
  priceUsd?: number;
  bookingUrl?: string;
  notes?: string;
  departAt?: string;
  returnAt?: string;
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
  weather?: TripWeather;
  notionPageUrl?: string;
  notionSaved?: boolean;
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

export function itinerarySaved(dossier: TripDossier): boolean {
  return Boolean(dossier.notionSaved || dossier.notionPageUrl);
}

export function withTripExtras(dossier: TripDossier): TripDossier {
  const next = withBudget(dossier);
  return {
    ...next,
    packing: next.packing?.length ? next.packing : defaultPacking(next),
    days: daysNeedStops(next.days) ? defaultDays(next) : next.days,
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

  if (
    dossier.preferences?.toLowerCase().includes("rain") ||
    (dossier.weather?.wetDays ?? 0) > 0
  ) {
    items.push("Compact umbrella");
  }
  if (dossier.weather?.lowC !== undefined && dossier.weather.lowC <= 12) {
    items.push("Warm layer for cool mornings");
  }
  if (dossier.weather?.highC !== undefined && dossier.weather.highC >= 26) {
    items.push("Sunscreen and breathable clothes");
  }

  return items;
}

export function eventDateTime(
  date: string | undefined,
  explicit: string | undefined,
  fallbackTime: string,
): string | undefined {
  if (explicit) {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(explicit)) {
      return explicit.length === 16 ? `${explicit}:00` : explicit.slice(0, 19);
    }
    if (date && /^\d{2}:\d{2}/.test(explicit)) {
      const time = explicit.length === 5 ? `${explicit}:00` : explicit;
      return `${date}T${time}`;
    }
  }
  if (!date) return undefined;
  return `${date}T${fallbackTime}`;
}

export function clockLabel(value?: string): string | undefined {
  if (!value) return undefined;
  const match = /T(\d{2}:\d{2})/.exec(value) ?? /^(\d{2}:\d{2})/.exec(value);
  return match?.[1];
}

export function defaultDays(dossier: TripDossier): TripDay[] {
  const dates = tripDates(dossier);
  if (dates.length === 0) return [];
  const destination = dossier.destination ?? "destination";
  const stops = playbookStops(dossier.destination);
  let cursor = 0;
  const take = (count: number): TripDayItem[] => {
    const slice = stops.slice(cursor, cursor + count);
    cursor += slice.length;
    return slice.map((stop) => ({
      name: stop.name,
      mapsQuery: stop.mapsQuery,
    }));
  };

  return dates.map((date, index) => {
    const last = index === dates.length - 1;
    const title =
      index === 0
        ? `Arrive · ${destination}`
        : last
          ? `Depart · ${destination}`
          : `Explore · ${destination}`;
    const items: TripDayItem[] = [];
    if (index === 0 && dossier.hotel) {
      items.push({
        name: `Check in · ${dossier.hotel.name}`,
        mapsQuery: dossier.hotel.name,
      });
    }
    items.push(...take(index === 0 || last ? 1 : 2));
    if (last && dossier.hotel) {
      items.push({
        name: `Check out · ${dossier.hotel.name}`,
        mapsQuery: dossier.hotel.name,
      });
    }
    return { date, title, items };
  });
}

export function briefMapLinks(
  dossier: TripDossier,
): { name: string; url: string }[] {
  const seen = new Set<string>();
  const links: { name: string; url: string }[] = [];
  const push = (name: string, query: string) => {
    const url = mapsSearchUrl(query);
    if (seen.has(url)) return;
    seen.add(url);
    links.push({ name, url });
  };

  if (dossier.hotel) push(dossier.hotel.name, dossier.hotel.name);
  for (const item of walkableStops(dossier)) {
    push(item.name, item.mapsQuery ?? item.name);
  }
  return links;
}

export function nextActions(
  dossier: TripDossier,
  connections: readonly WriteConnection[] = [],
): string[] {
  const actions: string[] = [];
  if (!dossier.flight) actions.push("Pick a flight and save it on the dossier");
  if (!dossier.hotel) actions.push("Pick a hotel and save it on the dossier");
  if (dossier.overBudget) {
    actions.push(
      "Over budget — pick recut A (keep hotel) or B (keep flight)",
    );
  }
  const notion = connections.find((item) => item.toolkit === "notion");
  const calendar = connections.find((item) => item.toolkit === "googlecalendar");
  if (notion && !notion.connected) {
    actions.push(
      notion.connectUrl
        ? `Connect Notion: ${notion.connectUrl}`
        : "Notion is not connected — call trip_brief again for a Composio Connect Link",
    );
  } else if (!itinerarySaved(dossier)) {
    actions.push(
      "Approve save_itinerary — reply approve (deny to cancel)",
    );
  }
  if (calendar && !calendar.connected) {
    actions.push(
      calendar.connectUrl
        ? `Connect Calendar: ${calendar.connectUrl}`
        : "Calendar is not connected — call trip_brief again for a Composio Connect Link",
    );
  } else if (dossier.calendarEventCount === 0) {
    actions.push(
      "Approve add_calendar_events — reply approve (deny to cancel)",
    );
  }
  const flightBook = flightBookUrl(dossier);
  const hotelBook = hotelBookUrl(dossier);
  if (flightBook) actions.push(`Book flight: ${flightBook}`);
  if (hotelBook) actions.push(`Book hotel: ${hotelBook}`);
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
                    .map((item) => {
                      const query = item.mapsQuery ?? item.name;
                      return `  - ${item.name} — ${mapsSearchUrl(query)}`;
                    })
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
    ${ready.weather ? `- Weather: ${ready.weather.summary} (${ready.weather.source})` : ""}

    ## Important Links
    ${flightBookUrl(ready) ? `- Flight: ${flightBookUrl(ready)}` : ""}
    ${hotelBookUrl(ready) ? `- Hotel: ${hotelBookUrl(ready)}` : ""}

    ## Packing
    ${ready.packing.map((item) => `- ${item}`).join("\n")}
  `.replace(/\n{3,}/g, "\n\n");
}

export function tripBriefText(
  dossier: TripDossier,
  connections: readonly WriteConnection[] = [],
): string {
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
    ready.weather
      ? `🌤️ ${ready.weather.summary}${ready.weather.source === "typical" ? " · typical" : ""}`
      : undefined,
    ready.flight
      ? `✈️ ${ready.flight.name}${clockLabel(ready.flight.departAt) ? ` · ${clockLabel(ready.flight.departAt)}` : ""}`
      : "✈️ Flight not picked",
    ready.flight && flightBookUrl(ready)
      ? `   Book — ${flightBookUrl(ready)}`
      : undefined,
    ready.hotel
      ? `🏨 ${ready.hotel.name} — ${mapsSearchUrl(ready.hotel.name)}`
      : "🏨 Hotel not picked",
    ready.hotel && hotelBookUrl(ready)
      ? `   Book — ${hotelBookUrl(ready)}`
      : undefined,
    "",
    "📅 DAYS",
    ...ready.days.flatMap((day) => [
      `• ${day.date} · ${day.title}`,
      ...day.items
        .filter((item) => !isStayTransition(item.name))
        .map((item) => {
          const query = item.mapsQuery ?? item.name;
          return `  ${item.name} — ${mapsSearchUrl(query)}`;
        }),
    ]),
    "",
    "🎒 PACK",
    ...ready.packing.slice(0, 6).map((item) => `• ${item}`),
    "",
    "➡️ NEXT",
    ...nextActions(ready, connections).map((action) => `• ${action}`),
  ]
    .filter((line) => line !== undefined)
    .join("\n");
}

function daysNeedStops(days?: TripDay[]): boolean {
  if (!days?.length) return true;
  return days.every((day) => !day.items?.length);
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
    clockLabel(pick.departAt) ? `- Depart: ${clockLabel(pick.departAt)}` : undefined,
    clockLabel(pick.returnAt) ? `- Return: ${clockLabel(pick.returnAt)}` : undefined,
    pick.bookingUrl ? `- Book: ${pick.bookingUrl}` : undefined,
    pick.notes ? `- Notes: ${pick.notes}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");
}
