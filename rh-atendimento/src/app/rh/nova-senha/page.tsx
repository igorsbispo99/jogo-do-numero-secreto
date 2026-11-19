import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FormularioNovaSenha } from "@/components/FormulariosConta";
import { FaixaMarca, LogoTea } from "@/components/Logo";
import { agenteAtual } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Nova senha · RH Grupo TEA" };
export const dynamic = "force-dynamic";

/** Aberta pelo link de recuperação, que já entra com uma sessão temporária. */
export default async function PaginaNovaSenha() {
  const agente = await agenteAtual();
  if (!agente) redirect("/rh/recuperar?erro=link");

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <LogoTea className="mx-auto mb-4 h-24 w-auto" />
          <h1 className="text-xl font-bold text-tea-marinho">Crie uma nova senha</h1>
          <p className="mt-1 text-sm text-slate-500">{agente.email}</p>
        </div>
        <div className="cartao overflow-hidden">
          <FaixaMarca />
          <div className="p-6">
            <FormularioNovaSenha />
          </div>
        </div>
      </div>
    </main>
  );
}
