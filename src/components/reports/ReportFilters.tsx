import { AlertTriangle, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useLanguage } from '@/i18n';
import {
  activeFilters, filterOptions,
  type ReportColumn, type ReportDefinition, type ReportState,
} from '@/lib/reportEngine';

/** The sentinel a Select uses for "no filter", since it cannot hold '' */
const ANY = '__any__';

interface Props<Row> {
  definition: ReportDefinition<Row>;
  /** every row, before filtering — the dropdowns list what the data contains */
  rows: Row[];
  state: ReportState;
  onChange: (next: Partial<ReportState>) => void;
  invalidRange?: boolean;
}

/**
 * The search and filter bar of a report.
 *
 * Everything here comes from the definition, so a report never shows a filter
 * it has no column for: no date range without a dateKey, and no category
 * dropdown on a report with no category. The options inside each dropdown come
 * from the rows, so they cannot drift from the data the way a hardcoded list
 * does.
 */
export function ReportFilters<Row>({ definition, rows, state, onChange, invalidRange }: Props<Row>) {
  const { isRTL } = useLanguage();
  const t = isRTL;

  const filterable = definition.columns.filter(c => c.filterable);
  const chips = activeFilters(definition, state, {
    search: t ? 'بحث' : 'Search',
    from: t ? 'من' : 'From',
    to: t ? 'إلى' : 'To',
  });

  const clearChip = (chip: (typeof chips)[number]) => {
    if (chip.kind === 'search') return onChange({ search: '' });
    if (chip.kind === 'from') return onChange({ from: null });
    if (chip.kind === 'to') return onChange({ to: null });
    const next = { ...state.filters };
    delete next[chip.key!];
    onChange({ filters: next });
  };

  const clearAll = () =>
    onChange({ search: '', from: null, to: null, filters: {} });

  const setFilter = (column: ReportColumn<Row>, value: string) => {
    const next = { ...state.filters };
    if (value === ANY) delete next[column.key];
    else next[column.key] = value;
    onChange({ filters: next });
  };

  const searchHint = definition.columns
    .filter(c => !c.notSearchable && (c.type ?? 'text') === 'text')
    .slice(0, 3)
    .map(c => c.header)
    .join(' · ');

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card/60 p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-[200px] flex-1 sm:max-w-sm">
          <Label htmlFor={`search-${definition.key}`} className="mb-1 block text-xs text-muted-foreground">
            {t ? 'بحث' : 'Search'}
          </Label>
          <Search className="pointer-events-none absolute bottom-0 start-3 h-4 w-4 translate-y-[-0.75rem] text-muted-foreground" />
          <Input
            id={`search-${definition.key}`}
            value={state.search}
            onChange={e => onChange({ search: e.target.value })}
            placeholder={searchHint || (t ? 'ابحث في التقرير' : 'Search this report')}
            className="h-10 ps-9"
          />
        </div>

        {filterable.map(column => {
          const options = filterOptions(column, rows);
          if (options.length < 2) return null;
          return (
            <div key={column.key} className="min-w-[150px]">
              <Label className="mb-1 block text-xs text-muted-foreground">
                {column.filterLabel ?? column.header}
              </Label>
              <Select
                value={state.filters[column.key] ?? ANY}
                onValueChange={v => setFilter(column, v)}
              >
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>{t ? 'الكل' : 'All'}</SelectItem>
                  {options.map(option => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}

        {definition.dateKey && (
          <>
            <div>
              <Label htmlFor={`from-${definition.key}`} className="mb-1 block text-xs text-muted-foreground">
                {t ? 'من تاريخ' : 'From'}
              </Label>
              <Input
                id={`from-${definition.key}`}
                type="date"
                max={state.to ?? undefined}
                value={state.from ?? ''}
                className="h-10"
                aria-invalid={invalidRange || undefined}
                onChange={e => onChange({ from: e.target.value || null })}
              />
            </div>
            <div>
              <Label htmlFor={`to-${definition.key}`} className="mb-1 block text-xs text-muted-foreground">
                {t ? 'إلى تاريخ' : 'To'}
              </Label>
              <Input
                id={`to-${definition.key}`}
                type="date"
                min={state.from ?? undefined}
                value={state.to ?? ''}
                className="h-10"
                aria-invalid={invalidRange || undefined}
                onChange={e => onChange({ to: e.target.value || null })}
              />
            </div>
          </>
        )}
      </div>

      {invalidRange && (
        <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {t
            ? 'تاريخ البداية بعد تاريخ النهاية — صحّح النطاق لعرض النتائج.'
            : 'The start date is after the end date — fix the range to see results.'}
        </p>
      )}

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
          <span className="text-xs text-muted-foreground">{t ? 'التصفية النشطة' : 'Active filters'}</span>
          {chips.map(chip => (
            <Badge key={`${chip.kind}-${chip.key ?? ''}`} variant="secondary" className="gap-1.5 ps-2.5 font-normal">
              <span className="text-muted-foreground">{chip.label}:</span>
              <span className="max-w-[12rem] truncate">{chip.value}</span>
              <button
                type="button"
                onClick={() => clearChip(chip)}
                aria-label={`${t ? 'إزالة' : 'Remove'} ${chip.label}`}
                className="rounded-full p-0.5 hover:bg-background/60"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Button variant="ghost" size="sm" className="ms-auto h-7 gap-1 text-xs" onClick={clearAll}>
            <X className="h-3.5 w-3.5" />
            {t ? 'إعادة تعيين الكل' : 'Reset all'}
          </Button>
        </div>
      )}
    </div>
  );
}
