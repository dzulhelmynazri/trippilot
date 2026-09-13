import dedent from "dedent";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { flightBookUrl, hotelBookUrl } from "../lib/booking";
import {
  requirePrincipalId,
  writeConnections,
  type WriteConnection,
} from "../session";
import {
  briefMapLinks,
  nextActions,
  remainingUsd,
  trip,
  tripBriefText,
  tripNights,
  withTripExtras,
} from "../lib/trip";
import { fetchTripWeather } from "../lib/weather";

export default defineTool({
  description: dedent`
    Build a code-backed trip brief from the durable dossier: nights, remaining budget, weather, walkable day stops with Maps links, packing list, Book links from saved Ignav MCP booking_url / Blue Pillow bookingUrl, Connect Links if Notion/Calendar are not connected, and next actions.
    Call this after the user picks a flight or hotel, or when they ask for a summary, packing list, day plan, weather, or map links.
    Do not invent packing, remaining cash, landmarks, weather, map URLs, Book URLs, or Connect Links — use this tool's output.
  `,
  inputSchema: z.object({}),
  label: {
    start: () => "Build trip brief",
  },
  async execute(_input, ctx) {
    const current = trip.get();
    if (!current.destination) {
      return {
        ok: false as const,
        error: "No destination on the trip dossier. Call update_trip first.",
      };
    }

    const weather = current.weather ?? (await fetchTripWeather(current));
    const connections = await safeWriteConnections(ctx.session.auth);
    const ready = withTripExtras({
      ...current,
      weather: weather ?? current.weather,
    });
    trip.update(() => ready);

    return {
      ok: true as const,
      destination: ready.destination,
      nights: tripNights(ready),
      remainingUsd: remainingUsd(ready),
      overBudget: ready.overBudget,
      weather: ready.weather,
      packing: ready.packing,
      days: ready.days,
      maps: briefMapLinks(ready),
      booking: {
        flight: flightBookUrl(ready),
        hotel: hotelBookUrl(ready),
      },
      connections,
      nextActions: nextActions(ready, connections),
      imessage: tripBriefText(ready, connections),
    };
  },
});

async function safeWriteConnections(
  auth: { current?: { principalId?: string } | null },
): Promise<WriteConnection[]> {
  try {
    return await writeConnections(requirePrincipalId(auth));
  } catch {
    return [];
  }
}
