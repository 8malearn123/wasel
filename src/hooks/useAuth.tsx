import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { MerchantUser, Merchant, Subscription, Branch } from '@/types/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  merchantUser: MerchantUser | null;
  merchant: Merchant | null;
  subscription: Subscription | null;
  branches: Branch[];
  currentBranch: Branch | null;
  setCurrentBranch: (branch: Branch) => void;
  loading: boolean;
  isLocked: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshMerchantData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [merchantUser, setMerchantUser] = useState<MerchantUser | null>(null);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(true);

  const isLocked = subscription?.status === 'expired' || 
    (subscription?.status === 'trial' && subscription?.trial_ends_at && new Date(subscription.trial_ends_at) < new Date());

  const fetchMerchantData = async (userId: string) => {
    try {
      // Get merchant user
      const { data: merchantUserData } = await supabase
        .from('merchant_users')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

      if (merchantUserData) {
        setMerchantUser(merchantUserData as MerchantUser);

        // Get merchant
        const { data: merchantData } = await supabase
          .from('merchants')
          .select('*')
          .eq('id', merchantUserData.merchant_id)
          .maybeSingle();

        if (merchantData) {
          setMerchant(merchantData as Merchant);
        }

        // Get subscription
        const { data: subData } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('merchant_id', merchantUserData.merchant_id)
          .maybeSingle();

        if (subData) {
          setSubscription(subData as Subscription);
        }

        // Get branches
        const { data: branchesData } = await supabase
          .from('branches')
          .select('*')
          .eq('merchant_id', merchantUserData.merchant_id)
          .eq('is_active', true)
          .order('name');

        if (branchesData) {
          setBranches(branchesData as Branch[]);
          // Set default branch
          if (merchantUserData.branch_id) {
            const userBranch = branchesData.find(b => b.id === merchantUserData.branch_id);
            setCurrentBranch(userBranch as Branch || branchesData[0] as Branch);
          } else if (branchesData.length > 0) {
            setCurrentBranch(branchesData[0] as Branch);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching merchant data:', error);
    }
  };

  const refreshMerchantData = async () => {
    if (user) {
      await fetchMerchantData(user.id);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Defer Supabase calls
          setTimeout(() => {
            fetchMerchantData(session.user.id);
          }, 0);
        } else {
          setMerchantUser(null);
          setMerchant(null);
          setSubscription(null);
          setBranches([]);
          setCurrentBranch(null);
        }
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchMerchantData(session.user.id);
      }
      setLoading(false);
    });

    return () => authSub.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { full_name: fullName }
      }
    });

    if (!error && data.user) {
      // Create merchant and setup for new user
      const { data: merchantData, error: merchantError } = await supabase
        .from('merchants')
        .insert({ name: `${fullName}'s Store`, email })
        .select()
        .single();

      if (!merchantError && merchantData) {
        // Create default branch
        const { data: branchData } = await supabase
          .from('branches')
          .insert({
            merchant_id: merchantData.id,
            name: 'Main Store',
            is_warehouse: false
          })
          .select()
          .single();

        // Create merchant_user with owner role
        await supabase
          .from('merchant_users')
          .insert({
            merchant_id: merchantData.id,
            user_id: data.user.id,
            role: 'owner',
            branch_id: branchData?.id
          });

        // Create trial subscription
        const trialEnds = new Date();
        trialEnds.setDate(trialEnds.getDate() + 14);
        
        await supabase
          .from('subscriptions')
          .insert({
            merchant_id: merchantData.id,
            plan: 'trial',
            status: 'trial',
            trial_ends_at: trialEnds.toISOString(),
            max_branches: 1,
            max_users: 3
          });
      }
    }

    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      merchantUser,
      merchant,
      subscription,
      branches,
      currentBranch,
      setCurrentBranch,
      loading,
      isLocked,
      signIn,
      signUp,
      signOut,
      refreshMerchantData
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
