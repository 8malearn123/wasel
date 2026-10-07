import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Package, Tag, Truck } from 'lucide-react';
import { LanguageProvider } from '@/i18n';
import { SectionNav } from './SectionNav';

const groups = [
  { label: 'المخزون', items: [{ key: 'inventory', label: 'المخزون', icon: Package }] },
  {
    label: 'الشراء',
    items: [
      { key: 'suppliers', label: 'الموردين', icon: Truck },
      { key: 'labels', label: 'أكواد التحقق', icon: Tag },
    ],
  },
];

function setup(value = 'inventory', onChange = vi.fn()) {
  render(
    <LanguageProvider>
      <SectionNav groups={groups} value={value} onChange={onChange} />
    </LanguageProvider>,
  );
  return onChange;
}

beforeEach(() => {
  localStorage.setItem('language', 'ar');
});

describe('SectionNav', () => {
  it('offers every leaf in every group', () => {
    setup();
    for (const label of ['المخزون', 'الموردين', 'أكواد التحقق']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('marks only the active leaf as the current page', () => {
    setup('labels');
    expect(screen.getByRole('button', { name: 'أكواد التحقق' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'الموردين' })).not.toHaveAttribute('aria-current');
  });

  it('reports the leaf that was clicked', () => {
    const onChange = setup();
    fireEvent.click(screen.getByRole('button', { name: 'الموردين' }));
    expect(onChange).toHaveBeenCalledWith('suppliers');
  });

  it('names itself for a screen reader', () => {
    setup();
    expect(screen.getByRole('navigation', { name: 'أقسام الصفحة' })).toBeInTheDocument();
  });
});
