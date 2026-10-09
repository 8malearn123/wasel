import type { ReactNode } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

export interface PanelColumn<Row> {
  key: string;
  header: string;
  align?: 'start' | 'center' | 'end';
  /** monospace and Latin order, for an identifier */
  mono?: boolean;
  numeric?: boolean;
  cell: (row: Row, index: number) => ReactNode;
}

/**
 * The read-only table a dashboard panel shows.
 *
 * The panels each hand-rolled a `<table>` with their own padding, header
 * shade and hover, so the five of them drifted apart. This is the one shape:
 * a sticky header, light dividers, a single hover tint, and the same row
 * height as the exportable reports.
 */
export function PanelTable<Row>({
  columns, rows, rowKey, maxHeight = '28rem',
}: {
  columns: PanelColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row, index: number) => string;
  maxHeight?: string;
}) {
  return (
    <div className="overflow-auto" style={{ maxHeight }}>
      <Table>
        <TableHeader className="sticky top-0 z-10">
          <TableRow className="border-border bg-muted/80 backdrop-blur hover:bg-muted/80">
            {columns.map(column => (
              <TableHead
                key={column.key}
                className={cn(
                  'h-11 whitespace-nowrap px-4 text-xs font-semibold text-foreground',
                  column.align === 'center' && 'text-center',
                  column.align === 'end' && 'text-end',
                )}
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={rowKey(row, index)} className="border-border/60">
              {columns.map(column => (
                <TableCell
                  key={column.key}
                  className={cn(
                    'h-12 max-w-[20rem] truncate px-4 py-2',
                    column.align === 'center' && 'text-center',
                    column.align === 'end' && 'text-end',
                    column.numeric && 'tabular-nums',
                    column.mono && 'font-mono text-xs',
                  )}
                >
                  {column.cell(row, index)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
