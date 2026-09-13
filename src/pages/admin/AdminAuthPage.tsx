import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

const emailSchema = z.string().email('بريد إلكتروني غير صالح');
const passwordSchema = z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');

export default function AdminAuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [adminStatus, setAdminStatus] = useState<'checking' | 'admin' | 'not_admin' | 'ready'>('checking');
  const { user, signIn } = useAuth();

  useEffect(() => {
    if (!user) {
      setAdminStatus('ready');
      return;
    }
    // User is already logged in, check if they're admin
    setAdminStatus('checking');
    supabase
      .from('platform_admins')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setAdminStatus('admin');
        } else {
          // Not admin - sign out so they can log in with admin account
          supabase.auth.signOut().then(() => {
            setAdminStatus('ready');
          });
        }
      });
  }, [user]);

  if (adminStatus === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  if (adminStatus === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
        return;
      }
    }

    setLoading(true);
    try {
      const { error: signInError } = await signIn(email, password);
      if (signInError) {
        setError(
          signInError.message.includes('Invalid login')
            ? 'البريد أو كلمة المرور غير صحيحة'
            : signInError.message
        );
        setLoading(false);
        return;
      }
      // useEffect will handle admin check after user state updates
    } catch {
      setError('حدث خطأ في الاتصال');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/10 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/20">
            <Shield className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">لوحة إدارة المنصة</h1>
          <p className="text-muted-foreground mt-1 text-sm">تسجيل دخول المسؤولين فقط</p>
        </div>

        {/* Form Card */}
        <div className="bg-card rounded-xl border border-border shadow-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-5" dir="rtl">
            <div className="space-y-2">
              <Label htmlFor="admin-email" className="text-muted-foreground">البريد الإلكتروني</Label>
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="admin-email"
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pr-10 bg-background border-input text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/50"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-password" className="text-muted-foreground">كلمة المرور</Label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="admin-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10 bg-background border-input text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/50"
                  disabled={loading}
                />
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-base font-medium shadow-lg shadow-primary/20"
              disabled={loading}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'تسجيل الدخول'}
            </Button>
          </form>
        </div>

        <button
          type="button"
          onClick={() => { setEmail('demo-admin@craftphone.app'); setPassword('demo@2026'); }}
          className="w-full mt-4 py-2 px-4 rounded-lg border border-dashed border-primary/30 text-primary/80 text-sm hover:bg-primary/10 hover:text-primary transition-colors"
        > تجربة حساب ديمو
        </button>

        <p className="text-center text-xs text-muted-foreground mt-4"> هذه الصفحة مخصصة لمسؤولي المنصة فقط
        </p>
      </motion.div>
    </div>
  );
}
