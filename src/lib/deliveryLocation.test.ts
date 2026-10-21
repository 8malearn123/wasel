import { describe, it, expect } from 'vitest';
import { mapsLink, locationFromAddress } from './deliveryLocation';

describe('delivery location', () => {
  it('turns a pin into a maps link', () => {
    expect(mapsLink({ lat: 24.7136, lng: 46.6753 })).toBe('https://maps.google.com/?q=24.713600,46.675300');
  });

  it('reads the pin back out of an order address', () => {
    const address = `حي النخيل، شارع 5\n📍 الموقع على الخريطة: ${mapsLink({ lat: 24.7, lng: 46.6 })}`;
    expect(locationFromAddress(address)).toEqual({
      text: 'حي النخيل، شارع 5',
      link: 'https://maps.google.com/?q=24.700000,46.600000',
    });
  });

  it('leaves an address without a pin as it is', () => {
    expect(locationFromAddress('حي العليا')).toEqual({ text: 'حي العليا', link: null });
  });
});
