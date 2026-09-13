import { defineMcpClientConnection } from "eve/connections";

export default defineMcpClientConnection({
  url: "https://ignav.com/mcp",
  description:
    "Live one-way and round-trip flight fares with a booking_url on every itinerary. Resolve cities to IATA codes, then search fares. Do not use Composio for flights.",
  auth: {
    getToken: async () => {
      const token = process.env.IGNAV_API_KEY!;
      return { token };
    },
  },
  tools: { allow: ["search_airports", "search_flights"] },
});
