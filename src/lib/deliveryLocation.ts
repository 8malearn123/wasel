export interface DeliveryPoint {
  lat: number;
  lng: number;
}

/** A Google Maps link the shop can open on any phone to find the customer. */
export const mapsLink = (p: DeliveryPoint) =>
  `https://maps.google.com/?q=${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;

/** The maps link a checkout appended to an order's address, if there is one. */
export function locationFromAddress(address: string | null | undefined): { text: string; link: string | null } {
  const m = (address ?? '').match(/https:\/\/maps\.google\.com\/\?q=[-\d.]+,[-\d.]+/);
  if (!m) return { text: address ?? '', link: null };
  const text = (address ?? '').replace(/\n?📍[^\n]*$/, '').replace(m[0], '').trim();
  return { text, link: m[0] };
}
