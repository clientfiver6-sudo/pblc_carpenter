"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Notification, NotificationType } from "@/types/database";

// ---------------------------------------------------------------------------
// Helper — detects "table does not exist" PostgreSQL errors
// ---------------------------------------------------------------------------

function isTableMissingError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string };
  return e.code === "42P01" || (e.message?.includes("does not exist") ?? false);
}

// ---------------------------------------------------------------------------
// createNotification — admin client (server-side, bypasses RLS)
// ---------------------------------------------------------------------------

export async function createNotification(data: {
  businessId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const admin = createAdminClient();

    const { error } = await admin.from("notifications").insert({
      business_id: data.businessId,
      type: data.type,
      title: data.title,
      body: data.body,
      link: data.link ?? null,
      read: false,
      metadata: (data.metadata ?? {}) as import("@/types/database").Json,
    });

    if (error) {
      if (isTableMissingError(error)) {
        console.warn("createNotification: notifications table does not exist yet");
        return;
      }
      console.error("createNotification: failed to insert", error);
    }
  } catch (err) {
    if (isTableMissingError(err)) {
      console.warn("createNotification: notifications table does not exist yet");
      return;
    }
    console.error("createNotification error:", err);
  }
}

// ---------------------------------------------------------------------------
// markNotificationRead — user session client (respects RLS)
// ---------------------------------------------------------------------------

export async function markNotificationRead(id: string): Promise<void> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from("notifications")
      .update({ read: true } as never)
      .eq("id", id);

    if (error) {
      if (isTableMissingError(error)) return;
      console.error("markNotificationRead: failed", error);
    }
  } catch (err) {
    if (isTableMissingError(err)) return;
    console.error("markNotificationRead error:", err);
  }
}

// ---------------------------------------------------------------------------
// markAllRead
// ---------------------------------------------------------------------------

export async function markAllRead(businessId: string): Promise<void> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from("notifications")
      .update({ read: true } as never)
      .eq("business_id", businessId)
      .eq("read", false);

    if (error) {
      if (isTableMissingError(error)) return;
      console.error("markAllRead: failed", error);
    }
  } catch (err) {
    if (isTableMissingError(err)) return;
    console.error("markAllRead error:", err);
  }
}

// ---------------------------------------------------------------------------
// getNotifications
// ---------------------------------------------------------------------------

export async function getNotifications(
  businessId: string,
  limit = 20
): Promise<Notification[]> {
  try {
    const supabase = await createClient();

    const { data: rawData, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      if (isTableMissingError(error)) return [];
      throw error;
    }

    return (rawData as Notification[] | null) ?? [];
  } catch (err) {
    if (isTableMissingError(err)) return [];
    console.error("getNotifications error:", err);
    return [];
  }
}
