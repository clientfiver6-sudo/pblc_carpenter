import Link from "next/link";
import {
  MessageCircle,
  HelpCircle,
  Phone,
  PhoneIncoming,
  Mail,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getBusinessId } from "@/lib/auth/actions";
import { Badge } from "@/components/ui/badge";

interface NavItem {
  label: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: "whatsapp";
  external?: boolean;
}

interface Section {
  title: string;
  items: NavItem[];
}

const SECTIONS: Section[] = [
  {
    title: "Canais",
    items: [
      {
        label: "WhatsApp",
        description: "Conexão e configuração do canal de mensagens",
        href: "/dashboard/settings/whatsapp",
        icon: MessageCircle,
        badge: "whatsapp",
      },
      {
        label: "Voz",
        description: "Canal de voz e configuração de webhook",
        href: "/dashboard/settings/voice",
        icon: Phone,
      },
      {
        label: "Retorno de Chamadas",
        description: "Regras para retornar chamadas perdidas",
        href: "/dashboard/settings/calls",
        icon: PhoneIncoming,
      },
    ],
  },
  {
    title: "Suporte",
    items: [
      {
        label: "Perguntas Frequentes",
        description: "Dúvidas comuns sobre o RetornAI",
        href: "/dashboard/settings/faqs",
        icon: HelpCircle,
      },
      {
        label: "Fale Conosco",
        description: "Entre em contato com nossa equipe de suporte",
        href: "/dashboard/settings/contact",
        icon: Mail,
      },
    ],
  },
];

export default async function SettingsPage() {
  const businessId = await getBusinessId();
  let whatsappConnected = false;

  if (businessId) {
    const supabase = await createClient();
    const { data: rawBiz } = await supabase
      .from("businesses")
      .select("whatsapp_phone_id, whatsapp_connected_at")
      .eq("id", businessId)
      .single();
    const biz = rawBiz as {
      whatsapp_phone_id: string | null;
      whatsapp_connected_at: string | null;
    } | null;
    whatsappConnected = Boolean(biz?.whatsapp_phone_id && biz?.whatsapp_connected_at);
  }

  function resolveBadge(badge: NavItem["badge"]) {
    if (badge === "whatsapp" && whatsappConnected) {
      return (
        <Badge className="h-5 px-1.5 text-[10px] bg-tint text-brand border-brand/30 hover:bg-tint shrink-0">
          Conectado
        </Badge>
      );
    }
    return null;
  }

  return (
    <div className="min-h-screen bg-bg text-ink">
      <div className="max-w-[860px] mx-auto px-4 sm:px-6 md:px-8 py-7 pb-28 space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-ink tracking-tight">Configurações</h2>
          <p className="text-sm text-ink-3 mt-0.5">Gerencie as configurações do seu negócio</p>
        </div>

        {SECTIONS.map((section) => (
          <div key={section.title} className="space-y-3">
            <h3 className="text-xs font-semibold text-ink-3 uppercase tracking-wider px-0.5">
              {section.title}
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {section.items.map(({ label, description, href, icon: Icon, badge, external }) => {
                const cardClass = "bg-surface border border-border rounded-xl p-5 hover:border-border-2 hover:shadow-2 hover:-translate-y-0.5 transition-[border-color,box-shadow,transform] duration-150 ease-brand-out group block";
                const inner = (
                  <>
                    <div className="w-9 h-9 rounded-lg bg-tint flex items-center justify-center mb-3">
                      <Icon className="w-4.5 h-4.5 text-brand" />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-sm font-bold text-ink">{label}</span>
                      {resolveBadge(badge)}
                    </div>
                    <p className="text-xs text-ink-3 leading-snug">{description}</p>
                  </>
                );
                return external ? (
                  <a key={href} href={href} className={cardClass}>
                    {inner}
                  </a>
                ) : (
                  <Link key={href} href={href} className={cardClass}>
                    {inner}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
