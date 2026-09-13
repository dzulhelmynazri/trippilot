import { Composio } from "@composio/core";
import {
  EveProvider,
  requireApprovalForTools,
} from "@composio/experimental/eve";

const TOOLKITS = [
  "bluepillow",
  "google_maps",
  "notion",
  "googlecalendar",
] as const;

export const WRITE_TOOL_SLUGS = [
  "NOTION_CREATE_NOTION_PAGE",
  "NOTION_ADD_MULTIPLE_PAGE_CONTENT",
  "GOOGLECALENDAR_CREATE_EVENT",
  "GOOGLECALENDAR_DELETE_EVENT",
] as const;

const COMPOSIO_CONNECT_HOST = /(^|\.)composio\.dev$/i;

export const composio = new Composio({
  provider: new EveProvider({
    needsApproval: requireApprovalForTools(...WRITE_TOOL_SLUGS),
    hooks: {
      search: (ctx, next) => {
        ctx.request.args.toolkits = [...TOOLKITS];
        return next();
      },
    },
  }),
});

type SessionAuth = {
  current?: { principalId?: string } | null;
  initiator?: { principalId?: string } | null;
};

export function requirePrincipalId(auth: SessionAuth): string {
  const id = auth.current?.principalId ?? auth.initiator?.principalId;
  if (!id || id === "anonymous") {
    throw new Error(
      "TripPilot requires a signed-in user before calling connected apps.",
    );
  }
  return id;
}

export function sessionFor(userId: string) {
  return composio.sessions.create(userId, {
    toolkits: [...TOOLKITS],
    sandbox: { enable: false },
  });
}

export type WriteConnection = {
  toolkit: "notion" | "googlecalendar";
  connected: boolean;
  connectUrl?: string;
};

export async function writeConnections(
  userId: string,
): Promise<WriteConnection[]> {
  return Promise.all([
    writeConnection(userId, "notion"),
    writeConnection(userId, "googlecalendar"),
  ]);
}

export async function writeConnection(
  userId: string,
  toolkit: WriteConnection["toolkit"],
): Promise<WriteConnection> {
  try {
    const session = await sessionFor(userId);
    const listed = await session.toolkits({ toolkits: [toolkit] });
    const item = listed.items.find((entry) => entry.slug === toolkit);
    if (item?.connection?.isActive) {
      return { toolkit, connected: true };
    }
    const request = await session.authorize(toolkit);
    return {
      toolkit,
      connected: false,
      connectUrl: composioConnectUrl(request.redirectUrl),
    };
  } catch {
    return { toolkit, connected: false };
  }
}

export type SessionToolResult = {
  successful: boolean;
  error?: unknown;
  data?: unknown;
};

export async function executeSessionTool(
  userId: string,
  slug: string,
  args: Record<string, unknown>,
): Promise<SessionToolResult> {
  const session = await sessionFor(userId);
  return executeBySessionId(session.sessionId, slug, args);
}

export async function executeBySessionId(
  sessionId: string,
  slug: string,
  args: Record<string, unknown>,
): Promise<SessionToolResult> {
  try {
    const session = await composio.sessions.use(sessionId);
    const result = await session.execute(
      slug,
      Object.fromEntries(
        Object.entries(args).filter(([, value]) => value !== undefined),
      ),
    );
    return {
      successful: result.error == null,
      error: result.error ?? undefined,
      data: result.data,
    };
  } catch (error) {
    return {
      successful: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function isWriteToolSlug(slug: string): boolean {
  return WRITE_TOOL_SLUGS.includes(
    slug.toUpperCase() as (typeof WRITE_TOOL_SLUGS)[number],
  );
}

export function multiExecuteNeedsApproval(input: unknown): boolean {
  if (typeof input !== "object" || input === null) return false;
  const requested = (input as { tools?: unknown }).tools;
  if (!Array.isArray(requested)) return false;
  return requested.some((item) => {
    if (typeof item !== "object" || item === null) return false;
    const slug = (item as { tool_slug?: unknown }).tool_slug;
    return typeof slug === "string" && isWriteToolSlug(slug);
  });
}

function composioConnectUrl(value?: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return undefined;
    if (!COMPOSIO_CONNECT_HOST.test(url.hostname)) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

export function extractUrl(
  payload: unknown,
  pattern: RegExp,
): string | undefined {
  return JSON.stringify(payload).match(pattern)?.[0];
}

export function firstNotionParentId(payload: unknown): string | undefined {
  const visit = (value: unknown): string | undefined => {
    if (!value || typeof value !== "object") return undefined;
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = visit(item);
        if (found) return found;
      }
      return undefined;
    }
    const record = value as Record<string, unknown>;
    const id = record.id ?? record.page_id ?? record.pageId;
    const object = record.object ?? record.type;
    if (
      typeof id === "string" &&
      (object === undefined || object === "page" || object === "database")
    ) {
      return id;
    }
    for (const child of Object.values(record)) {
      const found = visit(child);
      if (found) return found;
    }
    return undefined;
  };
  return visit(payload);
}
