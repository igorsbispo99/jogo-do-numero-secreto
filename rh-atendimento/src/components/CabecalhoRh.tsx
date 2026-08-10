import Link from "next/link";
import { sair } from "@/actions/rh";
import { iniciais } from "@/lib/format";
import type { AgenteRh } from "@/lib/supabase/server";

export function CabecalhoRh({ agente }: { agente: AgenteRh }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/rh" className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-marca-700 text-xs font-bold text-white">
            TEA
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-bold text-slate-900">Painel do RH</span>
            <span className="block text-xs text-slate-500">Central de atendimento</span>
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <span
            title={agente.email}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700"
          >
            {iniciais(agente.nome)}
          </span>
          <span className="hidden text-sm font-semibold text-slate-700 sm:block">
            {agente.nome}
          </span>
          <form action={sair}>
            <button type="submit" className="text-sm font-semibold text-slate-500 hover:text-red-600">
              Sair
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
