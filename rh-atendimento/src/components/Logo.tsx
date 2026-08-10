"use client";

import { useEffect, useState } from "react";

/**
 * Símbolo do Grupo TEA (as cinco pessoas em círculo), desenhado em SVG para
 * ficar nítido em qualquer tamanho e não depender de arquivo externo.
 */
export function SimboloTea({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label="Grupo TEA">
      <path
        d="M 34.49 22.01 A 32 32 0 0 1 65.51 22.01"
        stroke="#26a3d0"
        strokeWidth="11"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M 71.82 26.60 A 32 32 0 0 1 81.41 56.11"
        stroke="#09a497"
        strokeWidth="11"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M 79.00 63.52 A 32 32 0 0 1 53.90 81.76"
        stroke="#f9a50f"
        strokeWidth="11"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M 46.10 81.76 A 32 32 0 0 1 21.00 63.52"
        stroke="#901845"
        strokeWidth="11"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M 18.59 56.11 A 32 32 0 0 1 28.18 26.60"
        stroke="#ec562a"
        strokeWidth="11"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="36.48" cy="21.00" r="7.5" fill="#26a3d0" stroke="#fff" strokeWidth="2.6" />
      <circle cx="73.40" cy="28.18" r="7.5" fill="#09a497" stroke="#fff" strokeWidth="2.6" />
      <circle cx="77.99" cy="65.51" r="7.5" fill="#f9a50f" stroke="#fff" strokeWidth="2.6" />
      <circle cx="43.89" cy="81.41" r="7.5" fill="#901845" stroke="#fff" strokeWidth="2.6" />
      <circle cx="18.24" cy="53.90" r="7.5" fill="#ec562a" stroke="#fff" strokeWidth="2.6" />
    </svg>
  );
}

/**
 * Símbolo usado nos cabeçalhos.
 *
 * Se existir /public/simbolo-grupo-tea.png (recorte quadrado do círculo do
 * logo oficial), ele é usado. Caso contrário, cai no desenho em SVG acima -
 * que sempre funciona, em qualquer tamanho.
 */
export function MarcaTea({ className = "h-10 w-10" }: { className?: string }) {
  const [temOficial, setTemOficial] = useState(false);

  useEffect(() => {
    const oficial = new window.Image();
    oficial.onload = () => setTemOficial(true);
    oficial.src = "/simbolo-grupo-tea.png";
  }, []);

  if (!temOficial) return <SimboloTea className={className} />;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/simbolo-grupo-tea.png" alt="Grupo TEA" className={`${className} object-contain`} />
  );
}

/**
 * Logo completo (símbolo + assinatura).
 *
 * Começa sempre pelo SVG que acompanha o projeto - assim nunca aparece imagem
 * quebrada. Se existir um /public/logo-grupo-tea.png (o arquivo oficial do
 * Grupo TEA), ele é carregado em segundo plano e assume o lugar.
 */
export function LogoTea({ className = "h-24 w-auto" }: { className?: string }) {
  const [origem, setOrigem] = useState("/logo-grupo-tea.svg");

  useEffect(() => {
    const oficial = new window.Image();
    oficial.onload = () => setOrigem("/logo-grupo-tea.png");
    oficial.src = "/logo-grupo-tea.png";
  }, []);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={origem} alt="Grupo TEA · Conectar, Acolher, Desenvolver" className={className} />
  );
}

/** Faixa fina com as cinco cores da marca, usada como assinatura visual. */
export function FaixaMarca({ className = "" }: { className?: string }) {
  return (
    <div className={`flex h-1 w-full ${className}`} aria-hidden>
      <span className="flex-1 bg-tea-azul-500" />
      <span className="flex-1 bg-tea-turquesa-500" />
      <span className="flex-1 bg-tea-ambar-500" />
      <span className="flex-1 bg-tea-laranja-500" />
      <span className="flex-1 bg-tea-vinho-500" />
    </div>
  );
}
