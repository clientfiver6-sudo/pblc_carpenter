"use client";

import { useState, useTransition, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { updateNotificationSettings } from "@/lib/settings/actions";
import { createClient } from "@/lib/supabase/client";

interface NotifToggle {
  key: string;
  label: string;
  defaultOn: boolean;
}

interface NotifCategory {
  title: string;
  items: NotifToggle[];
}

const CATEGORIES: NotifCategory[] = [
  {
    title: "Agendamentos",
    items: [
      { key: "booking_created", label: "Novo agendamento criado", defaultOn: true },
      { key: "booking_confirmed", label: "Agendamento confirmado", defaultOn: true },
      { key: "booking_cancelled", label: "Agendamento cancelado", defaultOn: true },
      { key: "booking_reminder_24h", label: "Lembrete 24h antes", defaultOn: true },
    ],
  },
  {
    title: "Mensagens",
    items: [
      { key: "new_whatsapp_message", label: "Nova mensagem WhatsApp", defaultOn: true },
      { key: "ai_handoff", label: "IA transferiu para humano", defaultOn: true },
    ],
  },
  {
    title: "Pagamentos",
    items: [
      { key: "payment_received", label: "Pagamento recebido", defaultOn: true },
      { key: "payment_overdue", label: "Pagamento vencido", defaultOn: true },
    ],
  },
];

function buildDefaults(): Record<string, boolean> {
  const defaults: Record<string, boolean> = {};
  for (const cat of CATEGORIES) {
    for (const item of cat.items) {
      defaults[item.key] = item.defaultOn;
    }
  }
  return defaults;
}

export default function NotificationsSettingsPage() {
  const [settings, setSettings] = useState<Record<string, boolean>>(buildDefaults());
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: rawBu } = await supabase
        .from("business_users")
        .select("business_id")
        .eq("user_id", user.id)
        .single();
      const bu = rawBu as { business_id: string } | null;

      if (!bu?.business_id) return;

      const { data: rawBiz } = await supabase
        .from("businesses")
        .select("settings")
        .eq("id", bu.business_id)
        .single();
      const biz = rawBiz as { settings: import("@/types/database").Json } | null;

      if (!biz?.settings || typeof biz.settings !== "object") return;

      const bizSettings = biz.settings as Record<string, unknown>;
      const notifSettings = bizSettings.notifications;
      if (notifSettings && typeof notifSettings === "object" && !Array.isArray(notifSettings)) {
        setSettings((prev) => ({
          ...prev,
          ...(notifSettings as Record<string, boolean>),
        }));
      }
    }
    load();
  }, []);

  function toggle(key: string) {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleSave() {
    setSaveError(null);
    setSaveSuccess(false);
    startTransition(async () => {
      try {
        await updateNotificationSettings(settings);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Erro ao salvar");
      }
    });
  }

  return (
    <div className="min-h-screen bg-bg text-ink">
      <div className="max-w-[860px] mx-auto px-4 sm:px-6 md:px-4 sm:px-6 md:px-8 py-7 pb-28 space-y-6">
        <div className="mb-8 flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-tint flex items-center justify-center">
            <Bell className="w-5 h-5 text-brand" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-ink tracking-tight">Notificações</h2>
            <p className="text-sm text-ink-3 mt-0.5">
              Escolha quais eventos geram notificações para você
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {CATEGORIES.map((category) => (
            <Card key={category.title} className="bg-surface border border-border rounded-lg shadow-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-ink-2 uppercase tracking-wide mt-0 mb-0">
                  {category.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {category.items.map((item, itemIdx) => {
                  const isOn = settings[item.key] ?? item.defaultOn;
                  return (
                    <div key={item.key}>
                      <div className="flex items-center justify-between px-4 py-4 border-b border-border last:border-0">
                        <span className="text-sm text-ink">{item.label}</span>
                        <button
                          type="button"
                          onClick={() => toggle(item.key)}
                          className={cn(
                            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200",
                            isOn ? "bg-brand" : "bg-border"
                          )}
                          aria-pressed={isOn}
                          aria-label={`${item.label}: ${isOn ? "ativado" : "desativado"}`}
                        >
                          <span
                            className={cn(
                              "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transition-transform duration-200",
                              isOn ? "translate-x-5" : "translate-x-0"
                            )}
                          />
                        </button>
                      </div>
                      {itemIdx < category.items.length - 1 && (
                        <Separator className="bg-border mx-4" />
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}

          {saveError && (
            <p className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-4 py-3">
              {saveError}
            </p>
          )}
          {saveSuccess && (
            <p className="text-sm text-moss bg-moss/10 border border-moss/20 rounded-lg px-4 py-3">
              Preferências de notificação salvas!
            </p>
          )}

          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSave}
              disabled={isPending}
              className="text-white rounded-md h-10 px-5 font-semibold text-sm disabled:opacity-50"
              style={{ background: 'var(--brand-grad)' }}
            >
              {isPending ? "Salvando..." : "Salvar preferências"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
