import dedent from "dedent";
import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import { dayCalendarEvents } from "../lib/calendar";
import { executeUserTool, extractUrl, requirePrincipalId } from "../lib/composio";
import { eventDateTime, trip, withTripExtras } from "../lib/trip";

const extraEventSchema = z.object({
  summary: z.string().min(1),
  startDatetime: z
    .string()
    .min(1)
    .describe("ISO 8601 local datetime, e.g. 2026-04-12T09:00:00"),
  endDatetime: z.string().min(1).optional(),
  durationHours: z.number().int().nonnegative().default(2),
  location: z.string().optional(),
  description: z.string().optional(),
  timezone: z.string().default("UTC"),
});

export default defineTool({
  description: dedent`
    Create Google Calendar events from the durable trip dossier after the user approves.
    Writes departure, return, hotel check-in, walkable day-plan stops from the dossier, and any extra events.
    Do not call raw Calendar write tools.
  `,
  inputSchema: z.object({
    timezone: z.string().default("UTC"),
    extraEvents: z.array(extraEventSchema).default([]),
  }),
  approval: always(),
  label: {
    start: () => "Add trip events to Calendar",
  },
  async execute({ timezone, extraEvents }, ctx) {
    const userId = requirePrincipalId(ctx.session.auth);
    const dossier = withTripExtras(trip.get());
    trip.update(() => dossier);

    if (!dossier.destination) {
      return {
        ok: false as const,
        error: "No destination on the trip dossier. Call update_trip first.",
      };
    }

    const planned = [
      ...coreEvents(dossier, timezone),
      ...dayCalendarEvents(dossier, timezone),
      ...extraEvents.map((event) => ({
        summary: event.summary,
        start_datetime: event.startDatetime,
        end_datetime: event.endDatetime,
        event_duration_hour: event.endDatetime ? undefined : event.durationHours,
        location: event.location,
        description: event.description,
        timezone: event.timezone,
        calendar_id: "primary",
        create_meeting_room: false,
      })),
    ];

    if (planned.length === 0) {
      return {
        ok: false as const,
        error: dedent`
          Nothing to add.
          Set dates or a hotel on the dossier so the day plan can be written, or pass extraEvents.
        `,
      };
    }

    const results = [];
    for (const event of planned) {
      const created = await executeUserTool(
        userId,
        "GOOGLECALENDAR_CREATE_EVENT",
        event,
      );
      results.push({
        summary: event.summary,
        ok: created.successful !== false,
        error: created.error,
        url: extractUrl(
          created,
          /https?:\/\/calendar\.google\.com\/[^\s"\\]+/i,
        ),
      });
    }

    const createdCount = results.filter((result) => result.ok).length;
    trip.update((current) => ({
      ...current,
      calendarEventCount: current.calendarEventCount + createdCount,
    }));

    return {
      ok: createdCount > 0,
      createdCount,
      failedCount: results.length - createdCount,
      events: results,
    };
  },
});

function coreEvents(
  dossier: ReturnType<typeof trip.get>,
  timezone: string,
) {
  const events: Record<string, unknown>[] = [];

  const departAt = eventDateTime(
    dossier.departDate,
    dossier.flight?.departAt,
    "09:00:00",
  );
  const returnAt = eventDateTime(
    dossier.returnDate,
    dossier.flight?.returnAt,
    "18:00:00",
  );

  if (departAt) {
    events.push({
      summary: `✈️ Depart ${dossier.origin ?? ""} → ${dossier.destination}`.trim(),
      start_datetime: departAt,
      event_duration_hour: 3,
      location: dossier.origin,
      description: dossier.flight
        ? [dossier.flight.name, dossier.flight.bookingUrl]
            .filter(Boolean)
            .join("\n")
        : undefined,
      timezone,
      calendar_id: "primary",
      create_meeting_room: false,
    });
  }

  if (returnAt) {
    events.push({
      summary: `✈️ Return ${dossier.destination} → ${dossier.origin ?? ""}`.trim(),
      start_datetime: returnAt,
      event_duration_hour: 3,
      location: dossier.destination,
      description: dossier.flight
        ? [dossier.flight.name, dossier.flight.bookingUrl]
            .filter(Boolean)
            .join("\n")
        : undefined,
      timezone,
      calendar_id: "primary",
      create_meeting_room: false,
    });
  }

  if (dossier.hotel && dossier.departDate) {
    events.push({
      summary: `🏨 Check-in · ${dossier.hotel.name}`,
      start_datetime: `${dossier.departDate}T15:00:00`,
      event_duration_hour: 1,
      location: dossier.hotel.name,
      description: dossier.hotel.bookingUrl,
      timezone,
      calendar_id: "primary",
      create_meeting_room: false,
    });
  }

  if (dossier.hotel && dossier.returnDate) {
    events.push({
      summary: `🏨 Check-out · ${dossier.hotel.name}`,
      start_datetime: `${dossier.returnDate}T11:00:00`,
      event_duration_hour: 1,
      location: dossier.hotel.name,
      description: dossier.hotel.bookingUrl,
      timezone,
      calendar_id: "primary",
      create_meeting_room: false,
    });
  }

  return events;
}
