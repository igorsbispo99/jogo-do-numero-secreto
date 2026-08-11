/** Paleta dos gráficos: as cores da marca, na ordem de leitura. */
export const CORES_GRAFICO = [
  "#26a3d0", // azul
  "#09a497", // turquesa
  "#f9a50f", // âmbar
  "#ec562a", // laranja
  "#901845", // vinho
  "#186581", // azul escuro
  "#06665e", // turquesa escuro
  "#9a6609", // âmbar escuro
  "#92351a", // laranja escuro
  "#590f2b", // vinho escuro
];

export function corDaSerie(indice: number): string {
  return CORES_GRAFICO[indice % CORES_GRAFICO.length];
}

/** Cores fixas por situação, iguais às etiquetas da fila. */
export const COR_POR_STATUS: Record<string, string> = {
  aberto: "#26a3d0",
  em_andamento: "#f9a50f",
  aguardando_colaborador: "#ec562a",
  resolvido: "#09a497",
  cancelado: "#94a3b8",
};

export type Ponto = { rotulo: string; recebidos: number; resolvidos: number };
export type Fatia = { rotulo: string; valor: number; cor: string; href?: string };
export type Barra = { rotulo: string; valor: number; href?: string };
