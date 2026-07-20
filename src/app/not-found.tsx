import Link from "next/link"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-[80px] font-extrabold text-ink/10 leading-none font-mono">404</p>
        <h1 className="text-2xl font-bold text-ink mb-2 mt-4">Página não encontrada</h1>
        <p className="text-ink-3 text-sm mb-8">Esta página não existe ou foi movida.</p>
        <Link
          href="/"
          className="inline-flex items-center justify-center h-10 px-6 rounded-md text-white font-semibold text-sm transition-opacity hover:opacity-90"
          style={{ background: "var(--brand-grad)" }}
        >
          Ir para o início
        </Link>
      </div>
    </div>
  )
}
