import { FileCheck2, X } from 'lucide-react';
import { useLanguage } from '@/i18n';
import type { UploadReport as Report } from '@/hooks/useProductMedia';

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

/**
 * What the upload pipeline actually did to each file.
 *
 * Every number here is measured — the original file size, the size of what was
 * stored, and the difference. Nothing is estimated, and when compression did
 * not help the row says so rather than printing a flattering percentage.
 */
export function UploadReportList({ reports, onDismiss }: { reports: Report[]; onDismiss?: () => void }) {
  const { isRTL } = useLanguage();
  const t = isRTL;

  if (reports.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <FileCheck2 className="w-4 h-4 text-success" />
        <p className="text-xs font-medium text-foreground">
          {t ? 'تم الرفع' : 'Uploaded'}
        </p>
        {onDismiss && (
          <button type="button" onClick={onDismiss}
            className="ms-auto p-0.5 rounded hover:bg-muted" title={t ? 'إخفاء' : 'Dismiss'}>
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {reports.map((report, index) => (
        <div key={`${report.fileName}-${index}`} className="text-xs space-y-0.5">
          <p className="truncate font-medium text-foreground" dir="ltr">{report.fileName}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground tabular-nums">
            <span>{t ? 'الأصلي: ' : 'Original: '}{formatBytes(report.originalBytes)}</span>
            <span>{t ? 'المخزَّن: ' : 'Stored: '}{formatBytes(report.storedBytes)}</span>
            {report.savedPercent > 0 ? (
              <span className="text-success">
                {t ? `وفّرنا ${report.savedPercent}%` : `${report.savedPercent}% smaller`}
              </span>
            ) : (
              // Honest: the original was already as small as it was going to get
              <span>{t ? 'بدون تصغير — الملف صغير أصلاً' : 'Kept as-is — already small'}</span>
            )}
            {report.width && report.height && (
              <span dir="ltr">{report.width}×{report.height}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
