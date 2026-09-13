export type TripWeather = {
  source: "forecast" | "typical";
  summary: string;
  highC?: number;
  lowC?: number;
  wetDays: number;
};

type DailySlice = {
  temperature_2m_max?: number[];
  temperature_2m_min?: number[];
  precipitation_sum?: number[];
};

export async function fetchTripWeather(input: {
  destination?: string;
  departDate?: string;
  returnDate?: string;
}): Promise<TripWeather | undefined> {
  if (!input.destination || !input.departDate) return undefined;

  const end = input.returnDate ?? input.departDate;
  const geo = await geocode(input.destination);
  if (!geo) return undefined;

  const past = Date.parse(`${input.departDate}T00:00:00Z`) < Date.now() - 86_400_000;
  const far =
    Date.parse(`${input.departDate}T00:00:00Z`) > Date.now() + 14 * 86_400_000;

  if (!past && !far) {
    const forecast = await daily(
      `https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lon}&start_date=${input.departDate}&end_date=${end}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`,
    );
    const weather = summarize(forecast, "forecast");
    if (weather) return weather;
  }

  const typicalStart = past ? input.departDate : shiftYear(input.departDate, -1);
  const typicalEnd = past ? end : shiftYear(end, -1);
  const archive = await daily(
    `https://archive-api.open-meteo.com/v1/archive?latitude=${geo.lat}&longitude=${geo.lon}&start_date=${typicalStart}&end_date=${typicalEnd}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`,
  );
  return summarize(archive, "typical");
}

async function geocode(
  name: string,
): Promise<{ lat: number; lon: number } | undefined> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1`;
  const json = await getJson(url);
  const hit = (json?.results as { latitude?: number; longitude?: number }[] | undefined)?.[0];
  if (hit?.latitude === undefined || hit.longitude === undefined) return undefined;
  return { lat: hit.latitude, lon: hit.longitude };
}

async function daily(url: string): Promise<DailySlice | undefined> {
  const json = await getJson(url);
  return json?.daily as DailySlice | undefined;
}

function summarize(
  daily: DailySlice | undefined,
  source: TripWeather["source"],
): TripWeather | undefined {
  const highs = daily?.temperature_2m_max?.filter((value) => Number.isFinite(value));
  const lows = daily?.temperature_2m_min?.filter((value) => Number.isFinite(value));
  if (!highs?.length || !lows?.length) return undefined;
  const wetDays = (daily?.precipitation_sum ?? []).filter((value) => value > 1).length;
  const highC = Math.round(Math.max(...highs));
  const lowC = Math.round(Math.min(...lows));
  const rain = wetDays > 0 ? `${wetDays} wet day(s)` : "Mostly dry";
  return {
    source,
    highC,
    lowC,
    wetDays,
    summary: `${rain}, ${lowC}–${highC}°C`,
  };
}

function shiftYear(value: string, delta: number): string {
  const year = Number(value.slice(0, 4)) + delta;
  return `${year}${value.slice(4)}`;
}

async function getJson(url: string): Promise<Record<string, unknown> | undefined> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) return undefined;
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}
