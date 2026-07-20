"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeEncryptToken } from "@/lib/security/encrypt";
import type { BusinessUpdate, BusinessUserInsert, Json } from "@/types/database";

async function getAuthenticatedBusinessId(): Promise<{ businessId: string; userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data: rawData } = await supabase
    .from("business_users")
    .select("business_id")
    .eq("user_id", user.id)
    .single();
  const data = rawData as { business_id: string } | null;

  if (!data?.business_id) throw new Error("Negócio não encontrado");
  return { businessId: data.business_id, userId: user.id };
}

// ─── Business ─────────────────────────────────────────────────────────────────

export async function updateBusiness(data: Partial<BusinessUpdate>): Promise<void> {
  const { businessId } = await getAuthenticatedBusinessId();
  const supabase = await createClient();

  const updateData = { ...data };
  if (updateData.whatsapp_number) {
    updateData.whatsapp_number = updateData.whatsapp_number.replace(/[^\d+]/g, "");
  }
  if (updateData.phone) {
    updateData.phone = updateData.phone.replace(/[^\d+]/g, "");
  }

  const { error } = await supabase
    .from("businesses")
    .update({ ...updateData, updated_at: new Date().toISOString() } as never)
    .eq("id", businessId);

  if (error) throw new Error("Erro ao atualizar negócio");
  revalidatePath("/dashboard/settings");
}

// ─── WhatsApp ─────────────────────────────────────────────────────────────────

