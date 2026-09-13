---
description: Use when planning a trip, updating dates or budget, or before saving to Notion or Calendar.
---

Persist facts with `update_trip` as soon as the user gives a destination, dates, budget, or picks a flight/hotel.

Read `get_trip` before recommending options or warning about money. Spend and over-budget are computed in code.

Never write Notion or Google Calendar through raw Composio tools. Use `save_itinerary` and `add_calendar_events` — both pause until the user approves.
