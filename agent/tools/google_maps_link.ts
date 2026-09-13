import dedent from "dedent";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { mapsDirectionsUrl, mapsSearchUrl } from "../lib/maps";

export default defineTool({
  description: dedent`
    Generate a Google Maps link for a place name or address.
    Use this to give the user a tappable link they can open to navigate to hotels, restaurants, airports, or attractions.
  `,
  inputSchema: z.object({
    query: z
      .string()
      .min(1)
      .describe("Place name, address, or landmark to search on Google Maps."),
    mode: z
      .enum(["search", "directions"])
      .default("search")
      .describe(
        dedent`
          "search" returns a map pin for the place.
          "directions" returns a directions link (user's current location → destination).
        `,
      ),
  }),
  label: {
    start: ({ query }) => `Map link for ${query}`,
  },
  execute({ query, mode }) {
    if (mode === "directions") {
      return {
        url: mapsDirectionsUrl(query),
        query,
        type: "directions" as const,
      };
    }

    return {
      url: mapsSearchUrl(query),
      query,
      type: "search" as const,
    };
  },
});
