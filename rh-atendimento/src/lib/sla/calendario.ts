/**
 * Calendário de expediente usado nos prazos de SLA.
 *
 * Os prazos contam só horas úteis: segunda a sexta, dentro do expediente, sem
 * feriados nacionais, de São Paulo e Carnaval. O servidor roda em UTC, então
 * toda conta é feita no horário de Brasília. Desde 2019 o Brasil não tem
 * horário de verão, por isso o fuso é fixo em UTC-3.
 *
 * Internamente as datas "locais" são objetos Date cujos campos UTC
 * (getUTCHours etc.) representam o relógio de Brasília. Quem usa este módulo
 * só lida com datas reais: a conversão fica aqui dentro.
 */

/** Início e fim do expediente do RH, em minutos desde a meia-noite. */
export const EXPEDIENTE = { inicio: 8 * 60, fim: 18 * 60 };

/** Conta também os feriados de São Paulo (aniversário, 9 de julho, Corpus Christi) e o Carnaval. */
export const FERIADOS_SAO_PAULO = true;

const OFFSET_MS = 3 * 60 * 60_000;
const DIA_MS = 24 * 60 * 60_000;

const paraLocal = (d: Date) => new Date(d.getTime() - OFFSET_MS);
const deLocal = (l: Date) => new Date(l.getTime() + OFFSET_MS);

/** Data real a partir do relógio de Brasília (mês de 1 a 12). */
export function dataEmBrasilia(ano: number, mes: number, dia: number, hora = 0, minuto = 0): Date {
  return deLocal(new Date(Date.UTC(ano, mes - 1, dia, hora, minuto)));
}

/** Lê "AAAA-MM-DD" como meia-noite em Brasília. Devolve null se o texto não for uma data. */
export function lerDataBrasilia(texto: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((texto ?? "").trim());
  if (!m) return null;
  const data = dataEmBrasilia(+m[1], +m[2], +m[3]);
  return Number.isNaN(data.getTime()) ? null : data;
}

/** "AAAA-MM-DD" do dia em Brasília. */
export function chaveDoDia(d: Date): string {
  return chaveLocal(paraLocal(d));
}

function chaveLocal(l: Date): string {
  return `${l.getUTCFullYear()}-${String(l.getUTCMonth() + 1).padStart(2, "0")}-${String(l.getUTCDate()).padStart(2, "0")}`;
}

function pascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia));
}

export type Feriado = { data: string; nome: string };

const cacheFeriados = new Map<number, Map<string, string>>();

/** Feriados do ano, no formato "AAAA-MM-DD" → nome. */
export function feriadosDoAno(ano: number): Map<string, string> {
  const pronto = cacheFeriados.get(ano);
  if (pronto) return pronto;

  const p = pascoa(ano);
  const somar = (dias: number) => new Date(p.getTime() + dias * DIA_MS);
  const fixo = (mes: number, dia: number) => new Date(Date.UTC(ano, mes - 1, dia));

  const lista: [Date, string][] = [
    [fixo(1, 1), "Confraternização Universal"],
    [somar(-2), "Sexta-feira Santa"],
    [fixo(4, 21), "Tiradentes"],
    [fixo(5, 1), "Dia do Trabalho"],
    [fixo(9, 7), "Independência"],
    [fixo(10, 12), "Nossa Senhora Aparecida"],
    [fixo(11, 2), "Finados"],
    [fixo(11, 15), "Proclamação da República"],
    [fixo(11, 20), "Consciência Negra"],
    [fixo(12, 25), "Natal"],
  ];
  if (FERIADOS_SAO_PAULO) {
    lista.push(
      [fixo(1, 25), "Aniversário de São Paulo"],
      [somar(-48), "Carnaval"],
      [somar(-47), "Carnaval"],
      [somar(60), "Corpus Christi"],
      [fixo(7, 9), "Revolução Constitucionalista"],
    );
  }

  const mapa = new Map(lista.map(([data, nome]) => [chaveLocal(data), nome]));
  cacheFeriados.set(ano, mapa);
  return mapa;
}

function utilLocal(l: Date): boolean {
  const dia = l.getUTCDay();
  return dia !== 0 && dia !== 6 && !feriadosDoAno(l.getUTCFullYear()).has(chaveLocal(l));
}

const minutosDoDia = (l: Date) => l.getUTCHours() * 60 + l.getUTCMinutes();

const noMinuto = (l: Date, minuto: number) =>
  new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate(), 0, minuto));

function proximoInicioLocal(l: Date): Date {
  let x = new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate() + 1));
  while (!utilLocal(x)) x = new Date(x.getTime() + DIA_MS);
  return noMinuto(x, EXPEDIENTE.inicio);
}

