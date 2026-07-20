import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/auth/actions";
import { LogOut, ShieldCheck } from "lucide-react";
import { AdminNav } from "./NavLink";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.app_metadata?.is_admin) return redirect("/login");

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg)" }}>
      {/* Sidebar */}
      <aside
        className="w-56 shrink-0 flex flex-col sticky top-0 h-screen border-r"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        {/* Brand */}
        <div
          className="h-14 flex items-center gap-2.5 px-4 border-b shrink-0"
          style={{ borderColor: "var(--border)" }}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "var(--brand-grad)" }}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="leading-none">
            <p className="text-[13px] font-bold text-ink tracking-tight">RetornAI</p>
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--brand)" }}>
              Admin
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2.5 space-y-0.5 overflow-y-auto">
          <AdminNav />
        </nav>

        {/* Footer */}
        <div className="p-2.5 border-t shrink-0" style={{ borderColor: "var(--border)" }}>
          <p
            className="px-3 py-1 text-[11px] truncate font-mono"
            style={{ color: "var(--ink-4)" }}
          >
            {user.email}
          </p>
          <form action={signOut}>
            <button
              type="submit"
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors hover:bg-surface-2"
              style={{ color: "var(--ink-3)" }}
            >
              <LogOut className="w-4 h-4 shrink-0" />
              Sair
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
