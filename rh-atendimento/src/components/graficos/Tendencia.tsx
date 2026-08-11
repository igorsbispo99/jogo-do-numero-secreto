"use client";

import { useState } from "react";
import type { Ponto } from "@/lib/graficos";

/**
 * Curva de chamados recebidos x resolvidos.
 *
 * Desenhada em SVG puro: nenhuma biblioteca de gráficos, o que mantém a página
 * leve e evita depender de arquivo externo. Passar o mouse (ou o dedo) mostra
 * os números do período apontado.
 */
export function Tendencia({ pontos }: { pontos: Ponto[] }) {
  const [ativo, setAtivo] = useState<number | null>(null);

  if (pontos.length < 2) {
    return <p className="py-8 text-center text-sm text-slate-500">Dados insuficientes ainda.</p>;
  }

  const L = 100;
  const A = 34;
  const maior = Math.max(...pontos.flatMap((p) => [p.recebidos, p.resolvidos]), 1);
  const x = (i: number) => (i / (pontos.length - 1)) * L;
  const y = (valor: number) => A - (valor / maior) * (A - 3);

  const traco = (pegar: (p: Ponto) => number) =>
    pontos.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)} ${y(pegar(p)).toFixed(2)}`).join(" ");

  const area = `${traco((p) => p.recebidos)} L ${L} ${A} L 0 ${A} Z`;
  const ponto = ativo !== null ? pontos[ativo] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${L} ${A}`}
        preserveAspectRatio="none"
        className="h-44 w-full"
        role="img"
        aria-label="Evolução de chamados recebidos e resolvidos"
      >
        <defs>
          <linearGradient id="degrade-recebidos" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#26a3d0" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#26a3d0" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75].map((fracao) => (
          <line
            key={fracao}
            x1="0"
            x2={L}
            y1={A * fracao}
            y2={A * fracao}
            stroke="#e2e8f0"
            strokeWidth="0.2"
          />
        ))}

        <path d={area} fill="url(#degrade-recebidos)" />
        <path
          d={traco((p) => p.recebidos)}
          fill="none"
          stroke="#26a3d0"
          strokeWidth="2.5"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={traco((p) => p.resolvidos)}
          fill="none"
          stroke="#09a497"
          strokeWidth="2.5"
          strokeDasharray="6 4"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {ativo !== null && (
          <line
            x1={x(ativo)}
            x2={x(ativo)}
            y1="0"
            y2={A}
            stroke="#94a3b8"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {/* Faixas invisíveis: capturam o mouse sem poluir o desenho. */}
        {pontos.map((p, i) => (
          <rect
            key={p.rotulo}
            x={x(i) - L / (pontos.length - 1) / 2}
            y="0"
            width={L / (pontos.length - 1)}
            height={A}
            fill="transparent"
            onMouseEnter={() => setAtivo(i)}
            onMouseLeave={() => setAtivo(null)}
          />
        ))}
      </svg>

      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
        <span>{pontos[0].rotulo}</span>
        <span className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded bg-tea-azul-500" aria-hidden /> recebidos
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="h-0.5 w-4 rounded bg-tea-turquesa-500"
              style={{ backgroundImage: "repeating-linear-gradient(90deg,#09a497 0 3px,transparent 3px 5px)" }}
              aria-hidden
            />{" "}
            resolvidos
          </span>
        </span>
        <span>{pontos[pontos.length - 1].rotulo}</span>
      </div>

      {ponto && (
        <div
          className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg"
          style={{ left: `${(ativo! / (pontos.length - 1)) * 100}%` }}
        >
          <p className="font-bold">{ponto.rotulo}</p>
          <p>{ponto.recebidos} recebidos</p>
          <p>{ponto.resolvidos} resolvidos</p>
        </div>
      )}
    </div>
  );
}
