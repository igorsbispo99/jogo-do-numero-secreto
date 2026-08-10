import type { Metadata } from "next";
import { Cabecalho, Rodape } from "@/components/Cabecalho";
import { ConsultaChamado } from "@/components/ConsultaChamado";

export const metadata: Metadata = {
  title: "Acompanhar chamado · RH Grupo TEA",
};

export default async function PaginaConsulta({
  searchParams,
}: {
  searchParams: Promise<{ protocolo?: string }>;
}) {
  const { protocolo } = await searchParams;

  return (
    <>
      <Cabecalho compacto />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="mb-2 text-2xl font-bold text-tea-marinho">Acompanhar chamado</h1>
        <p className="mb-8 text-slate-600">
          Informe o protocolo e o seu CPF para ver o andamento e conversar com o RH.
        </p>
        <ConsultaChamado protocoloInicial={protocolo ?? ""} />
      </main>
      <Rodape />
    </>
  );
}
