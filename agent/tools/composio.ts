import type { DynamicResolveContext } from "eve/tools";
import { defineComposioTools } from "@composio/experimental/eve";
import { requirePrincipalId, sessionFor } from "../session";

export default defineComposioTools((ctx: DynamicResolveContext) => {
  return sessionFor(requirePrincipalId(ctx.session.auth));
});
