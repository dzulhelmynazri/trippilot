import dedent from "dedent";
import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import {
  executeSessionTool,
  extractUrl,
  firstNotionParentId,
  requirePrincipalId,
  writeConnection,
} from "../session";
import { itineraryMarkdown, trip } from "../lib/trip";

export default defineTool({
  description: dedent`
    Create a Notion page from the durable trip dossier after the user approves.
    Do not call raw Notion write tools.
    If Notion is not connected, return the Composio Connect Link and stop. Never send notion.so.
    When this tool parks, tell the user: tap ❤️ / 👍 or reply approve to save; tap 👎 or reply deny to cancel.
  `,
  inputSchema: z.object({
    parentId: z
      .string()
      .min(1)
      .optional()
      .describe("Notion page or database UUID to create under."),
    parentTitle: z
      .string()
      .min(1)
      .optional()
      .describe("Title to search for if parentId is unknown."),
    force: z
      .boolean()
      .default(false)
      .describe("Create another page even if this session already saved one."),
  }),
  approval: always(),
  label: {
    start: () => "Save itinerary to Notion",
  },
  async execute({ parentId, parentTitle, force }, ctx) {
    const userId = requirePrincipalId(ctx.session.auth);
    const dossier = trip.get();

    if (!dossier.destination) {
      return {
        ok: false as const,
        error: "No destination on the trip dossier. Call update_trip first.",
      };
    }

    const notion = await writeConnection(userId, "notion");
    if (!notion.connected) {
      return {
        ok: false as const,
        needsConnection: true,
        connectUrl: notion.connectUrl,
        error: notion.connectUrl
          ? `Notion is not connected. Send this Connect Link verbatim and stop. Do not send notion.so. ${notion.connectUrl}`
          : "Notion is not connected and Composio did not return a Connect Link. Call trip_brief.",
      };
    }

    if (dossier.notionPageUrl && !force) {
      return {
        ok: true as const,
        skipped: true,
        url: dossier.notionPageUrl,
        reason: dedent`
          This session already saved a Notion page.
          Pass force=true to create another.
        `,
      };
    }

    const title = `TripPilot: ${dossier.destination}${
      dossier.departDate ? ` — ${dossier.departDate}` : ""
    }`;
    const resolvedParentId =
      parentId ?? (await findParentPage(userId, parentTitle));

    if (!resolvedParentId) {
      return {
        ok: false as const,
        needsParent: true,
        error: dedent`
          Could not find a Notion parent page.
          Ask the user for a page title they have shared with TripPilot, then retry with parentTitle or parentId.
        `,
      };
    }

    const created = await executeSessionTool(userId, "NOTION_CREATE_NOTION_PAGE", {
      title,
      icon: "✈️",
      parent_id: resolvedParentId,
      markdown: itineraryMarkdown(dossier),
    });

    if (created.successful === false) {
      return {
        ok: false as const,
        error: created.error ?? "Notion page creation failed.",
        details: created.data,
      };
    }

    const url =
      extractUrl(created, /https?:\/\/(?:www\.)?notion\.so\/[^\s"\\]+/i) ??
      extractUrl(created.data, /https?:\/\/(?:www\.)?notion\.so\/[^\s"\\]+/i);

    trip.update((current) => ({
      ...current,
      notionPageUrl: url ?? current.notionPageUrl,
    }));

    return {
      ok: true as const,
      title,
      url,
      parentId: resolvedParentId,
    };
  },
});

async function findParentPage(
  userId: string,
  parentTitle?: string,
): Promise<string | undefined> {
  const query = parentTitle ?? "TripPilot";
  const searched = await executeSessionTool(userId, "NOTION_SEARCH_NOTION_PAGE", {
    query,
    page_size: 5,
    filter_value: "page",
  });
  const fromQuery = firstNotionParentId(searched.data ?? searched);
  if (fromQuery) return fromQuery;

  const fallback = await executeSessionTool(userId, "NOTION_SEARCH_NOTION_PAGE", {
    query: "",
    page_size: 5,
    filter_value: "page",
  });
  return firstNotionParentId(fallback.data ?? fallback);
}
