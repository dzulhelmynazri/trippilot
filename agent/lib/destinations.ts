export type PlaybookStop = {
  name: string;
  mapsQuery: string;
};

const TOKYO: PlaybookStop[] = [
  { name: "Shibuya Crossing", mapsQuery: "Shibuya Crossing Tokyo" },
  { name: "Senso-ji Temple", mapsQuery: "Senso-ji Temple Asakusa Tokyo" },
  { name: "Meiji Jingu", mapsQuery: "Meiji Jingu Shrine Tokyo" },
  { name: "Tsukiji Outer Market", mapsQuery: "Tsukiji Outer Market Tokyo" },
  { name: "Tokyo Skytree", mapsQuery: "Tokyo Skytree" },
];

export function playbookStops(destination?: string): PlaybookStop[] {
  const key = (destination ?? "").toLowerCase();
  if (/tokyo|japan/.test(key)) return TOKYO;
  if (!destination) return [];
  return [
    {
      name: `${destination} city center`,
      mapsQuery: `${destination} city center`,
    },
    {
      name: `${destination} old town`,
      mapsQuery: `${destination} historic center`,
    },
  ];
}