/** Leva o horário para dentro do expediente: o primeiro minuto útil a partir dele. */
function normalizarLocal(l: Date): Date {
  if (!utilLocal(l)) return proximoInicioLocal(l);
  const m = minutosDoDia(l);
  if (m < EXPEDIENTE.inicio) return noMinuto(l, EXPEDIENTE.inicio);
  if (m >= EXPEDIENTE.fim) return proximoInicioLocal(l);
  return l;
}

export const minutosPorDiaUtil = () => EXPEDIENTE.fim - EXPEDIENTE.inicio;

/** O dia (em Brasília) é útil? */
export function ehDiaUtil(d: Date): boolean {
  return utilLocal(paraLocal(d));
}

/** Soma minutos de expediente a partir de uma data. */
export function somarMinutosUteis(inicio: Date, minutos: number): Date {
  let s = normalizarLocal(paraLocal(inicio));
  let restante = Math.max(0, Math.round(minutos));
  for (let guarda = 0; guarda < 2000; guarda++) {
    const sobra = EXPEDIENTE.fim - minutosDoDia(s);
    if (restante <= sobra) return deLocal(new Date(s.getTime() + restante * 60_000));
    restante -= sobra;
    s = proximoInicioLocal(s);
  }
  return deLocal(s);
}

/** Minutos de expediente entre duas datas (zero se o fim vier antes do início). */
export function minutosUteisEntre(inicio: Date, fim: Date): number {
  if (fim <= inicio) return 0;
  let s = normalizarLocal(paraLocal(inicio));
  const f = paraLocal(fim);
  let total = 0;
  for (let guarda = 0; guarda < 2000 && s < f; guarda++) {
    const fimDoDia = noMinuto(s, EXPEDIENTE.fim);
    const ate = f < fimDoDia ? f : fimDoDia;
    if (ate > s) total += Math.round((ate.getTime() - s.getTime()) / 60_000);
    s = proximoInicioLocal(s);
  }
  return total;
}

/**
 * Prazo da prioridade Alta: fim do expediente do dia. Se faltarem menos de
 * 2 horas úteis (ou o chamado chegar fora do expediente), 12h do dia útil seguinte.
 */
export function prazoMesmoDiaUtil(abertura: Date): Date {
  const s = normalizarLocal(paraLocal(abertura));
  if (EXPEDIENTE.fim - minutosDoDia(s) >= 120) return deLocal(noMinuto(s, EXPEDIENTE.fim));
  const proximo = proximoInicioLocal(s);
  return deLocal(noMinuto(proximo, Math.min(EXPEDIENTE.inicio + 240, EXPEDIENTE.fim)));
}

/** Fim do expediente do último dia útil antes da data (usado para "pronto antes de"). */
export function fimDoDiaUtilAnterior(data: Date): Date {
  let x = paraLocal(data);
  x = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate() - 1));
  while (!utilLocal(x)) x = new Date(x.getTime() - DIA_MS);
  return deLocal(noMinuto(x, EXPEDIENTE.fim));
}

/** Meia-noite (em Brasília) do dia da data. */
export function inicioDoDia(d: Date): Date {
  const l = paraLocal(d);
  return deLocal(new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate())));
}

/** Soma dias corridos mantendo a hora local. */
export function somarDias(d: Date, dias: number): Date {
  return new Date(d.getTime() + dias * DIA_MS);
}

/** Dias corridos entre os dois dias (no calendário de Brasília). */
export function diasCorridosEntre(de: Date, ate: Date): number {
  return Math.round((inicioDoDia(ate).getTime() - inicioDoDia(de).getTime()) / DIA_MS);
}

/** Meia-noite do próximo dia útil depois de `d`. */
export function inicioDoProximoDiaUtil(d: Date): Date {
  let x = somarDias(inicioDoDia(d), 1);
  while (!ehDiaUtil(x)) x = somarDias(x, 1);
  return x;
}

/** Meia-noite do dia útil anterior a `d`. */
export function inicioDoDiaUtilAnterior(d: Date): Date {
  let x = somarDias(inicioDoDia(d), -1);
  while (!ehDiaUtil(x)) x = somarDias(x, -1);
  return x;
}

/** Próximos feriados a partir de hoje, para a tela de regras. */
export function proximosFeriados(agora: Date, quantidade: number): Feriado[] {
  const hoje = chaveDoDia(agora);
  const ano = paraLocal(agora).getUTCFullYear();
  return [...feriadosDoAno(ano), ...feriadosDoAno(ano + 1)]
    .map(([data, nome]) => ({ data, nome }))
    .filter((f) => f.data >= hoje)
    .sort((a, b) => a.data.localeCompare(b.data))
    .slice(0, quantidade);
}
