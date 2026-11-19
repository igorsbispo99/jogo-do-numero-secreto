/**
 * Cálculo do SLA de um chamado: prioridade, prazo da 1ª resposta e prazo de
 * resolução, com a explicação de cada passo. Funciona no servidor e no
 * navegador (a calculadora da central usa as mesmas funções).
 */

import {
  diasCorridosEntre,
  fimDoDiaUtilAnterior,
  lerDataBrasilia,
  minutosPorDiaUtil,
  prazoMesmoDiaUtil,
  somarDias,
  somarMinutosUteis,
} from "./calendario";
import { sugerirAgravantes, type Sugestao } from "./palavras";
import {
  AGRAVANTES,
  NIVEIS_SLA,
  TETO_RESOLUCAO,
  maiorNivel,
  rankNivel,
  regraDoAssunto,
  subirNivel,
  type AgravanteId,
  type NivelSla,
  type RegraAssunto,
} from "./regras";

export type EntradaSla = {
  vinculo: string;
  categoria: string;
  subcategoria: string;
  dadosExtras?: Record<string, string> | null;
  abertoEm: Date;
  agravantes: AgravanteId[];
  /** Nome da opção escolhida, nos assuntos com detalhe. Sem ela, vale a escolha automática. */
  variante?: string | null;
  /** Ajuste manual feito na revisão. Sem ele, vale o nível calculado. */
  nivelManual?: NivelSla | null;
  /** Texto do chamado, usado só para escolher a variante quando ela depende do relato. */
  texto?: string;
};

export type Motivo = { nivel: NivelSla; texto: string; semEfeito?: boolean };

export type ResultadoSla = {
  nivel: NivelSla;
  nivelCalculado: NivelSla;
  variante: string | null;
  agravantes: AgravanteId[];
  primeiraRespostaAte: Date;
  resolucaoAte: Date;
  diasResolucao: number;
  regraResposta: string;
  regraResolucao: string;
  motivos: Motivo[];
  motivosResolucao: string[];
  entrega: string | null;
  dica: string | null;
  alerta: string | null;
  regra: RegraAssunto;
  regraPropria: boolean;
};

const plural = (n: number) => (n === 1 ? "1 dia útil" : `${n} dias úteis`);

export function escolherVariante(regra: RegraAssunto, dados: Record<string, string>, texto: string) {
  if (!regra.variantes) return null;
  const nome = regra.variantes.escolher({ dados, texto });
  return regra.variantes.opcoes.find((o) => o.nome === nome) ?? regra.variantes.opcoes[0];
}

