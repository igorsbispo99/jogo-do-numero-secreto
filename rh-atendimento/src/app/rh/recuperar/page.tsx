import type { Metadata } from "next";
import Link from "next/link";
import { FormularioRecuperar } from "@/components/FormulariosConta";
import { FaixaMarca, LogoTea } from "@/components/Logo";

export const metadata: Metadata = { title: "Recuperar senha · RH Grupo TEA" };

export default async function PaginaRecuperar({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <LogoTea className="mx-auto mb-4 h-24 w-auto" />
          <h1 className="text-xl font-bold text-tea-marinho">Esqueci minha senha</h1>
          <p className="mt-1 text-sm text-slate-500">
            Enviamos um link para o seu e-mail de cadastro. Com ele você cria uma senha nova.
          </p>
        </div>

        <div className="cartao overflow-hidden">
          <FaixaMarca />
          <div className="space-y-4 p-6">
            {erro === "link" && (
              <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-800 ring-1 ring-red-600/20">
                O link expirou ou já foi usado. Peça um novo abaixo.
              </p>
            )}
            <FormularioRecuperar />
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/rh/login" className="font-semibold text-tea-turquesa-700 hover:underline">
            Voltar para o login
          </Link>
        </p>
      </div>
    </main>
  );
}
