import { mapsSearchUrl } from "./maps";
import type { TripDayItem, TripDossier } from "./trip";

export function isStayTransition(name: string): boolean {
  return /^(check\s*in|check\s*out)\b/i.test(name);
}

export function dayCalendarEvents(
  dossier: TripDossier,
  timezone: string,
): Record<string, unknown>[] {
  const hours = [10, 14];
  const events: Record<string, unknown>[] = [];

  for (const day of dossier.days ?? []) {
    let slot = 0;
    for (const item of day.items ?? []) {
      if (isStayTransition(item.name)) continue;
      const hour = hours[Math.min(slot, hours.length - 1)];
      slot += 1;
      const query = item.mapsQuery ?? item.name;
      events.push({
        summary: item.name,
        start_datetime: `${day.date}T${String(hour).padStart(2, "0")}:00:00`,
        event_duration_hour: 2,
        location: query,
        description: mapsSearchUrl(query),
        timezone,
        calendar_id: "primary",
        create_meeting_room: false,
      });
    }
  }

  return events;
}

export function walkableStops(dossier: TripDossier): TripDayItem[] {
  return (dossier.days ?? []).flatMap((day) =>
    (day.items ?? []).filter((item) => !isStayTransition(item.name)),
  );
}
