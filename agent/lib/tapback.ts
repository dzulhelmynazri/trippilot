/** Typed replies that settle a parked Notion/Calendar write. */
export const TAPBACK_APPROVE = ["approve", "yes"] as const;
export const TAPBACK_DENY = ["deny", "cancel", "no", "👎"] as const;

export const TAPBACK_LEGEND =
  "Reply approve to allow a pending save; reply deny to cancel.";

export const TAPBACK_CONTEXT =
  "Typed approve or deny settles a pending Notion/Calendar write. If this message is only approve or deny, do not call save_itinerary or add_calendar_events again — that reply finishes the parked write.";

const APPROVE = new Set(["approve", "yes"]);
const DENY = new Set(["deny", "cancel", "no", "👎"]);

function normalizeTapback(text: string): string {
  return text.trim().replace(/\s+/g, "_").toLowerCase();
}

/** Map a typed reply to an HITL decision. */
export function tapbackDecision(
  text: string,
): "approve" | "deny" | undefined {
  const token = normalizeTapback(text);
  if (APPROVE.has(token)) return "approve";
  if (DENY.has(token)) return "deny";
  return undefined;
}
