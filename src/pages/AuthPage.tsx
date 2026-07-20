import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Smartphone, Mail, Lock, User, AlertCircle, Loader2, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

const emailSchema = z.string().email('Invalid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loginCode, setLoginCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, signIn, signUp } = useAuth();
  const { t, isRTL } = useLanguage();
  const [searchParams] = useSearchParams();
  const rawNext = searchParams.get('next');
  // Only allow same-origin relative paths.
  const nextPath = rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : null;

  if (user) {
    return <Navigate to={nextPath ?? '/'} replace />;
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
      if (!isLogin && !fullName.trim()) {
        setError('Full name is required');
        return;
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
        return;
      }
    }

    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          setError(error.message.includes('Invalid login') ? 'البريد أو كلمة المرور غير صحيحة' : error.message);
        } else {
          // Check if this is a platform admin account — redirect to admin panel
          const { data: { user: signedInUser } } = await supabase.auth.getUser();
          if (signedInUser) {
            const { data: adminRow } = await supabase
              .from('platform_admins')
              .select('id')
              .eq('user_id', signedInUser.id)
              .eq('is_active', true)
              .maybeSingle();
            const { data: merchantRow } = await supabase
              .from('merchant_users')
              .select('id')
              .eq('user_id', signedInUser.id)
              .eq('is_active', true)
              .maybeSingle();

            if (adminRow && !merchantRow) {
              await supabase.auth.signOut();
              setError('هذا حساب مدير منصة. الرجاء استخدام صفحة دخول المسؤول /admin/login');
              return;
            }
          }
        }
      } else {
        const { error } = await signUp(email, password, fullName);
        if (error) {
          setError(error.message.includes('already registered') ? 'هذا البريد مسجل مسبقاً' : error.message);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

  if (!loginCode.trim() || loginCode.trim().length !== 5) {
      setError('أدخل كود الدخول (5 أرقام)');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/login-by-code`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: loginCode.trim() }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'كود الدخول غير صحيح');
        return;
      }

      if (result.session) {
        await supabase.auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token,
        });
      }
    } catch {
      setError('حدث خطأ في الاتصال');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/brand/app-icon.svg" alt="وصل" className="w-16 h-16 rounded-2xl mx-auto mb-4 shadow-glow" />
          <img src="/brand/wordmark-ink.svg" alt="وصل" className="h-8 w-auto mx-auto dark:hidden" />
          <img src="/brand/wordmark-white.svg" alt="وصل" className="h-8 w-auto mx-auto hidden dark:block" />
          <p className="text-muted-foreground mt-2">نظام محلات الجوالات</p>
        </div>

        {/* Form Card */}
        <div className="bg-card rounded-xl border border-border shadow-lg p-6">
          <Tabs defaultValue="code" dir="rtl">
            <TabsList className="w-full mb-6">
              <TabsTrigger value="code" className="flex-1 gap-2">
                <KeyRound className="w-4 h-4" /> دخول بالكود
              </TabsTrigger>
              <TabsTrigger value="email" className="flex-1 gap-2">
                <Mail className="w-4 h-4" /> دخول بالإيميل
              </TabsTrigger>
            </TabsList>

            {/* Code Login */}
            <TabsContent value="code">
              <form onSubmit={handleCodeSubmit} className="space-y-6">
                <div className="space-y-4">
                  <Label className="text-center block text-base">كود الدخول</Label>
                  <div className="flex justify-center" dir="ltr">
                    <InputOTP
                      maxLength={5}
                      value={loginCode}
                      onChange={(value) => setLoginCode(value)}
                      disabled={loading}
                      autoFocus
                    >
                      <InputOTPGroup className="gap-2">
                        {[0, 1, 2, 3, 4].map((index) => (
                          <InputOTPSlot
                            key={index}
                            index={index}
                            className="w-14 h-14 text-2xl font-bold rounded-xl border-2 border-border shadow-sm"
                          />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    أدخل الكود اللي أعطاك إياه المدير
                  </p>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm"
                  >
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}

                <Button
                  type="submit"
                  className="w-full bg-gradient-primary hover:opacity-90 h-12 text-base"
                  disabled={loading}
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'دخول'}
                </Button>
              </form>
            </TabsContent>

            {/* Email Login */}
            <TabsContent value="email">
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                {!isLogin && (
                  <div className="space-y-2">
                    <Label htmlFor="fullName">الاسم الكامل</Label>
                    <div className="relative">
                      <User className={cn("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground", isRTL ? "right-3" : "left-3")} />
                      <Input id="fullName" type="text" placeholder="اسمك الكامل" value={fullName}
                        onChange={(e) => setFullName(e.target.value)} className={cn(isRTL ? "pr-10" : "pl-10")} disabled={loading} />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">البريد الإلكتروني</Label>
                  <div className="relative">
                    <Mail className={cn("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground", isRTL ? "right-3" : "left-3")} />
                    <Input id="email" type="email" placeholder="your@email.com" value={email}
                      onChange={(e) => setEmail(e.target.value)} className={cn(isRTL ? "pr-10" : "pl-10")} disabled={loading} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">كلمة المرور</Label>
                  <div className="relative">
                    <Lock className={cn("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground", isRTL ? "right-3" : "left-3")} />
                    <Input id="password" type="password" placeholder="••••••••" value={password}
                      onChange={(e) => setPassword(e.target.value)} className={cn(isRTL ? "pr-10" : "pl-10")} disabled={loading} />
                  </div>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm"
                  >
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}

                <Button type="submit" className="w-full bg-gradient-primary hover:opacity-90" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : isLogin ? 'تسجيل الدخول' : 'إنشاء حساب'}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <button type="button" onClick={() => { setIsLogin(!isLogin); setError(''); }}
                  className="text-sm text-primary hover:underline">
                  {isLogin ? 'ما عندك حساب؟ سجل الآن' : 'عندك حساب؟ سجل دخول'}
                </button>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {!isLogin && (
          <p className="text-center text-xs text-muted-foreground mt-4">
            تحصل على فترة تجريبية 14 يوم مع جميع المميزات.
          </p>
        )}

        {/* Demo Accounts Section */}
        <div className="mt-6 bg-card/50 rounded-xl border border-dashed border-primary/30 p-4">
          <p className="text-xs font-semibold text-primary text-center mb-3">🎯 حسابات تجريبية للديمو</p>
          <div className="space-y-2">
            {/* كاشير */}
            <button
              type="button"
              onClick={() => {
                setLoginCode('70035');
                setError('');
              }}
              className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-sm"
              dir="rtl"
            >
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">ك</span>
                <div className="text-right">
                  <span className="font-medium text-foreground">كاشير تجريبي</span>
                  <span className="block text-xs text-muted-foreground">كاشير • نقطة البيع</span>
                </div>
              </div>
              <code className="text-xs bg-primary/10 text-primary px-2 py-1 rounded font-mono">70035</code>
            </button>
            {/* حسابات الباقات */}
            {[
              { label: 'باقة لايت (Lite)', email: 'demo-basic@wasil.demo', desc: 'تجربة باقة لايت', letter: 'L', color: 'bg-blue-500/10 text-blue-600' },
              { label: 'باقة برو (Pro)', email: 'demo-enterprise@wasil.demo', desc: 'تجربة باقة برو', letter: 'P', color: 'bg-purple-500/10 text-purple-600' },
              { label: 'باقة ماكس (Max)', email: 'demo-distributor@wasil.demo', desc: 'تجربة باقة ماكس B2B', letter: 'M', color: 'bg-amber-500/10 text-amber-600' },
            ].map((p) => (
              <button
                key={p.email}
                type="button"
                onClick={() => { setEmail(p.email); setPassword('demo1234'); setIsLogin(true); setError(''); }}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-sm"
                dir="rtl"
              >
                <div className="flex items-center gap-2">
                  <span className={`w-8 h-8 rounded-full ${p.color} flex items-center justify-center text-xs font-bold`}>{p.letter}</span>
                  <div className="text-right">
                    <span className="font-medium text-foreground">{p.label}</span>
                    <span className="block text-xs text-muted-foreground">{p.desc}</span>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">demo1234</span>
              </button>
            ))}
            {/* عميل (زائر متجر) */}
            <a
              href="/store/store-1774975416728"
              className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-sm"
              dir="rtl"
            >
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center text-xs font-bold">ع</span>
                <div className="text-right">
                  <span className="font-medium text-foreground">عميل (زائر المتجر)</span>
                  <span className="block text-xs text-muted-foreground">تصفّح المتجر العام • تجربة شراء</span>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">فتح المتجر →</span>
            </a>

            {/* مدير المنصة */}
            <a
              href="/admin/login"
              className="w-full flex items-center justify-between p-3 rounded-lg bg-destructive/5 hover:bg-destructive/10 transition-colors text-sm border border-destructive/20"
              dir="rtl"
            >
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-destructive/10 text-destructive flex items-center justify-center text-xs font-bold">🛡</span>
                <div className="text-right">
                  <span className="font-medium text-foreground">مبارك (مدير المنصة)</span>
                  <span className="block text-xs text-muted-foreground">Super Admin • إدارة شاملة</span>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">صفحة دخول خاصة →</span>
            </a>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-2">اضغط على الحساب لتعبئة البيانات تلقائياً</p>
        </div>
      </motion.div>
    </div>
  );
}
