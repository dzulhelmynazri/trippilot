import { Composio } from "@composio/core";
import { EveProvider, defineComposioTools } from "@composio/experimental/eve";
import type { DynamicResolveContext } from "eve/tools";

const composio = new Composio({ provider: new EveProvider() });

const toolkits = [
  "ignav_flights",
  "googlecalendar",
  "bluepillow",
  "notion",
  "google_maps",
] as const;

const sessions = new Map<
  string,
  ReturnType<typeof composio.sessions.create>
>();

function composioUserId(ctx: DynamicResolveContext): string {
  return (
    ctx.session.auth.current?.principalId ??
    ctx.session.auth.initiator?.principalId ??
    "anonymous"
  );
}

function sessionFor(userId: string) {
  let session = sessions.get(userId);
  if (!session) {
    session = composio.sessions.create(userId, {
      toolkits: [...toolkits],
      preload: { tools: "all" },
    });
    sessions.set(userId, session);
  }
  return session;
}

export default defineComposioTools((ctx) => sessionFor(composioUserId(ctx)));
