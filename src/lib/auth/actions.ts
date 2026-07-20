"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendWelcomeEmail } from "@/lib/email";
const signInSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

const signUpSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

export type AuthActionResult = {
  error?: string;
  success?: boolean;
  redirect?: string;
};

export async function signIn(formData: FormData): Promise<AuthActionResult> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const { allowed } = await checkRateLimit(`signin:${parsed.data.email.toLowerCase()}`, 5, 300_000)
  if (!allowed) return { error: "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente." }

  const supabase = await createClient();
  const { data: signInData, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    if (error.message?.includes("Email not confirmed")) {
      return { error: "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada." };
    }
    return { error: "E-mail ou senha incorretos" };
  }

  revalidatePath("/", "layout");
  if (signInData.user?.app_metadata?.is_admin) {
    return { redirect: "/admin" };
  }
  return { redirect: "/dashboard" };
}

export async function signUp(formData: FormData): Promise<AuthActionResult> {
  const parsed = signUpSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.name },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/onboarding`,
    },
  });

  if (error) {
    if (error.message.includes("already registered")) {
      return { error: "Este e-mail já está cadastrado" };
    }
    return { error: "Erro ao criar conta. Tente novamente." };
  }

  if (!data.user) {
    return { error: "Erro inesperado. Tente novamente." };
  }

  return { success: true };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function getSession() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getBusinessId(): Promise<string | null> {
  const { getCachedBusinessId } = await import("@/lib/auth/cached")
  return getCachedBusinessId()
}

export async function requestPasswordReset(
  email: string
): Promise<{ error?: string }> {
  const { allowed } = await checkRateLimit(`pwd-reset:${email.toLowerCase()}`, 3, 3_600_000)
  if (!allowed) return { error: "Muitas solicitações. Tente novamente em 1 hora." }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
  });
  if (error) return { error: "Não foi possível enviar o email. Verifique o endereço." };
  return {};
}

export async function updatePassword(
  password: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "Não foi possível atualizar a senha. Tente novamente." };
  return {};
}

export async function updateUserName(
  name: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ data: { full_name: name.trim() } });
  if (error) return { error: "Não foi possível atualizar o nome." };
  revalidatePath("/dashboard/account");
  return {};
}

export async function signUpDirect(formData: FormData): Promise<AuthActionResult> {
  const name = (formData.get("name") as string)?.trim()
  const email = (formData.get("email") as string)?.trim()
  const password = formData.get("password") as string
  const telefone = (formData.get("telefone") as string)?.trim()
  const cidade = (formData.get("cidade") as string)?.trim()
  const estado = (formData.get("estado") as string)?.trim()
  const cep = (formData.get("cep") as string)?.trim()

  if (!name || name.length < 2) return { error: "Nome deve ter pelo menos 2 caracteres" }
  if (!email) return { error: "E-mail inválido" }
  if (!password || password.length < 6) return { error: "Senha deve ter pelo menos 6 caracteres" }

  const { allowed } = await checkRateLimit(`signup:${email.toLowerCase()}`, 5, 3_600_000)
  if (!allowed) return { error: "Limite atingido. Tente novamente em 1 hora." }

  const admin = createAdminClient()
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: name,
      terms_accepted_at: new Date().toISOString(),
      telefone: telefone || null,
      cidade: cidade || null,
      estado: estado || null,
      cep: cep || null,
    },
  })
  if (authError || !authData.user) {
    if (
      authError?.message?.includes("already registered") ||
      authError?.message?.includes("already been registered") ||
      authError?.message?.includes("User already registered")
    ) {
      return { error: "Este e-mail já está cadastrado. Faça login ou use outro e-mail." }
    }
    return { error: authError?.message ?? "Erro ao criar conta" }
  }

  const supabase = await createClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
  if (signInError) return { error: signInError.message }

  const { data: rawBiz, error: bizError } = await admin
    .from("businesses")
    .insert({
      name,
      type: "other_service_business",
      onboarded: false,
      settings: { cidade: cidade || null, estado: estado || null, cep: cep || null },
      opening_hours: {},
      phone: telefone || null,
      whatsapp_number: telefone || null,
      city: cidade || null,
      state: estado || null,
      zip_code: cep ? cep.replace(/\D/g, "") : null,
    } as never)
    .select("id")
    .single()
  const biz = rawBiz as { id: string } | null
  if (bizError || !biz) return { error: "Erro ao criar negócio" }

  await admin.from("business_users").insert({
    user_id: authData.user.id,
    business_id: biz.id,
    role: "owner",
  } as never)

  sendWelcomeEmail({ to: email, name }).catch(() => {})

  revalidatePath("/", "layout")
  redirect("/dashboard/retornai")
}

export async function completeOnboarding(businessData: {
  type: string;
  name: string;
  phone: string;
  whatsapp_number: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  opening_hours: Record<string, unknown>;
  pix_key?: string;
  pix_key_type?: string;
  services: Array<{ name: string; duration_minutes: number; price: number; price_max?: number }>;
  staff: Array<{ name: string; role: string; phone?: string }>;
}): Promise<AuthActionResult> {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  try {
    const { data: rawBusiness, error: bizError } = await admin
      .from("businesses")
      .insert({
        name: businessData.name,
        type: businessData.type,
        phone: businessData.phone,
        whatsapp_number: businessData.whatsapp_number,
        address: businessData.address,
        city: businessData.city,
        state: businessData.state,
        zip_code: businessData.zip_code,
        opening_hours: businessData.opening_hours,
        pix_key: businessData.pix_key,
        pix_key_type: businessData.pix_key_type,
        onboarded: true,
      } as never)
      .select()
      .single();
    const business = rawBusiness as { id: string } | null;

    if (bizError || !business) {
      console.error("completeOnboarding business insert error:", bizError);
      return { error: "Erro ao salvar dados do negócio" };
    }

    await admin.from("business_users").insert({
      business_id: business.id,
      user_id: user.id,
      role: "owner",
    } as never);

    if (businessData.services.length > 0) {
      await admin.from("services").insert(
        businessData.services.map((s) => ({
          business_id: business.id,
          name: s.name,
          duration_minutes: s.duration_minutes,
          price: s.price,
          price_max: s.price_max,
        })) as never
      );
    }

    if (businessData.staff.length > 0) {
      await admin.from("staff").insert(
        businessData.staff.map((s) => ({
          business_id: business.id,
          name: s.name,
          role: s.role,
          phone: s.phone,
        })) as never
      );
    }
  } catch (err) {
    console.error("completeOnboarding error:", err);
    return { error: "Erro inesperado ao salvar dados" };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
