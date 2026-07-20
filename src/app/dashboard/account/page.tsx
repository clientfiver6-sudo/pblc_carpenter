import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBusinessId } from "@/lib/auth/actions";
import { AccountClient } from "./AccountClient";
import {
  Building2, MapPin, Phone, Wifi, WifiOff, Banknote,
  ChevronRight, Crown,
} from "lucide-react";

export const dynamic = "force-dynamic";

function fmtPhone(p: string | null) {
  if (!p) return null;
  const d = p.replace(/\D/g, "");
  if (d.length === 13) return `+${d.slice(0,2)} (${d.slice(2,4)}) ${d.slice(4,9)}-${d.slice(9)}`;
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  return p;
}

function planLabel(plan: string, status: string) {
  if (status === "cancelled") return { label: "Cancelado", cls: "bg-surface-2 text-ink-4 border-border" };
  if (status === "past_due")  return { label: "Vencido",   cls: "bg-warning/10 text-warning border-warning/20" };
  if (plan === "pro")         return { label: "Pro",       cls: "bg-brand/8 text-brand border-brand/20" };
  return { label: "Starter", cls: "bg-surface-2 text-ink-3 border-border" };
}

function fmtType(t: string) {
  const map: Record<string, string> = {
    ac_residential: "Ar-condicionado residencial",
    ac_commercial: "Climatização comercial",
    refrigeration: "Refrigeração",
    electrician: "Elétrica",
    plumber: "Hidráulica",
    locksmith: "Serralheria",
    cleaning: "Limpeza",
    pest_control: "Dedetização",
    other_service_business: "Outro serviço",
    clinic: "Clínica",
    dental_clinic: "Odontologia",
    aesthetic_clinic: "Estética",
    veterinary_clinic: "Veterinária",
    beauty_salon: "Salão de Beleza",
    auto_repair: "Oficina",
    bike_shop: "Bicicletas",
    retail_store: "Varejo",
    repair_shop: "Consertos",
  };
  return map[t] ?? t;
}


export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const businessId = await getBusinessId();
  if (!businessId) redirect("/onboarding");

  const admin = createAdminClient();
  const { data: biz } = await admin
    .from("businesses")
    .select("name,type,phone,whatsapp_number,whatsapp_connected_at,city,state,address,zip_code,pix_key,pix_key_type,subscription_plan,subscription_status,subscription_ends_at")
    .eq("id", businessId)
    .single();

  const fullName = (user.user_metadata?.full_name as string) ?? "";
  const email = user.email ?? "";
  const business = biz as {
    name: string; type: string; phone: string | null; whatsapp_number: string | null;
    whatsapp_connected_at: string | null; city: string | null; state: string | null;
    address: string | null; zip_code: string | null; pix_key: string | null;
    pix_key_type: string | null; subscription_plan: string; subscription_status: string;
    subscription_ends_at: string | null;
  } | null;

  const plan = planLabel(business?.subscription_plan ?? "starter", business?.subscription_status ?? "trialing");
  const waConnected = Boolean(business?.whatsapp_connected_at);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-ink tracking-tight">Minha conta</h1>
        <p className="text-sm text-ink-3 mt-0.5">Perfil, senha e informações do negócio</p>
      </div>

      {/* Profile + password */}
      <AccountClient
        email={email}
        fullName={fullName}
        businessName={business?.name ?? ""}
        businessId={businessId}
        subscriptionStatus={business?.subscription_status ?? "trialing"}
      />

      {/* Business info */}
      {business && (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-ink-3" />
              <p className="text-sm font-semibold text-ink">Meu negócio</p>
            </div>
            <Link
              href="/dashboard/settings/business"
              className="text-xs font-medium text-ink-3 hover:text-brand transition-colors flex items-center gap-1"
            >
              Editar <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="px-5 py-4 space-y-3">
            <div>
              <p className="text-base font-semibold text-ink">{business.name}</p>
              <p className="text-sm text-ink-3">{fmtType(business.type)}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {business.phone && (
                <div className="flex items-center gap-2.5 text-sm text-ink-2">
                  <Phone className="w-4 h-4 text-ink-4 shrink-0" />
                  {fmtPhone(business.phone)}
                </div>
              )}
              {(business.city || business.state) && (
                <div className="flex items-center gap-2.5 text-sm text-ink-2">
                  <MapPin className="w-4 h-4 text-ink-4 shrink-0" />
                  {[business.address, business.city, business.state].filter(Boolean).join(", ")}
                </div>
              )}
              <div className="flex items-center gap-2.5 text-sm">
                {waConnected
                  ? <><Wifi className="w-4 h-4 text-moss shrink-0" /><span className="text-moss font-medium">WhatsApp conectado</span></>
                  : <><WifiOff className="w-4 h-4 text-ink-4 shrink-0" /><span className="text-ink-4">WhatsApp não conectado</span></>
                }
              </div>
              {business.pix_key && (
                <div className="flex items-center gap-2.5 text-sm text-ink-2">
                  <Banknote className="w-4 h-4 text-ink-4 shrink-0" />
                  PIX: {business.pix_key}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Plan */}
      <div className="bg-surface border border-border rounded-xl px-5 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand/8 flex items-center justify-center shrink-0">
            <Crown className="w-4.5 h-4.5 text-brand" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-ink">Plano atual</p>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${plan.cls}`}>
                {plan.label}
              </span>
            </div>
            {business?.subscription_ends_at && (
              <p className="text-xs text-ink-4 mt-0.5">
                Válido até {new Date(business.subscription_ends_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
              </p>
            )}
            {business?.subscription_status === "trialing" && (
              <p className="text-xs text-info mt-0.5">Período de avaliação</p>
            )}
          </div>
        </div>
        <Link
          href="/dashboard/settings/subscription"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm font-medium text-ink-2 hover:border-brand/40 hover:text-brand transition-colors shrink-0"
        >
          Gerenciar <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

    </div>
  );
}
