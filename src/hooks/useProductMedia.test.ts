import { describe, it, expect } from 'vitest';
import { validateImageFile } from './useProductMedia';

const fileOf = (type: string, bytes: number) => {
  const file = new File(['x'], 'photo', { type });
  Object.defineProperty(file, 'size', { value: bytes });
  return file;
};

describe('validateImageFile', () => {
  it('accepts the formats the bucket accepts', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/avif']) {
      expect(validateImageFile(fileOf(type, 1024))).toBeNull();
    }
  });

  it('refuses a type the bucket would reject anyway', () => {
    // a PDF or an SVG renamed to .jpg is the usual way a bad upload arrives;
    // SVG in particular can carry script
    for (const type of ['application/pdf', 'image/svg+xml', 'text/html', '']) {
      expect(validateImageFile(fileOf(type, 1024))).toBeTruthy();
    }
  });

  it('refuses a file over the size limit', () => {
    expect(validateImageFile(fileOf('image/jpeg', 10 * 1024 * 1024 + 1))).toContain('10');
    expect(validateImageFile(fileOf('image/jpeg', 10 * 1024 * 1024))).toBeNull();
  });
});
