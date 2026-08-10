/* Cada status usa uma cor da paleta do Grupo TEA, em versão pastel no fundo
   e escura no texto, para leitura confortável. */
export const STATUS = {
  aberto: { titulo: "Aberto", cor: "bg-tea-azul-100 text-tea-azul-800 ring-tea-azul-500/25" },
  em_andamento: {
    titulo: "Em andamento",
    cor: "bg-tea-ambar-100 text-tea-ambar-800 ring-tea-ambar-500/30",
  },
  aguardando_colaborador: {
    titulo: "Aguardando colaborador",
    cor: "bg-tea-laranja-100 text-tea-laranja-800 ring-tea-laranja-500/25",
  },
  resolvido: {
    titulo: "Resolvido",
    cor: "bg-tea-turquesa-100 text-tea-turquesa-800 ring-tea-turquesa-500/25",
  },
  cancelado: { titulo: "Cancelado", cor: "bg-slate-200 text-slate-700 ring-slate-500/20" },
} as const;

export type Status = keyof typeof STATUS;

export const STATUS_ABERTOS: Status[] = ["aberto", "em_andamento", "aguardando_colaborador"];

export const PRIORIDADES = {
  baixa: { titulo: "Baixa", cor: "bg-slate-100 text-slate-700 ring-slate-500/20" },
  normal: { titulo: "Normal", cor: "bg-slate-100 text-slate-700 ring-slate-500/20" },
  alta: {
    titulo: "Alta",
    cor: "bg-tea-laranja-100 text-tea-laranja-800 ring-tea-laranja-500/30",
  },
  urgente: {
    titulo: "Urgente",
    cor: "bg-tea-vinho-100 text-tea-vinho-800 ring-tea-vinho-500/30",
  },
} as const;

export type Prioridade = keyof typeof PRIORIDADES;

export function tituloStatus(status: string): string {
  return STATUS[status as Status]?.titulo ?? status;
}

export function corStatus(status: string): string {
  return STATUS[status as Status]?.cor ?? STATUS.aberto.cor;
}

export function tituloPrioridade(p: string): string {
  return PRIORIDADES[p as Prioridade]?.titulo ?? p;
}

export function corPrioridade(p: string): string {
  return PRIORIDADES[p as Prioridade]?.cor ?? PRIORIDADES.normal.cor;
}

/** Extensões aceitas nos anexos (atestados, notas fiscais, comprovantes). */
export const TIPOS_ANEXO_ACEITOS = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
];

export const TAMANHO_MAX_ANEXO = 8 * 1024 * 1024; // 8 MB por arquivo
export const MAX_ANEXOS = 5;
