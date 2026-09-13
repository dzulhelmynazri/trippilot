import { Composio } from "@composio/core";
import { EveProvider, defineComposioTools } from "@composio/experimental/eve";

const composio = new Composio({ provider: new EveProvider() });

const session = composio.sessions.create("default", {
  toolkits: [
    "ignav_flights",
    "googlecalendar",
    "bluepillow",
    "notion",
    "google_maps",
  ],
  preload: { tools: "all" },
});

export default defineComposioTools(session);