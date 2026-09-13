import { vercelOidc } from "eve/channels/auth";
import { chatSdkChannel, messageToUserContent } from "eve/channels/chat-sdk";
import { defaultPhotonAuth } from "eve/channels/photon";
import { createMemoryState } from "../../node_modules/eve/dist/src/compiled/@chat-adapter/state-memory/index.js";
import { createiMessageAdapter } from "../../node_modules/eve/dist/src/compiled/@photon-ai/chat-adapter-imessage/index.js";
import {
  TAPBACK_CONTEXT,
  tapbackDecision,
  tapbackFromReaction,
  type TapbackReaction,
} from "../lib/tapback";

type PhotonThread = { id: string };

type PhotonMessage = Parameters<typeof defaultPhotonAuth>[0] & {
  id: string;
};

type PhotonReaction = TapbackReaction & {
  added?: boolean;
  thread: PhotonThread;
  user?: {
    isBot?: boolean;
    isMe?: boolean;
    userId?: string;
    userName?: string;
  };
};

const webhookSecret = process.env.IMESSAGE_WEBHOOK_SECRET;

const adapter = createiMessageAdapter({
  credentials: async () => ({
    projectId: process.env.IMESSAGE_PROJECT_ID!,
    projectSecret: process.env.IMESSAGE_PROJECT_SECRET!,
  }),
  ...(webhookSecret
    ? { webhookSecret }
    : { webhookVerifier: vercelOidc() }),
});

export const { bot, channel, send } = chatSdkChannel({
  adapters: { imessage: adapter },
  concurrency: "concurrent",
  routes: { imessage: "/eve/v1/photon" },
  state: createMemoryState(),
  streaming: false,
  userName: "eve",
});

bot.onDirectMessage(async (thread: PhotonThread, message: PhotonMessage) => {
  await dispatchMessage(thread, message);
});

bot.onNewMessage(/[\s\S]*/, async (thread: PhotonThread, message: PhotonMessage) => {
  await dispatchMessage(thread, message);
});

bot.onReaction(async (event: PhotonReaction) => {
  const decision = tapbackFromReaction(event);
  if (!decision) return;
  if (event.added === false) return;
  const user = event.user;
  if (!user?.userId || user.isBot || user.isMe) return;

  await send(
    {
      context: [
        TAPBACK_CONTEXT,
        `The user tapbacked ${decision === "approve" ? "❤️ / 👍" : "👎"} on a message.`,
      ],
      message: decision,
    },
    {
      auth: {
        attributes: user.userName ? { user_name: user.userName } : {},
        authenticator: "photon-imessage",
        issuer: "photon",
        principalId: `photon:${user.userId}`,
        principalType: "user",
        subject: user.userId,
      },
      thread: event.thread,
    },
  );
});

export default channel;

async function dispatchMessage(thread: PhotonThread, message: PhotonMessage) {
  if (message.author.isBot) return;

  const inbound = inboundForEve(message);
  if (inbound === undefined) return;

  try {
    await adapter.markRead(thread.id, message.id);
  } catch {
    // Read receipts are best-effort.
  }

  await send(
    {
      context: [
        `The sender is ${message.author.fullName}.`,
        TAPBACK_CONTEXT,
      ],
      message: inbound,
    },
    {
      auth: defaultPhotonAuth(message),
      thread,
    },
  );
}

function inboundForEve(message: Parameters<typeof messageToUserContent>[0]) {
  const content = messageToUserContent(message);
  if (typeof content === "string") {
    const trimmed = content.trim();
    if (!trimmed) return undefined;
    return tapbackDecision(trimmed) ?? content;
  }
  return content.length > 0 ? content : undefined;
}
