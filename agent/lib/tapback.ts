/** iMessage tapback glyphs and Photon names for a pending write. */
export const TAPBACK_APPROVE = ["❤️", "❤", "👍"] as const;
export const TAPBACK_DENY = ["👎"] as const;

export const TAPBACK_LEGEND =
  "Tap ❤️ / 👍 or reply approve to allow a pending save; tap 👎 or reply deny to cancel.";

export const TAPBACK_CONTEXT =
  "iMessage tapbacks settle a pending Notion/Calendar write: ❤️ or 👍 means approve; 👎 means deny. The user can also reply approve or deny.";

const APPROVE = new Set([
  "❤️",
  "❤",
  "♥️",
  "👍",
  "heart",
  "love",
  "thumbs_up",
  "like",
  "approve",
  "yes",
]);

const DENY = new Set([
  "👎",
  "thumbs_down",
  "dislike",
  "deny",
  "cancel",
  "no",
]);

function normalizeTapback(text: string): string {
  return text
    .trim()
    .replace(/\ufe0f/g, "")
    .replace(/\s+/g, "_")
    .toLowerCase();
}

/** Map a tapback glyph, Photon name, or typed reply to an HITL decision. */
export function tapbackDecision(
  text: string,
): "approve" | "deny" | undefined {
  const token = normalizeTapback(text);
  if (APPROVE.has(token) || APPROVE.has(text.trim())) return "approve";
  if (DENY.has(token) || DENY.has(text.trim())) return "deny";
  return undefined;
}

export type TapbackReaction = {
  emoji?: string | { name?: string };
  rawEmoji?: string;
};

/** Map a Chat SDK / Photon inbound reaction to approve or deny. */
export function tapbackFromReaction(
  event: TapbackReaction,
): "approve" | "deny" | undefined {
  const name = typeof event.emoji === "string" ? event.emoji : event.emoji?.name;
  return (
    (name ? tapbackDecision(name) : undefined) ??
    (event.rawEmoji ? tapbackDecision(event.rawEmoji) : undefined)
  );
}
