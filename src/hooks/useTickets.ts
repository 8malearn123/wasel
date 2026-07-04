import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface SupportTicket {
  id: string;
  merchant_id: string;
  created_by: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  admin_reply: string | null;
  replied_by: string | null;
  replied_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  merchant?: { name: string };
}

export function useTickets() {
  const { merchant, user } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTickets = useCallback(async () => {
    if (!merchant) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false });

    if (error) console.error('Error fetching tickets:', error);
    setTickets((data || []) as SupportTicket[]);
    setLoading(false);
  }, [merchant]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const createTicket = async (subject: string, description: string, priority: SupportTicket['priority'] = 'normal') => {
    if (!merchant || !user) return { error: 'Missing data' };

    const { error } = await supabase
      .from('support_tickets')
      .insert({
        merchant_id: merchant.id,
        created_by: user.id,
        subject,
        description,
        priority,
      } as any);

    if (error) {
      toast.error(error.message);
      return { error: error.message };
    }

    toast.success('تم إرسال التذكرة بنجاح');
    await fetchTickets();
    return { error: null };
  };

  return { tickets, loading, fetchTickets, createTicket };
}

// Admin version - fetches all tickets
export function useAdminTickets() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*, merchant:merchants(name)')
      .order('created_at', { ascending: false });

    if (error) console.error('Error fetching admin tickets:', error);
    setTickets((data || []) as SupportTicket[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const replyToTicket = async (ticketId: string, reply: string, status: SupportTicket['status'] = 'resolved') => {
    const { error } = await supabase
      .from('support_tickets')
      .update({
        admin_reply: reply,
        status,
        replied_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', ticketId);

    if (error) {
      toast.error(error.message);
      return { error: error.message };
    }

    toast.success('تم الرد على التذكرة');
    await fetchTickets();
    return { error: null };
  };

  const updateTicketStatus = async (ticketId: string, status: SupportTicket['status']) => {
    const { error } = await supabase
      .from('support_tickets')
      .update({ status, updated_at: new Date().toISOString() } as any)
      .eq('id', ticketId);

    if (error) {
      toast.error(error.message);
      return { error: error.message };
    }

    await fetchTickets();
    return { error: null };
  };

  return { tickets, loading, fetchTickets, replyToTicket, updateTicketStatus };
}