export function calcularSla(entrada: EntradaSla): ResultadoSla {
  const { regra, propria } = regraDoAssunto(entrada.vinculo, entrada.categoria, entrada.subcategoria);
  const dados = entrada.dadosExtras ?? {};
  const motivos: Motivo[] = [];

  let nivel = regra.base;
  let por = regra.por;
  let dias = regra.dias;
  let variante: string | null = null;

  if (regra.variantes) {
    const opcao =
      regra.variantes.opcoes.find((o) => o.nome === entrada.variante) ??
      escolherVariante(regra, dados, entrada.texto ?? "")!;
    nivel = opcao.nivel;
    por = opcao.por;
    dias = opcao.dias;
    variante = opcao.nome;
  }
  const nivelBase = nivel;
  motivos.push({ nivel, texto: `Prioridade base do assunto${variante ? ` (${variante})` : ""}. ${por}` });

  // Data informada no formulário
  const dataInformada = regra.data ? lerDataBrasilia(dados[regra.data.campo]) : null;
  if (regra.data && dataInformada) {
    const faltam = diasCorridosEntre(entrada.abertoEm, dataInformada);
    let alvo: NivelSla | null = null;
    let texto = "";
    if (faltam < 0) {
      alvo = "alta";
      texto = `${regra.data.campo} já passou.`;
    } else if (faltam <= 7) {
      alvo = "alta";
      texto = `${regra.data.campo} em ${faltam === 1 ? "1 dia" : `${faltam} dias`}.`;
    } else if (regra.data.regra === "programavel" && faltam <= 30) {
      alvo = "normal";
      texto = `${regra.data.campo} em ${faltam} dias: o aviso com 30 dias de antecedência está em jogo.`;
    }
    if (alvo) {
      nivel = maiorNivel(nivel, alvo);
      motivos.push({ nivel: alvo, texto });
    }
  }

  // Agravantes: pisos primeiro, depois os que sobem um nível
  const marcados = AGRAVANTES.filter((a) => entrada.agravantes.includes(a.id));
  for (const a of marcados) {
    if (a.efeito === "critica" || a.efeito === "alta") {
      nivel = maiorNivel(nivel, a.efeito);
      motivos.push({ nivel: a.efeito, texto: `${a.titulo}.` });
    }
  }
  for (const a of marcados) {
    if (a.efeito === "sobe") {
      const antes = nivel;
      nivel = maiorNivel(subirNivel(nivel), "alta");
      motivos.push({
        nivel,
        texto:
          antes === nivel
            ? "Atinge várias pessoas: o nível já está em Crítica."
            : `Atinge várias pessoas: sobe de ${NIVEIS_SLA[antes].titulo} para ${NIVEIS_SLA[nivel].titulo}.`,
        semEfeito: antes === nivel,
      });
    }
    if (a.efeito === "sobe-ate-alta") {
      const antes = nivel;
      const subido = subirNivel(nivel);
      nivel = maiorNivel(nivel, rankNivel(subido) > rankNivel("alta") ? "alta" : subido);
      motivos.push({
        nivel,
        texto:
          antes === nivel
            ? "Reclamação repetida: o nível já está em Alta ou acima."
            : `Reclamação repetida: sobe de ${NIVEIS_SLA[antes].titulo} para ${NIVEIS_SLA[nivel].titulo}.`,
        semEfeito: antes === nivel,
      });
    }
  }
  for (const m of motivos.slice(1)) if (rankNivel(m.nivel) < rankNivel(nivel)) m.semEfeito = true;

  const nivelCalculado = nivel;
  if (entrada.nivelManual && entrada.nivelManual !== nivel) {
    nivel = entrada.nivelManual;
    motivos.push({ nivel, texto: `Ajuste manual na revisão: de ${NIVEIS_SLA[nivelCalculado].titulo} para ${NIVEIS_SLA[nivel].titulo}.` });
  }

  // 1ª resposta
  const jornada = minutosPorDiaUtil();
  const primeiraRespostaAte =
    nivel === "critica"
      ? somarMinutosUteis(entrada.abertoEm, 120)
      : nivel === "alta"
        ? prazoMesmoDiaUtil(entrada.abertoEm)
        : nivel === "normal"
          ? somarMinutosUteis(entrada.abertoEm, jornada)
          : somarMinutosUteis(entrada.abertoEm, 2 * jornada);

  // Resolução
  const motivosResolucao = [`Prazo do assunto: ${plural(dias)}.`];
  const teto = TETO_RESOLUCAO[nivel];
  if (rankNivel(nivel) > rankNivel(nivelBase) && teto && teto < dias) {
    motivosResolucao.push(
      `A prioridade subiu para ${NIVEIS_SLA[nivel].titulo}: o prazo cai de ${plural(dias)} para ${plural(teto)}.`,
    );
    dias = teto;
  }
  if (nivel === "critica") dias = Math.min(dias, 1);
  let resolucaoAte = somarMinutosUteis(entrada.abertoEm, dias * jornada);

  let alerta: string | null = null;
  let antecipado = false;
  if (regra.data && dataInformada) {
    const referencia = regra.data.limite === "aviso30" ? somarDias(dataInformada, -30) : dataInformada;
    const limite = fimDoDiaUtilAnterior(somarDias(referencia, regra.data.limite === "aviso30" ? 1 : 0));
    if (limite <= entrada.abertoEm || limite < primeiraRespostaAte) {
      alerta =
        regra.data.limite === "aviso30"
          ? "O aviso de 30 dias da CLT já não será cumprido. Alinhe com o Head de RH antes de confirmar as férias."
          : "A data informada não deixa folga: resolva o quanto antes e avise a pessoa se não for possível.";
      motivosResolucao.push("Não há mais tempo antes da data informada.");
    } else if (limite < resolucaoAte) {
      resolucaoAte = limite;
      antecipado = true;
      motivosResolucao.push(
        regra.data.limite === "aviso30"
          ? "Antecipado para sair antes do prazo de aviso de 30 dias."
          : "Antecipado para o último dia útil antes da data informada.",
      );
    }
  }
  if (resolucaoAte < primeiraRespostaAte) resolucaoAte = primeiraRespostaAte;

  const regraResolucao = antecipado
    ? regra.data?.limite === "aviso30"
      ? "Antes do prazo de aviso de 30 dias"
      : "Último dia útil antes da data informada"
    : nivel === "planejada"
      ? `Referência de ${plural(dias)}; combine a data final na triagem`
      : nivel === "critica"
        ? "Até 1 dia útil: resolver ou conter o risco e registrar o plano"
        : `${plural(dias)} a partir da abertura`;

  return {
    nivel,
    nivelCalculado,
    variante,
    agravantes: marcados.map((a) => a.id),
    primeiraRespostaAte,
    resolucaoAte,
    diasResolucao: dias,
    regraResposta: NIVEIS_SLA[nivel].regraResposta,
    regraResolucao,
    motivos,
    motivosResolucao,
    entrega: regra.entrega ?? null,
    dica: regra.dica ?? null,
    alerta,
    regra,
    regraPropria: propria,
  };
}

export type PreviaSla = { resultado: ResultadoSla; sugestoes: Sugestao[] };

/**
 * Prévia feita quando o chamado chega: o assunto e os campos do formulário
 * definem a base, e as palavras-chave do relato sugerem os agravantes.
 * `reincidente` vem do banco (mesmo CPF e mesmo assunto nos últimos 30 dias).
 */
export function previaSla(
  entrada: Omit<EntradaSla, "agravantes" | "variante" | "nivelManual"> & {
    texto: string;
    reincidente?: boolean;
  },
): PreviaSla {
  const sugestoes = sugerirAgravantes(entrada.texto);
  if (entrada.reincidente && !sugestoes.some((s) => s.agravante === "reincidente")) {
    sugestoes.push({ agravante: "reincidente", termo: "chamado anterior do mesmo assunto" });
  }
  const resultado = calcularSla({ ...entrada, agravantes: sugestoes.map((s) => s.agravante) });
  return { resultado, sugestoes };
}
