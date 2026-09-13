import type { DynamicResolveContext } from "eve/tools";
import { defineDurableCallback, defineDynamic, defineTool } from "eve/tools";
import {
  executeBySessionId,
  isWriteToolSlug,
  multiExecuteNeedsApproval,
  requirePrincipalId,
  sessionFor,
} from "../session";

export default defineDynamic({
  events: {
    "step.started": async (_event, ctx: DynamicResolveContext) => {
      const session = await sessionFor(requirePrincipalId(ctx.session.auth));
      const tools = await session.tools();
      const sessionId = session.sessionId;

      return Object.fromEntries(
        Object.entries(tools)
          .filter(([slug]) => !isWriteToolSlug(slug))
          .map(([slug, tool]) => [
            slug,
            defineTool({
              description: tool.description ?? slug,
              inputSchema: jsonSchema(tool.inputSchema),
              approval:
                slug.toUpperCase() === "COMPOSIO_MULTI_EXECUTE_TOOL"
                  ? defineDurableCallback({
                      closure: {},
                      callback: (_closure, context: { toolInput?: unknown }) =>
                        multiExecuteNeedsApproval(context.toolInput),
                    })
                  : undefined,
              execute: defineDurableCallback({
                closure: { sessionId, slug },
                callback: ({ sessionId, slug }, input: Record<string, unknown>) =>
                  executeBySessionId(sessionId, slug, input),
              }),
            }),
          ]),
      );
    },
  },
});

function jsonSchema(schema: unknown): { type: "object" } {
  if (schema && typeof schema === "object" && !Array.isArray(schema)) {
    return schema as { type: "object" };
  }
  return { type: "object" };
}
