/**
 * Prévia dos agravantes por palavras-chave.
 *
 * Lê o relato do colaborador e sugere os agravantes que aparecem no texto. É
 * só uma sugestão: quem faz a triagem confirma ou revisa, e o portal mede o
 * quanto a prévia acertou (aba Indicadores). Para ajustar, edite as listas
 * abaixo. Os termos são comparados sem acento e em minúsculas, a partir do
 * início de uma palavra ("assedi" encontra "assédio" e "assediada").
 *
 * Nada sai do portal: a leitura é feita no próprio servidor.
 */

import type { AgravanteId } from "./regras";

const TERMOS: Record<Exclude<AgravanteId, "reincidente"> | "reincidente", string[]> = {
  seguranca: [
    "assedi",
    "abuso",
    "abusiv",
    "violenc",
    "agred",
    "agress",
    "ameac",
    "acidente",
    "machuc",
    "ferid",
    "discrimin",
    "racis",
    "homofob",
    "transfob",
    "constrang",
    "humilh",
    "intimid",
    "persegu",
    "suicid",
    "me matar",
    "crise de ansiedade",
    "crise de panico",
    "risco ao paciente",
    "risco para o paciente",
    "paciente se machucou",
    "paciente caiu",
  ],
  legal: [
    "vazament",
    "vazou",
    "dados expostos",
    "lgpd",
    "golpe",
    "fraude",
    "fraudul",
    "clonad",
    "hacker",
    "invadid",
    "nao solicitei a troca",
    "nao pedi a troca",
    "nao fui eu que pedi",
    "processo trabalhista",
    "advogad",
    "justica do trabalho",
    "ministerio do trabalho",
    "ministerio publico",
    "fiscaliza",
    "notificacao",
    "intimacao",
    "sindicato",
    "procon",
    "denuncia",
  ],
  dinheiro: [
    "nao caiu",
    "nao recebi",
    "ainda nao recebi",
    "nao foi pago",
    "nao foi paga",
    "nao pagaram",
    "nao fui pago",
    "nao fui paga",
    "sem receber",
    "pagamento atrasado",
    "salario atrasado",
    "bolsa atrasada",
    "em atraso",
    "atrasou o pagamento",
    "esta atrasado",
    "esta atrasada",
  ],
  impedido: [
    "nao consigo acessar",
    "nao consigo entrar",
    "nao consigo logar",
    "nao consigo registrar",
    "nao consigo atender",
    "nao consigo trabalhar",
    "nao consigo bater o ponto",
    "sem acesso",
    "bloquead",
    "impedid",
    "sem transporte",
    "sem cobertura",
    "pacientes sem atendimento",
    "paciente sem atendimento",
  ],
  prazo: [
    "urgente",
    "urgencia",
    "vence amanha",
    "vence hoje",
    "ate amanha",
    "ate hoje",
    "prazo final",
    "prazo do banco",
    "financiamento",
    "faculdade precisa",
    "escola precisa",
    "pericia",
    "esocial",
  ],
  coletivo: [
    "todos os colegas",
    "todos da unidade",
    "todos na unidade",
    "toda a equipe",
    "toda equipe",
    "varios colegas",
    "varias colegas",
    "varias pessoas",
    "varios profissionais",
    "ninguem recebeu",
    "ninguem da unidade",
    "todo mundo",
    "a unidade inteira",
    "todos os profissionais",
    "nos todos",
  ],
  reincidente: [
    "de novo",
    "novamente",
    "mais uma vez",
    "outra vez",
    "ja abri",
    "ja pedi",
    "ja solicitei",
    "ja reclamei",
    "ja enviei",
    "segunda vez",
    "terceira vez",
    "ninguem respondeu",
    "ninguem me respondeu",
    "ainda nao resolveram",
    "continua sem",
    "ate agora nada",
  ],
};

export const normalizarTexto = (texto: string) =>
  (texto ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");

const escaparRegex = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const PADROES = Object.fromEntries(
  Object.entries(TERMOS).map(([id, termos]) => [
    id,
    termos.map((termo) => ({ termo, regex: new RegExp(`(^|[^a-z0-9])${escaparRegex(termo)}`) })),
  ]),
) as Record<AgravanteId, { termo: string; regex: RegExp }[]>;

export type Sugestao = { agravante: AgravanteId; termo: string };

/** Agravantes encontrados no texto, com o primeiro termo que justificou cada um. */
export function sugerirAgravantes(texto: string): Sugestao[] {
  const normal = normalizarTexto(texto);
  if (!normal) return [];
  const achados: Sugestao[] = [];
  for (const [agravante, padroes] of Object.entries(PADROES) as [AgravanteId, typeof PADROES.seguranca][]) {
    const encontrado = padroes.find((p) => p.regex.test(normal));
    if (encontrado) achados.push({ agravante, termo: encontrado.termo });
  }
  return achados;
}
