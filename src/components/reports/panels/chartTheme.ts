/**
 * One chart palette and one tooltip, for every report chart.
 *
 * The charts each inlined the same tooltip style and reached for a different
 * slice of the token set, so a revenue line was primary in one panel and
 * accent-foreground in the next. These are the identity tokens, resolved at
 * render by the browser, so both themes follow the palette.
 */
export const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent-foreground))',
  'hsl(var(--warning))',
  'hsl(var(--destructive))',
  'hsl(var(--muted-foreground))',
];

export const chartTooltip = {
  contentStyle: {
    backgroundColor: 'hsl(var(--popover))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '0.5rem',
    color: 'hsl(var(--popover-foreground))',
    fontSize: '0.8125rem',
  },
  labelStyle: { color: 'hsl(var(--muted-foreground))' },
} as const;

/**
 * The hovered-bar highlight, for a bar chart only.
 *
 * A bar chart's cursor is a filled rectangle, a line chart's is a stroked
 * line, so `fill` belongs to the first and would do nothing on the second —
 * it is a separate prop rather than part of the shared tooltip.
 */
export const barCursor = { fill: 'hsl(var(--muted) / 0.4)' } as const;
