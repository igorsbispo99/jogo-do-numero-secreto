import type { Metadata } from "next";
import Link from "next/link";
import { FormularioLogin } from "@/components/FormularioLogin";

export const metadata: Metadata = {
  title: "Acesso do RH · Grupo TEA",
};

export default function PaginaLogin() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-marca-700 text-sm font-bold text-white">
            TEA
          </span>
          <h1 className="text-xl font-bold text-slate-900">Painel do RH</h1>
          <p className="mt-1 text-sm text-slate-500">
            Acesso restrito à equipe de Recursos Humanos.
          </p>
        </div>

        <div className="cartao p-6">
          <FormularioLogin />
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          É colaborador?{" "}
          <Link href="/abrir" className="font-semibold text-marca-700 hover:underline">
            Abra seu chamado aqui
          </Link>
        </p>
      </div>
    </main>
  );
}
