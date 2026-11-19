import { NextResponse } from "next/server";
import { chamadaDeRotinaAutorizada } from "@/lib/cron";
import { enviarResumos } from "@/lib/resumos";

/**
 * Resumo da manhã do RH, disparado pela Vercel em dias de semana às 7h30
 * (veja vercel.json). Feriados são pulados aqui dentro.
 *
 * Para testar sem enviar nada: ?simular=1 (devolve só as quantidades).
 * Para rodar num feriado ou fim de semana: ?forcar=1.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!chamadaDeRotinaAutorizada(request)) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const url = new URL(request.url);
  try {
    const relatorio = await enviarResumos({
      simular: url.searchParams.get("simular") === "1",
      forcar: url.searchParams.get("forcar") === "1",
    });
    return NextResponse.json(relatorio);
  } catch (erro) {
    console.error("[resumo] falhou:", erro);
    return NextResponse.json(
      { erro: erro instanceof Error ? erro.message : "falha ao montar os resumos" },
      { status: 500 },
    );
  }
}
