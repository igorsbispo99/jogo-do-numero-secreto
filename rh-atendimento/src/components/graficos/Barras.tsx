"use client";

import Link from "next/link";
import { useState } from "react";
import type { Barra } from "@/lib/graficos";

/**
 * Ranking em barras. Quando o item tem link, clicar leva direto para a lista
 * de chamados daquele recorte - é o caminho do "por que esse número está alto?".
 */
export function Barras({
  itens,
  cor = "#26a3d0",
  totalParaPercentual,
}: {
  itens: Barra[];
  cor?: string;
  totalParaPercentual?: number;
}) {
  const [ativo, setAtivo] = useState<string | null>(null);

  if (itens.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-500">Sem dados no período.</p>;
  }

  const maior = Math.max(...itens.map((i) => i.valor), 1);
  const base = totalParaPercentual ?? itens.reduce((s, i) => s + i.valor, 0);

  return (
    <ul className="space-y-3">
      {itens.map((item) => {
        const linha = (
          <>
            <span className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-slate-700">{item.rotulo}</span>
              <span className="shrink-0 font-semibold text-slate-900">
                {item.valor}
                {base > 0 && (
                  <span className="ml-1 text-xs font-normal text-slate-400">
                    {Math.round((item.valor / base) * 100)}%
                  </span>
                )}
              </span>
            </span>
            <span className="mt-1 block h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <span
                className="block h-full rounded-full transition-all"
                style={{
                  width: `${Math.max(2, (item.valor / maior) * 100)}%`,
                  background: cor,
                  opacity: ativo && ativo !== item.rotulo ? 0.45 : 1,
                }}
              />
            </span>
          </>
        );

        return (
          <li
            key={item.rotulo}
            onMouseEnter={() => setAtivo(item.rotulo)}
            onMouseLeave={() => setAtivo(null)}
          >
            {item.href ? (
              <Link href={item.href} className="block rounded hover:opacity-90">
                {linha}
              </Link>
            ) : (
              linha
            )}
          </li>
        );
      })}
    </ul>
  );
}
