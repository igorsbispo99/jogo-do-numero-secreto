export const STATUS = {
  aberto: { titulo: "Aberto", cor: "bg-sky-100 text-sky-800 ring-sky-600/20" },
  em_andamento: { titulo: "Em andamento", cor: "bg-amber-100 text-amber-900 ring-amber-600/20" },
  aguardando_colaborador: {
    titulo: "Aguardando colaborador",
    cor: "bg-purple-100 text-purple-800 ring-purple-600/20",
  },
  resolvido: { titulo: "Resolvido", cor: "bg-emerald-100 text-emerald-800 ring-emerald-600/20" },
  cancelado: { titulo: "Cancelado", cor: "bg-slate-200 text-slate-700 ring-slate-500/20" },
} as const;

export type Status = keyof typeof STATUS;

export const STATUS_ABERTOS: Status[] = ["aberto", "em_andamento", "aguardando_colaborador"];

export const PRIORIDADES = {
  baixa: { titulo: "Baixa", cor: "bg-slate-100 text-slate-700 ring-slate-500/20" },
  normal: { titulo: "Normal", cor: "bg-slate-100 text-slate-700 ring-slate-500/20" },
  alta: { titulo: "Alta", cor: "bg-orange-100 text-orange-800 ring-orange-600/20" },
  urgente: { titulo: "Urgente", cor: "bg-red-100 text-red-800 ring-red-600/20" },
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
