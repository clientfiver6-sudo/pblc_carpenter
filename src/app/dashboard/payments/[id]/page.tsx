import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getBusinessId } from "@/lib/auth/actions"
import { PrintButton } from "@/components/payments/PrintButton"
import { MarkPaidButton } from "@/components/payments/MarkPaidButton"
import { formatCurrency } from "@/lib/utils"
import type { Payment, Customer, WorkItem, Business } from "@/types/database"

export default async function PaymentReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const businessId = await getBusinessId()
  if (!businessId) redirect("/login")

  const supabase = await createClient()

  // Fetch payment scoped to business (security)
  const { data: rawPayment } = await supabase
    .from("payments")
    .select("*, customer:customers(*), work_item:work_items(title, scheduled_start)")
    .eq("id", id)
    .eq("business_id", businessId)
    .single()
  const payment = rawPayment as (Payment & {
    customer: Customer | null
    work_item: Pick<WorkItem, "title" | "scheduled_start"> | null
  }) | null

  if (!payment) notFound()

  // Fetch business info
  const { data: rawBusiness } = await supabase
    .from("businesses")
    .select("name, address, phone, pix_key")
    .eq("id", businessId)
    .single()
  const business = rawBusiness as Pick<Business, "name" | "address" | "phone" | "pix_key"> | null

  const isPaid = payment.status === "paid"
  const paidDate = payment.paid_at
    ? new Date(payment.paid_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "long", timeStyle: "short" })
    : null
  const createdDate = new Date(payment.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "long" })

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header with print/back buttons — hidden when printing */}
      <div className="flex items-center justify-between no-print">
        <Link href="/dashboard/payments" className="text-ink-3 hover:text-ink text-sm flex items-center gap-1">
          ← Pagamentos
        </Link>
        <div className="flex items-center gap-2">
          {!isPaid && <MarkPaidButton paymentId={payment.id} />}
          <PrintButton />
        </div>
      </div>

      {/* Receipt */}
      <div className="bg-surface border border-border rounded-xl p-8 space-y-6 shadow-1 print:border-none print:shadow-none print:bg-white print:text-black">
        {/* Business header */}
        <div className="text-center space-y-1 pb-6 border-b border-border print:border-gray-200">
          <h1 className="text-ink text-xl font-bold print:text-black">{business?.name}</h1>
          {business?.address && <p className="text-ink-3 text-sm print:text-gray-600">{business.address}</p>}
          {business?.phone && <p className="text-ink-3 text-sm print:text-gray-600">{business.phone}</p>}
        </div>

        {/* Title + status */}
        <div className="text-center space-y-2">
          <h2 className="text-ink font-semibold text-lg uppercase tracking-wider print:text-black">
            Recibo de Pagamento
          </h2>
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-mono font-semibold ${
            isPaid
              ? "bg-tint text-brand print:bg-green-100 print:text-green-800"
              : "bg-warning/10 text-warning print:bg-yellow-100 print:text-yellow-800"
          }`}>
            {isPaid ? "PAGO" : payment.status.toUpperCase()}
          </span>
        </div>

        {/* Amount — big and central */}
        <div className="text-center py-4 border-y border-border print:border-gray-200">
          <p className="text-ink-3 text-sm mb-1 print:text-gray-500">Valor</p>
          <p className="text-brand text-4xl font-mono font-bold print:text-green-700">
            {formatCurrency(payment.amount)}
          </p>
          <p className="text-ink-3 text-xs mt-1 print:text-gray-500">via Pix</p>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          {payment.customer && (
            <>
              <div>
                <p className="text-ink-3 print:text-gray-400">Cliente</p>
                <p className="text-ink font-medium print:text-black">{payment.customer.full_name}</p>
              </div>
              <div>
                <p className="text-ink-3 print:text-gray-400">Telefone</p>
                <p className="text-ink font-mono print:text-black">{payment.customer.phone_number ?? "—"}</p>
              </div>
            </>
          )}
          {payment.work_item && (
            <div className="col-span-2">
              <p className="text-ink-3 print:text-gray-400">Serviço</p>
              <p className="text-ink font-medium print:text-black">{payment.work_item.title}</p>
            </div>
          )}
          {payment.description && (
            <div className="col-span-2">
              <p className="text-ink-3 print:text-gray-400">Descrição</p>
              <p className="text-ink print:text-black">{payment.description}</p>
            </div>
          )}
          <div>
            <p className="text-ink-3 print:text-gray-400">Gerado em</p>
            <p className="text-ink-2 print:text-gray-600">{createdDate}</p>
          </div>
          {paidDate && (
            <div>
              <p className="text-ink-3 print:text-gray-400">Pago em</p>
              <p className="text-ink-2 print:text-gray-600">{paidDate}</p>
            </div>
          )}
          <div>
            <p className="text-ink-3 print:text-gray-400">ID da transação</p>
            <p className="text-ink-3 font-mono text-xs print:text-gray-600">{payment.id.slice(0, 8)}...</p>
          </div>
          {business?.pix_key && (
            <div>
              <p className="text-ink-3 print:text-gray-400">Chave Pix</p>
              <p className="text-ink-3 font-mono text-xs print:text-gray-600">{business.pix_key}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center pt-4 border-t border-border print:border-gray-200">
          <p className="text-ink-4 text-xs print:text-gray-400">
            Documento gerado automaticamente • {business?.name}
          </p>
        </div>
      </div>
    </div>
  )
}
