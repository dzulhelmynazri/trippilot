import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

export default defineEval({
  description: "TripPilot returns a Google Maps link for a location request.",
  tags: ["smoke"],
  timeoutMs: 120_000,
  async test(t) {
    await t.send("Send me a Google Maps link for Tokyo Tower.");
    t.succeeded();
    t.calledTool("google_maps_link").soft();
    t.check(t.reply, includes(/google\.com\/maps|maps\.google/i));
  },
});
