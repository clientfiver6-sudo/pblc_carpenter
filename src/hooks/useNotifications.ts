"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Notification } from "@/types/database";

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  loading: boolean;
}

export function useNotifications(businessId: string): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  // Initial fetch
  useEffect(() => {
    if (!businessId) {
      setLoading(false);
      return;
    }

    const supabase = createClient();

    Promise.resolve(
      supabase
        .from("notifications")
        .select("id,business_id,type,title,body,link,read,created_at")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(20)
    )
      .then(({ data, error }) => {
        if (!error && data) {
          setNotifications(data as Notification[]);
        }
        setLoading(false);
      })
      .catch(() => {
        setNotifications([]);
        setLoading(false);
      });
  }, [businessId]);

  // Realtime subscription
  useEffect(() => {
    if (!businessId) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`notifications:${businessId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `business_id=eq.${businessId}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          setNotifications((prev) => [newNotification, ...prev].slice(0, 20));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `business_id=eq.${businessId}`,
        },
        (payload) => {
          const updated = payload.new as Notification;
          setNotifications((prev) =>
            prev.map((n) => (n.id === updated.id ? updated : n))
          );
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          // Supabase couldn't subscribe (e.g., table doesn't exist)
          // Fail silently — notifications will be empty
          console.warn("Notifications channel error — table may not exist yet");
        }
      });

    return () => {
      supabase.removeChannel(channel).catch(() => {});
    };
  }, [businessId]);

  const markRead = useCallback((id: string) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );

    // Persist via Supabase client directly (no server action needed for real-time UX)
    const supabase = createClient();
    supabase
      .from("notifications")
      .update({ read: true } as never)
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          // Roll back optimistic update on failure
          setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, read: false } : n))
          );
        }
      });
  }, []);

  const markAllRead = useCallback(() => {
    if (!businessId) return;

    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

    const supabase = createClient();
    supabase
      .from("notifications")
      .update({ read: true } as never)
      .eq("business_id", businessId)
      .eq("read", false)
      .then(({ error }) => {
        if (error) {
          // Re-fetch to restore correct state on failure
          supabase
            .from("notifications")
            .select("id,business_id,type,title,body,link,read,created_at")
            .eq("business_id", businessId)
            .order("created_at", { ascending: false })
            .limit(20)
            .then(({ data }) => {
              if (data) setNotifications(data as Notification[]);
            });
        }
      });
  }, [businessId]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, markRead, markAllRead, loading };
}
