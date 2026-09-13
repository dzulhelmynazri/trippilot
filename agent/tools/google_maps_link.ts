import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description:
    "Generate a Google Maps link for a place name or address. " +
    "Use this to give the user a tappable link they can open to navigate to hotels, restaurants, airports, or attractions.",
  inputSchema: z.object({
    query: z
      .string()
      .min(1)
      .describe("Place name, address, or landmark to search on Google Maps."),
    mode: z
      .enum(["search", "directions"])
      .default("search")
      .describe(
        '"search" returns a map pin for the place. ' +
        '"directions" returns a directions link (user\'s current location → destination).'
      ),
  }),
  label: {
    start: ({ query }) => `Map link for ${query}`,
  },
  execute({ query, mode }) {
    const encoded = encodeURIComponent(query);

    if (mode === "directions") {
      return {
        url: `https://www.google.com/maps/dir/?api=1&destination=${encoded}`,
        query,
        type: "directions" as const,
      };
    }

    return {
      url: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
      query,
      type: "search" as const,
    };
  },
});