export async function saveWhatsAppSettings(data: {
  whatsapp_token: string;
  whatsapp_phone_id: string;
}): Promise<void> {
  const { businessId } = await getAuthenticatedBusinessId();
  const supabase = await createClient();

  const { error } = await supabase
    .from("businesses")
    .update({
      whatsapp_token: safeEncryptToken(data.whatsapp_token),
      whatsapp_phone_id: data.whatsapp_phone_id,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", businessId);

  if (error) throw new Error("Erro ao salvar configurações do WhatsApp");
  revalidatePath("/dashboard/settings");
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export async function savePaymentSettings(data: {
  pix_key?: string;
  pix_key_type?: string;
  mercadopago_access_token?: string;
}): Promise<void> {
  const { businessId } = await getAuthenticatedBusinessId();
  const supabase = await createClient();

  const updateData: Partial<BusinessUpdate> = {
    updated_at: new Date().toISOString(),
  };

  if (data.pix_key !== undefined) updateData.pix_key = data.pix_key;
  if (data.pix_key_type !== undefined) updateData.pix_key_type = data.pix_key_type;
  if (data.mercadopago_access_token !== undefined)
    updateData.mercadopago_access_token = safeEncryptToken(data.mercadopago_access_token);

  const { error } = await supabase
    .from("businesses")
    .update(updateData as never)
    .eq("id", businessId);

  if (error) throw new Error("Erro ao salvar configurações de pagamento");
  revalidatePath("/dashboard/settings");
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function updateNotificationSettings(
  notifSettings: Record<string, boolean>
): Promise<void> {
  const { businessId } = await getAuthenticatedBusinessId();
  const supabase = await createClient();

  const { data: rawBusiness, error: fetchError } = await supabase
    .from("businesses")
    .select("settings")
    .eq("id", businessId)
    .single();
  const business = rawBusiness as { settings: Json } | null;

  if (fetchError || !business) throw new Error("Negócio não encontrado");

  const currentSettings =
    typeof business.settings === "object" && business.settings !== null
      ? (business.settings as Record<string, unknown>)
      : {};

  const updatedSettings = {
    ...currentSettings,
    notifications: notifSettings,
  };

  const { error } = await supabase
    .from("businesses")
    .update({ settings: updatedSettings, updated_at: new Date().toISOString() } as never)
    .eq("id", businessId);

  if (error) throw new Error("Erro ao salvar preferências de notificação");
  revalidatePath("/dashboard/settings");
}

// ─── FAQs ─────────────────────────────────────────────────────────────────────

export async function createFaq(data: { question: string; answer: string }): Promise<void> {
  const { businessId } = await getAuthenticatedBusinessId();
  const supabase = await createClient();

  const { error } = await supabase.from("business_faqs").insert({
    business_id: businessId,
    question: data.question,
    answer: data.answer,
    active: true,
  } as never);

  if (error) throw new Error("Erro ao criar pergunta");
  revalidatePath("/dashboard/settings");
}

export async function updateFaq(
  id: string,
  data: { question?: string; answer?: string }
): Promise<void> {
  const { businessId } = await getAuthenticatedBusinessId();
  const supabase = await createClient();

  const { error } = await supabase
    .from("business_faqs")
    .update(data as never)
    .eq("id", id)
    .eq("business_id", businessId);

  if (error) throw new Error("Erro ao atualizar pergunta");
  revalidatePath("/dashboard/settings");
}

export async function deleteFaq(id: string): Promise<void> {
  const { businessId } = await getAuthenticatedBusinessId();
  const supabase = await createClient();

  const { error } = await supabase
    .from("business_faqs")
    .delete()
    .eq("id", id)
    .eq("business_id", businessId);

  if (error) throw new Error("Erro ao excluir pergunta");
  revalidatePath("/dashboard/settings");
}

export async function toggleFaqActive(id: string, active: boolean): Promise<void> {
  const { businessId } = await getAuthenticatedBusinessId();
  const supabase = await createClient();

  const { error } = await supabase
    .from("business_faqs")
    .update({ active } as never)
    .eq("id", id)
    .eq("business_id", businessId);

  if (error) throw new Error("Erro ao alterar status da pergunta");
  revalidatePath("/dashboard/settings");
}

// ─── Voice ────────────────────────────────────────────────────────────────

export async function saveVoiceSettings(data: {
  twilio_account_sid: string
  twilio_auth_token: string
  twilio_phone_number: string
  voice_enabled: boolean
}): Promise<{ error?: string }> {
  try {
    const { businessId } = await getAuthenticatedBusinessId()
    const supabase = await createClient()

    // Fetch current settings to merge (jsonb field)
    const { data: rawBusiness, error: fetchError } = await supabase
      .from("businesses")
      .select("settings")
      .eq("id", businessId)
      .single()
    const business = rawBusiness as { settings: Json } | null

    if (fetchError || !business) return { error: "Negócio não encontrado" }

    const currentSettings =
      typeof business.settings === "object" && business.settings !== null
        ? (business.settings as Record<string, unknown>)
        : {}

    const updatedSettings = {
      ...currentSettings,
      twilio_account_sid: data.twilio_account_sid,
      twilio_auth_token: data.twilio_auth_token,
      twilio_phone_number: data.twilio_phone_number,
      voice_enabled: data.voice_enabled,
    }

    const { error } = await supabase
      .from("businesses")
      .update({ settings: updatedSettings, updated_at: new Date().toISOString() } as never)
      .eq("id", businessId)

    if (error) return { error: error.message }

    revalidatePath("/dashboard/settings/voice")
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao salvar" }
  }
}

// ─── Team ─────────────────────────────────────────────────────────────────────

export async function inviteTeamMember(
  email: string,
  role: "manager" | "staff"
): Promise<void> {
  const { businessId } = await getAuthenticatedBusinessId();
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { role, business_id: businessId },
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
  });

  if (error || !data.user) throw new Error("Erro ao convidar membro");

  await admin.from("business_users").insert({
    business_id: businessId,
    user_id: data.user.id,
    role,
  } as unknown as BusinessUserInsert);

  revalidatePath("/dashboard/settings");
}

export async function updateTeamMemberRole(
  businessUserId: string,
  role: "manager" | "staff"
): Promise<void> {
  const { businessId } = await getAuthenticatedBusinessId();
  const supabase = await createClient();

  const { error } = await supabase
    .from("business_users")
    .update({ role } as never)
    .eq("id", businessUserId)
    .eq("business_id", businessId)
    .neq("role", "owner");

  if (error) throw new Error("Erro ao atualizar função do membro");
  revalidatePath("/dashboard/settings");
}

export async function removeTeamMember(businessUserId: string): Promise<void> {
  const { businessId } = await getAuthenticatedBusinessId();
  const supabase = await createClient();

  const { error } = await supabase
    .from("business_users")
    .delete()
    .eq("id", businessUserId)
    .eq("business_id", businessId)
    .neq("role", "owner");

  if (error) throw new Error("Erro ao remover membro");
  revalidatePath("/dashboard/settings");
}

// ─── Call Returns (Retorno de Ligações) ─────────────────────────────────────────

export async function saveCallReturnSettings(
  formData: FormData
): Promise<{ ok?: true; error?: string }> {
  try {
    const { businessId } = await getAuthenticatedBusinessId();
    const supabase = await createClient();

    const voiceNumber = String(formData.get("voice_number") ?? "").trim().replace(/[^\d+]/g, "");
    const enabled = formData.get("call_return_enabled") === "true";
    const template = String(formData.get("call_return_template") ?? "").trim();

    const { error } = await supabase
      .from("businesses")
      .update({
        voice_number: voiceNumber || null,
        call_return_enabled: enabled,
        call_return_template: template || null,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", businessId);

    if (error) return { error: error.message };

    revalidatePath("/dashboard/settings/calls");
    revalidatePath("/dashboard/calls");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao salvar" };
  }
}
