import { remainingUsd, withBudget, type TripDossier } from "./trip";

export type BudgetForkId = "keep_hotel" | "keep_flight";

export type BudgetForkPlan = {
  id: BudgetForkId;
  title: string;
  keep: string;
  change: string;
  targetFlightUsd: number;
  targetHotelUsd: number;
  remainingUsd: number;
  stillOver: boolean;
};

function usd(amount: number): string {
  return `$${Math.round(amount)}`;
}

function pickLabel(
  pick: TripDossier["flight"] | TripDossier["hotel"],
  kind: "Flight" | "Hotel",
): string {
  if (!pick) return `No ${kind.toLowerCase()} yet`;
  return pick.priceUsd === undefined
    ? `${kind} ${pick.name}`
    : `${kind} ${pick.name} (${usd(pick.priceUsd)})`;
}

/** Two recut plans when the dossier is over budget. Prices come from the dossier only. */
export function budgetForks(dossier: TripDossier): BudgetForkPlan[] {
  const ready = withBudget(dossier);
  const budget = ready.budgetUsd;
  if (budget === undefined || !ready.overBudget) return [];

  const flight = ready.flight?.priceUsd ?? 0;
  const hotel = ready.hotel?.priceUsd ?? 0;

  const keepHotelFlight = Math.max(0, budget - hotel);
  const keepHotelRemaining = budget - keepHotelFlight - hotel;
  const keepHotel: BudgetForkPlan = {
    id: "keep_hotel",
    title: "Keep the hotel, recut the flight",
    keep: pickLabel(ready.hotel, "Hotel"),
    change: `Find a flight at or under ${usd(keepHotelFlight)}`,
    targetFlightUsd: keepHotelFlight,
    targetHotelUsd: hotel,
    remainingUsd: keepHotelRemaining,
    stillOver: hotel > budget,
  };

  const keepFlightHotel = Math.max(0, budget - flight);
  const keepFlightRemaining = budget - flight - keepFlightHotel;
  const keepFlight: BudgetForkPlan = {
    id: "keep_flight",
    title: "Keep the flight, recut the hotel",
    keep: pickLabel(ready.flight, "Flight"),
    change:
      flight > budget
        ? `This flight alone is ${usd(flight - budget)} over. Drop it or find a fare at or under ${usd(budget)}.`
        : `Find a hotel at or under ${usd(keepFlightHotel)}`,
    targetFlightUsd: flight,
    targetHotelUsd: keepFlightHotel,
    remainingUsd: keepFlightRemaining,
    stillOver: flight > budget,
  };

  return [keepHotel, keepFlight];
}

export function budgetForkText(
  dossier: TripDossier,
  plans: readonly BudgetForkPlan[] = budgetForks(dossier),
): string {
  const ready = withBudget(dossier);
  const leftover = remainingUsd(ready);
  const header =
    ready.budgetUsd === undefined
      ? "OVER BUDGET"
      : `OVER BUDGET · ${usd(ready.spentUsd)} / ${usd(ready.budgetUsd)}${
          leftover === undefined ? "" : ` · ${usd(leftover)} left`
        }`;

  if (plans.length === 0) {
    return `✅ On budget${
      ready.budgetUsd === undefined ? "" : ` · ${usd(ready.spentUsd)} / ${usd(ready.budgetUsd)}`
    }. No recut needed.`;
  }

  return [
    `⚠️ ${header}`,
    "",
    ...plans.flatMap((plan, index) => [
      `Plan ${index === 0 ? "A" : "B"} — ${plan.title}`,
      `• Keep: ${plan.keep}`,
      `• Change: ${plan.change}`,
      `• Targets: flight ${usd(plan.targetFlightUsd)} · hotel ${usd(plan.targetHotelUsd)}${
        plan.stillOver ? " · still over" : ""
      }`,
      "",
    ]),
    "Reply A or B and I will persist the recut. I will not invent new prices.",
  ].join("\n");
}
