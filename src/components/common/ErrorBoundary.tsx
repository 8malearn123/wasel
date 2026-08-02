import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// حاجز أخطاء: بدل ما تطلع صفحة بيضاء فاضية لو صار خطأ في أي صفحة،
// نعرض رسالة واضحة مع أزرار إعادة المحاولة والرجوع
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6" dir="rtl">
        <div className="max-w-md w-full bg-card border rounded-2xl shadow-lg p-8 text-center">
          <h1 className="text-xl font-bold text-foreground mb-2">صار خطأ في عرض هذه الصفحة</h1>
          <p className="text-sm text-muted-foreground mb-6"> جرّب تحديث الصفحة، وإذا تكررت المشكلة ارجع للوحة التحكم وتواصل مع الدعم الفني.
          </p>
          <div className="flex gap-2 justify-center flex-wrap">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
            > تحديث الصفحة
            </button>
            <button
              type="button"
              onClick={() => { window.location.href = "/"; }}
              className="px-5 py-2.5 rounded-xl border font-semibold text-sm hover:bg-muted transition-colors"
            > لوحة التحكم
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground/70 mt-5 font-mono break-words" dir="ltr">
            {this.state.error.message?.slice(0, 200)}
          </p>
        </div>
      </div>
    );
  }
}
