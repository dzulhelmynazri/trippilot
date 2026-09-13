type BookableTrip = {
  flight?: { bookingUrl?: string };
  hotel?: { bookingUrl?: string };
};

/** Ignav / Blue Pillow URL saved on the dossier. No reconstructed search pages. */
export function flightBookUrl(dossier: BookableTrip): string | undefined {
  return dossier.flight?.bookingUrl;
}

export function hotelBookUrl(dossier: BookableTrip): string | undefined {
  return dossier.hotel?.bookingUrl;
}

/** First Ignav MCP `booking_url`, or a leftover `booking_options[].links[].url`. */
export function extractIgnavBookingUrl(payload: unknown): string | undefined {
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
    if (
      typeof record.booking_url === "string" &&
      /^https?:\/\//i.test(record.booking_url)
    ) {
      return record.booking_url;
    }
    if (typeof record.url === "string" && /^https?:\/\//i.test(record.url)) {
      if (record.provider_name !== undefined || record.provider_type !== undefined) {
        return record.url;
      }
    }
    for (const child of Object.values(record)) {
      const found = visit(child);
      if (found) return found;
    }
    return undefined;
  };
  return visit(payload);
}

/** Blue Pillow `deep_link`, `deeplink_url`, or `web_url` — pass through, never rebuild. */
export function extractBluePillowBookingUrl(payload: unknown): string | undefined {
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
    for (const key of ["deep_link", "deeplink_url", "web_url"] as const) {
      const url = record[key];
      if (typeof url === "string" && /^https?:\/\//i.test(url)) return url;
    }
    for (const child of Object.values(record)) {
      const found = visit(child);
      if (found) return found;
    }
    return undefined;
  };
  return visit(payload);
}
