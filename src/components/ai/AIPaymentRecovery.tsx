"use client"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { AlertCircle } from "lucide-react"

interface UnpaidItem {
  id: string
  title: string
  final_price: number
  customer_name: string | null
}

interface Props {
  businessId: string
}

export function AIPaymentRecovery({ businessId }: Props) {
  const router = useRouter()
  const [items, setItems] = useState<UnpaidItem[]>([])
  const [totalUnpaid, setTotalUnpaid] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    Promise.resolve(
      supabase
        .from("work_items")
        .select("id,title,final_price,customer:customers(full_name)")
        .eq("business_id", businessId)
        .eq("status", "completed")
        .eq("payment_status", "unpaid")
        .gt("final_price", 0)
        .order("final_price", { ascending: false })
        .limit(5)
    )
      .then(({ data }) => {
        const raw = data as Array<{
          id: string
          title: string
          final_price: number
          customer: { full_name: string } | null
        }> | null
        if (!raw || raw.length === 0) {
          setLoading(false)
          return
        }
        const mapped = raw.map((i) => ({
          id: i.id,
          title: i.title,
          final_price: i.final_price,
          customer_name: i.customer?.full_name ?? null,
        }))
        setItems(mapped)
        setTotalUnpaid(mapped.reduce((sum, i) => sum + i.final_price, 0))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [businessId])

  if (loading || items.length === 0) return null

  const fmt = (cents: number) =>
    `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`

  return (
    <div
      className="mb-6 rounded-lg border p-5"
      style={{
        background: 'linear-gradient(135deg, #FFF0EC 0%, #FCE7EC 100%)',
        borderColor: '#F3CFCA',
        boxShadow: '0 8px 28px -16px rgba(192,57,47,.20)'
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <AlertCircle className="h-4 w-4 text-danger" />
        <span className="text-sm font-semibold text-danger">
          ✦ {fmt(totalUnpaid)} em receita não cobrada
        </span>
        <span
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white text-danger border ml-auto"
          style={{ borderColor: '#F3CFCA' }}
        >
          <span className="font-bold text-xs">✦</span>
          Gerado por IA
        </span>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-2 rounded-lg bg-white border px-4 py-2.5"
            style={{ borderColor: '#F3CFCA' }}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink truncate">{item.title}</p>
              {item.customer_name && (
                <p className="text-xs text-ink-3 truncate">{item.customer_name}</p>
              )}
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="font-mono text-sm font-bold text-ink">
                {fmt(item.final_price)}
              </span>
              <button
                onClick={() => router.push(`/dashboard/payments?workItemId=${item.id}`)}
                className="px-3 py-1.5 rounded-md text-white text-sm font-semibold hover:opacity-90"
                style={{ background: 'var(--ink)' }}
              >
                Cobrar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
