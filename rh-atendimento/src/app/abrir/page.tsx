import type { Metadata } from "next";
import { Cabecalho, Rodape } from "@/components/Cabecalho";
import { FormularioChamado } from "@/components/FormularioChamado";

export const metadata: Metadata = {
  title: "Abrir chamado · RH Grupo TEA",
};

export default function PaginaAbrirChamado() {
  return (
    <>
      <Cabecalho compacto />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="mb-2 text-2xl font-bold text-tea-marinho">Abrir chamado</h1>
        <p className="mb-8 text-slate-600">
          Leva menos de dois minutos. Ao final você recebe um protocolo por e-mail.
        </p>
        <FormularioChamado />
      </main>
      <Rodape />
    </>
  );
}
