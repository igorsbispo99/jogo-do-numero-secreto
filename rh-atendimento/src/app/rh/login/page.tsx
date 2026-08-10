import type { Metadata } from "next";
import Link from "next/link";
import { FormularioLogin } from "@/components/FormularioLogin";
import { FaixaMarca, LogoTea } from "@/components/Logo";

export const metadata: Metadata = {
  title: "Acesso do RH · Grupo TEA",
};

export default function PaginaLogin() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <LogoTea className="mx-auto mb-4 h-24 w-auto" />
          <h1 className="text-xl font-bold text-tea-marinho">Painel do RH</h1>
          <p className="mt-1 text-sm text-slate-500">
            Acesso restrito à equipe de Recursos Humanos.
          </p>
        </div>

        <div className="cartao overflow-hidden">
          <FaixaMarca />
          <div className="p-6">
            <FormularioLogin />
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          É colaborador?{" "}
          <Link href="/abrir" className="font-semibold text-tea-turquesa-700 hover:underline">
            Abra seu chamado aqui
          </Link>
        </p>
      </div>
    </main>
  );
}
