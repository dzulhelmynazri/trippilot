import { Composio } from "@composio/core";
import {
  EveProvider,
  requireApprovalForTools,
} from "@composio/experimental/eve";

export const SEARCH_TOOLKITS = ["bluepillow", "google_maps"] as const;

export const WRITE_TOOLKITS = ["notion", "googlecalendar"] as const;

export const TOOLKITS = [...SEARCH_TOOLKITS, ...WRITE_TOOLKITS] as const;

/** Side-effect slugs the model must not fire without a human approval. */
export const WRITE_TOOL_SLUGS = [
  "NOTION_CREATE_NOTION_PAGE",
  "NOTION_ADD_MULTIPLE_PAGE_CONTENT",
  "GOOGLECALENDAR_CREATE_EVENT",
  "GOOGLECALENDAR_DELETE_EVENT",
] as const;

export const composio = new Composio({
  provider: new EveProvider({
    needsApproval: requireApprovalForTools(...WRITE_TOOL_SLUGS),
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

export function createUserSession(userId: string) {
  return composio.sessions.create(userId, {
    toolkits: [...TOOLKITS],
    sandbox: { enable: false },
  });
}

type ToolExecuteResult = {
  successful?: boolean;
  error?: unknown;
  data?: unknown;
};

export async function executeUserTool(
  userId: string,
  slug: string,
  args: Record<string, unknown>,
): Promise<ToolExecuteResult> {
  const tools = composio.tools as {
    execute: (
      toolSlug: string,
      body: {
        userId: string;
        arguments: Record<string, unknown>;
        dangerouslySkipVersionCheck?: boolean;
      },
    ) => Promise<ToolExecuteResult>;
  };
  try {
    return await tools.execute(slug, {
      userId,
      arguments: compact(args),
      dangerouslySkipVersionCheck: true,
    });
  } catch (error) {
    return {
      successful: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export type WriteConnection = {
  toolkit: "notion" | "googlecalendar";
  connected: boolean;
  connectUrl?: string;
};

const COMPOSIO_CONNECT_HOST = /(^|\.)composio\.dev$/i;

/** Accept only Composio Connect Links — never notion.so or a reconstructed OAuth page. */
export function composioConnectUrl(value?: string | null): string | undefined {
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
    const listed = await composio.connectedAccounts.list({
      userIds: [userId],
      toolkitSlugs: [toolkit],
      statuses: ["ACTIVE"],
    });
    if ((listed.items?.length ?? 0) > 0) {
      return { toolkit, connected: true };
    }
    const session = await createUserSession(userId);
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

export function compact<T extends Record<string, unknown>>(
  value: T,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  );
}

export function extractUrl(payload: unknown, pattern: RegExp): string | undefined {
  const text = JSON.stringify(payload);
  return text.match(pattern)?.[0];
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
