import { createAdminClient } from "@/lib/supabase/admin";
import { getBusinessId } from "@/lib/auth/actions";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { PrintButton } from "./PrintButton";

interface Props {
  params: Promise<{ id: string }>;
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

const CONDITION_LABEL: Record<string, string> = {
  good: "Bom",
  fair: "Regular",
  poor: "Ruim",
};

const FREQ_LABEL: Record<string, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  biannual: "Semestral",
  annual: "Anual",
};

export default async function PmocPage({ params }: Props) {
  const businessId = await getBusinessId();
  if (!businessId) redirect("/login");

  const { id: customerId } = await params;
  const admin = createAdminClient();

  const [customerResult, equipmentResult, contractsResult] = await Promise.all([
    admin
      .from("customers")
      .select("id,full_name,phone_number,email,address,city")
      .eq("id", customerId)
      .eq("business_id", businessId)
      .single(),
    admin
      .from("equipment")
      .select("id,name,brand,model,serial_number,installation_date,location,condition,notes")
      .eq("business_id", businessId)
      .eq("customer_id", customerId)
      .order("name"),
    admin
      .from("maintenance_contracts")
      .select("id,title,frequency,next_due_at,active,notes")
      .eq("business_id", businessId)
      .eq("customer_id", customerId)
      .order("next_due_at"),
  ]);

  if (!customerResult.data) notFound();

  const customer = customerResult.data;
  const equipment = equipmentResult.data ?? [];
  const contracts = contractsResult.data ?? [];

  // For each equipment, fetch linked work_items (maintenance history)
  const equipmentIds = equipment.map((e) => e.id);
  const historyMap: Record<string, Array<{ title: string; scheduled_start: string | null; status: string; staff_name: string | null }>> = {};

  if (equipmentIds.length > 0) {
    const { data: links } = await admin
      .from("work_item_equipment")
      .select("equipment_id, work_item:work_items(id,title,scheduled_start,status,staff:staff(name))")
      .in("equipment_id", equipmentIds);

    type LinkRow = {
      equipment_id: string;
      work_item: {
        id: string;
        title: string;
        scheduled_start: string | null;
        status: string;
        staff: { name: string } | null;
      } | null;
    };

    for (const link of (links ?? []) as unknown as LinkRow[]) {
      if (!link.work_item) continue;
      if (!historyMap[link.equipment_id]) historyMap[link.equipment_id] = [];
      historyMap[link.equipment_id].push({
        title: link.work_item.title,
        scheduled_start: link.work_item.scheduled_start,
        status: link.work_item.status,
        staff_name: link.work_item.staff?.name ?? null,
      });
    }
  }

  // Sort each equipment's history by date descending
  for (const id of Object.keys(historyMap)) {
    historyMap[id].sort((a, b) => {
      if (!a.scheduled_start) return 1;
      if (!b.scheduled_start) return -1;
      return b.scheduled_start.localeCompare(a.scheduled_start);
    });
  }

  const today = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  return (
    <div className="min-h-screen bg-white">
      {/* Print / back bar — hidden when printing */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-8 py-3 flex items-center gap-4">
        <Link
          href={`/dashboard/customers/${customerId}`}
          className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          ← Voltar ao perfil
        </Link>
        <PrintButton />
      </div>

      {/* PMOC Document */}
      <div className="max-w-4xl mx-auto px-8 py-10 print:py-6 print:px-6 space-y-8">
        {/* Header */}
        <div className="border-b-2 border-gray-800 pb-6">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            PMOC — Plano de Manutenção, Operação e Controle
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Documento gerado em {today} · Portaria nº 3.523/GM de 28/08/1998
          </p>

          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-semibold text-gray-700">Cliente / Responsável</p>
              <p className="text-gray-900">{customer.full_name}</p>
              {customer.phone_number && <p className="text-gray-500">{customer.phone_number}</p>}
              {customer.email && <p className="text-gray-500">{customer.email}</p>}
            </div>
            {(customer.address || customer.city) && (
              <div>
                <p className="font-semibold text-gray-700">Endereço</p>
                <p className="text-gray-900">
                  {[customer.address, customer.city].filter(Boolean).join(", ")}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Equipment list */}
        {equipment.length === 0 ? (
          <div className="text-sm text-gray-400 italic">Nenhum equipamento registrado para este cliente.</div>
        ) : (
          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-4">1. Relação de Equipamentos</h2>
            <div className="space-y-6">
              {equipment.map((eq, idx) => {
                const history = historyMap[eq.id] ?? [];
                return (
                  <div key={eq.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Equipment header */}
                    <div className="bg-gray-50 px-5 py-3 flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {idx + 1}. {eq.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {[eq.brand, eq.model].filter(Boolean).join(" — ")}
                          {eq.serial_number && ` · Série: ${eq.serial_number}`}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          eq.condition === "good"
                            ? "bg-green-50 text-green-700"
                            : eq.condition === "fair"
                            ? "bg-yellow-50 text-yellow-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {CONDITION_LABEL[eq.condition ?? "good"]}
                      </span>
                    </div>

                    {/* Equipment details */}
                    <div className="px-5 py-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm border-b border-gray-100">
                      <div>
                        <span className="text-gray-500">Localização: </span>
                        <span className="text-gray-800">{eq.location || "—"}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Instalação: </span>
                        <span className="text-gray-800">{fmtDate(eq.installation_date)}</span>
                      </div>
                      {eq.notes && (
                        <div className="col-span-2">
                          <span className="text-gray-500">Observações: </span>
                          <span className="text-gray-800">{eq.notes}</span>
                        </div>
                      )}
                    </div>

                    {/* Maintenance history */}
                    <div className="px-5 py-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Histórico de Manutenções
                      </p>
                      {history.length === 0 ? (
                        <p className="text-sm text-gray-400 italic">Nenhuma manutenção registrada.</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-gray-400 border-b border-gray-100">
                              <th className="text-left py-1 pr-4 font-medium">Data</th>
                              <th className="text-left py-1 pr-4 font-medium">Serviço</th>
                              <th className="text-left py-1 pr-4 font-medium">Técnico</th>
                              <th className="text-left py-1 font-medium">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {history.map((h, hi) => (
                              <tr key={hi}>
                                <td className="py-1.5 pr-4 text-gray-600 whitespace-nowrap">{fmtDate(h.scheduled_start)}</td>
                                <td className="py-1.5 pr-4 text-gray-800">{h.title}</td>
                                <td className="py-1.5 pr-4 text-gray-600">{h.staff_name || "—"}</td>
                                <td className="py-1.5 text-gray-600 capitalize">{h.status}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Maintenance contracts */}
        {contracts.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-4">2. Contratos de Manutenção</h2>
            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50">
                <tr className="text-xs text-gray-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-2 font-semibold">Contrato</th>
                  <th className="text-left px-4 py-2 font-semibold">Periodicidade</th>
                  <th className="text-left px-4 py-2 font-semibold">Próxima Visita</th>
                  <th className="text-left px-4 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {contracts.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2.5 text-gray-800 font-medium">{c.title}</td>
                    <td className="px-4 py-2.5 text-gray-600">{FREQ_LABEL[c.frequency] ?? c.frequency}</td>
                    <td className="px-4 py-2.5 text-gray-600">{fmtDate(c.next_due_at)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {c.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Signature block */}
        <section className="pt-6 border-t border-gray-200">
          <h2 className="text-lg font-bold text-gray-800 mb-6">3. Assinaturas</h2>
          <div className="grid grid-cols-2 gap-12">
            <div>
              <div className="border-t border-gray-800 pt-2">
                <p className="text-sm text-gray-600">Responsável Técnico</p>
                <p className="text-xs text-gray-400 mt-0.5">Nome / CREA</p>
              </div>
            </div>
            <div>
              <div className="border-t border-gray-800 pt-2">
                <p className="text-sm text-gray-600">Proprietário / Responsável</p>
                <p className="text-xs text-gray-400 mt-0.5">{customer.full_name}</p>
              </div>
            </div>
          </div>
        </section>

        <p className="text-[10px] text-gray-300 text-center pt-4 print:pt-0">
          Documento gerado automaticamente · RetornAI · {today}
        </p>
      </div>
    </div>
  );
}
