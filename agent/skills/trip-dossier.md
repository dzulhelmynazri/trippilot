---
description: Use when planning a trip, updating dates or budget, asking for a packing list or day plan, or before saving to Notion or Calendar.
---

Persist facts with `update_trip` as soon as the user gives a destination, dates, budget, or picks a flight/hotel.

Read `get_trip` before recommending options or warning about money. Spend and over-budget are computed in code.

If `overBudget` is true, call `budget_fork` and send its `text` field. Do not invent cheaper fares or hotel prices.

For a summary, packing list, day plan, weather, map links, Book links, or Connect Links, call `trip_brief` and send its `text` field. Packing, remaining cash, landmarks, weather, Maps URLs, Ignav/Blue Pillow Book URLs, and connection links come from that tool. Flight book links are the Ignav MCP `booking_url` on each fare. Hotel book links are Blue Pillow `deeplink_url` or `CREATE_BOOKING_HANDOFF`.

`add_calendar_events` writes those day-plan stops onto Calendar after the user approves.

Never write Notion or Google Calendar through raw Composio tools. Use `save_itinerary` and `add_calendar_events` — both pause until the user approves. When they park, tell the user: reply approve or deny. After a save returns ok or skipped, do not call that write tool again. A message that is only approve or deny settles the parked call — do not start a new save. Connect Links come from those tools or `trip_brief` and are `connect.composio.dev` — never notion.so.
