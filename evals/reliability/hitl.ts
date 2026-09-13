export const SAVE_ITINERARY_PROMPT =
  "Persist this trip now: destination Tokyo, origin Kuala Lumpur, depart 2026-04-10, return 2026-04-13, budget 2000. Then immediately save the itinerary to Notion with save_itinerary.";

export function approvalOptionId(
  request: {
    options?: readonly { id: string; style?: string }[];
  },
  decision: "approve" | "deny",
): string {
  const options = request.options ?? [];
  if (decision === "approve") {
    return (
      options.find((option) => option.id === "approve")?.id ??
      options.find((option) => option.style === "primary")?.id ??
      "approve"
    );
  }
  return (
    options.find((option) => option.id === "deny" || option.id === "cancel")
      ?.id ??
    options.find((option) => option.style === "danger")?.id ??
    "deny"
  );
}
