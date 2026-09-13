import type { DynamicResolveContext } from "eve/tools";
import { defineComposioTools } from "@composio/experimental/eve";
import { createUserSession, requirePrincipalId } from "../lib/composio";

export default defineComposioTools((ctx: DynamicResolveContext) => {
  const userId = requirePrincipalId(ctx.session.auth);
  return createUserSession(userId);
});
