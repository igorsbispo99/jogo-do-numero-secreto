"use client";

import Link from "next/link";
import { useState } from "react";
import type { Fatia } from "@/lib/graficos";

/**
 * Rosca de distribuição. O centro mostra o total e, ao passar o mouse por uma
 * fatia, o número daquela fatia. Cada item da legenda leva para a lista de
 * chamados correspondente - o gráfico não é só ilustração, é ponto de partida.
 */
export function Rosca({ fatias, titulo }: { fatias: Fatia[]; titulo?: string }) {
  const [ativa, setAtiva] = useState<number | null>(null);

  const total = fatias.reduce((s, f) => s + f.valor, 0);
  if (total === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">Sem dados no período.</p>;
  }

  const visiveis = fatias.filter((f) => f.valor > 0);
  const destaque = ativa !== null ? visiveis[ativa] : null;

  // Circunferência 100 para a matemática ser em porcentagem direta.
  let acumulado = 0;

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
      <div className="relative shrink-0">
        <svg viewBox="0 0 42 42" className="h-40 w-40 -rotate-90" role="img" aria-label={titulo}>
          <circle cx="21" cy="21" r="15.915" fill="none" stroke="#f1f5f9" strokeWidth="5" />
          {visiveis.map((fatia, i) => {
            const fracao = (fatia.valor / total) * 100;
            const traco = (
              <circle
                key={fatia.rotulo}
                cx="21"
                cy="21"
                r="15.915"
                fill="none"
                stroke={fatia.cor}
                strokeWidth={ativa === i ? 7 : 5}
                strokeDasharray={`${fracao} ${100 - fracao}`}
                strokeDashoffset={-acumulado}
                className="transition-all"
                onMouseEnter={() => setAtiva(i)}
                onMouseLeave={() => setAtiva(null)}
              />
            );
            acumulado += fracao;
            return traco;
          })}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-tea-marinho">
            {destaque ? destaque.valor : total}
          </span>
          <span className="max-w-[7rem] text-center text-xs leading-tight text-slate-500">
            {destaque ? destaque.rotulo : "no total"}
          </span>
        </div>
      </div>

      <ul className="w-full space-y-2">
        {visiveis.map((fatia, i) => {
          const conteudo = (
            <span className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: fatia.cor }}
                  aria-hidden
                />
                <span className="truncate text-slate-700">{fatia.rotulo}</span>
              </span>
              <span className="shrink-0 font-semibold text-slate-900">
                {fatia.valor}
                <span className="ml-1 text-xs font-normal text-slate-400">
                  {Math.round((fatia.valor / total) * 100)}%
                </span>
              </span>
            </span>
          );

          return (
            <li
              key={fatia.rotulo}
              onMouseEnter={() => setAtiva(i)}
              onMouseLeave={() => setAtiva(null)}
              className={`rounded-lg px-2 py-1 transition ${ativa === i ? "bg-slate-50" : ""}`}
            >
              {fatia.href ? (
                <Link href={fatia.href} className="block hover:underline">
                  {conteudo}
                </Link>
              ) : (
                conteudo
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
