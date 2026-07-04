import { motion } from 'framer-motion';
import { AlertTriangle, Key, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n';

export default function LockedPage() {
  const [code, setCode] = useState('');
  const { activateWithCode, loading, daysRemaining, isTrialExpired } = useSubscription();
  const { signOut, merchant } = useAuth();
  const { isRTL } = useLanguage();

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim()) {
      await activateWithCode(code.trim());
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-destructive/5 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md text-center"
      >
        <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-10 h-10 text-destructive" />
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">
          {isTrialExpired ? 'Trial Period Ended' : 'Subscription Expired'}
        </h1>
        
        <p className="text-muted-foreground mb-8">
          {isTrialExpired 
            ? 'Your 14-day free trial has ended. Enter an activation code to continue using the system.'
            : 'Your subscription has expired. Please renew to continue using the system.'}
        </p>

        <div className="bg-card rounded-xl border border-border shadow-lg p-6 mb-6">
          <h2 className="font-semibold text-foreground mb-4 flex items-center justify-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            Enter Activation Code
          </h2>

          <form onSubmit={handleActivate} className="space-y-4">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ACTIVATE-30"
              className="text-center font-mono text-lg"
              disabled={loading}
            />
            
            <Button
              type="submit"
              className="w-full bg-gradient-primary hover:opacity-90"
              disabled={loading || !code.trim()}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Activate Subscription'
              )}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground mt-4">
            Contact your administrator or sales representative to get an activation code.
          </p>
        </div>

        <div className="bg-muted/30 rounded-lg p-4 mb-6">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{merchant?.name}</span>
            <br />
            Store ID: {merchant?.id?.slice(0, 8)}...
          </p>
        </div>

        <Button
          variant="ghost"
          onClick={signOut}
          className="text-muted-foreground hover:text-foreground"
        >
          Sign Out
        </Button>
      </motion.div>
    </div>
  );
}
