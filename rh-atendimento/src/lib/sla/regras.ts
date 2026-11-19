/**
 * Regras de SLA: prioridade e prazos de cada assunto do catálogo.
 *
 * Este arquivo é a régua da calculadora. Os níveis e prazos de 1ª resposta
 * seguem a proposta do Head de RH; os prazos de resolução foram definidos por
 * assunto. Para mudar um prazo ou a prioridade de um assunto, edite aqui: a
 * fila, a tela do chamado, a calculadora e os e-mails usam a mesma regra.
 *
 * A chave de cada regra é "vínculo:categoria:assunto" com os slugs do
 * catálogo; "*" vale para os assuntos comuns aos três vínculos.
 */

import type { Prioridade } from "../dominio";

export type NivelSla = "critica" | "alta" | "normal" | "planejada";

export const ORDEM_NIVEIS: NivelSla[] = ["planejada", "normal", "alta", "critica"];

export const NIVEIS_SLA: Record<
  NivelSla,
  { titulo: string; prioridade: Prioridade; regraResposta: string; descricao: string }
> = {
  critica: {
    titulo: "Crítica",
    prioridade: "urgente",
    regraResposta: "Até 2 horas úteis e escalar na hora",
    descricao: "Segurança, vazamento de dados, erro coletivo, fraude, notificação oficial.",
  },
  alta: {
    titulo: "Alta",
    prioridade: "alta",
    regraResposta: "No mesmo dia útil",
    descricao: "Pagamento em risco, admissão ou desligamento próximo, acesso bloqueado, prazo legal.",
  },
  normal: {
    titulo: "Normal",
    prioridade: "normal",
    regraResposta: "Em até 1 dia útil",
    descricao: "Benefícios, documentos, ponto, dúvidas de folha, cadastro.",
  },
  planejada: {
    titulo: "Planejada",
    prioridade: "baixa",
    regraResposta: "Triagem em até 2 dias úteis",
    descricao: "Pedidos programáveis, sugestões e melhorias.",
  },
};

export const nivelValido = (valor: unknown): valor is NivelSla =>
  typeof valor === "string" && (ORDEM_NIVEIS as string[]).includes(valor);

export const rankNivel = (n: NivelSla) => ORDEM_NIVEIS.indexOf(n);
export const maiorNivel = (a: NivelSla, b: NivelSla) => (rankNivel(a) >= rankNivel(b) ? a : b);
export const subirNivel = (n: NivelSla): NivelSla =>
  ORDEM_NIVEIS[Math.min(rankNivel(n) + 1, ORDEM_NIVEIS.length - 1)];

/** Resolução máxima, em dias úteis, quando a prioridade sobe acima da base do assunto. */
export const TETO_RESOLUCAO: Record<NivelSla, number | null> = {
  critica: 1,
  alta: 2,
  normal: 5,
  planejada: null,
};

// ---------------------------------------------------------------------------
// Agravantes
// ---------------------------------------------------------------------------

export type AgravanteId =
  | "seguranca"
  | "legal"
  | "dinheiro"
  | "impedido"
  | "prazo"
  | "coletivo"
  | "reincidente";

export type Agravante = {
  id: AgravanteId;
  titulo: string;
  ajuda: string;
  /** "critica" e "alta" são pisos; "sobe" sobe um nível (mínimo Alta); "sobe-ate-alta" sobe até Alta. */
  efeito: "critica" | "alta" | "sobe" | "sobe-ate-alta";
  rotulo: string;
};

export const AGRAVANTES: Agravante[] = [
  {
    id: "seguranca",
    titulo: "Há risco à segurança de alguém",
    ajuda: "Assédio, violência, ameaça, acidente, crise emocional ou risco a paciente.",
    efeito: "critica",
    rotulo: "Crítica",
  },
  {
    id: "legal",
    titulo: "Há risco legal, de dados ou de fraude",
    ajuda:
      "Vazamento de dados, suspeita de golpe ou fraude, notificação oficial (Ministério do Trabalho, sindicato, Justiça, INSS) ou fiscalização.",
    efeito: "critica",
    rotulo: "Crítica",
  },
  {
    id: "dinheiro",
    titulo: "O dinheiro está atrasado ou o fechamento está travado",
    ajuda:
      "Pagamento, bolsa ou repasse já passou da data, ou o pedido impede fechar a folha ou os repasses do mês.",
    efeito: "alta",
    rotulo: "Mínimo Alta",
  },
  {
    id: "impedido",
    titulo: "A pessoa está impedida de trabalhar ou de atender pacientes",
    ajuda: "Sem acesso a sistema, sem termo ou contrato para começar, sem transporte, ou pacientes sem cobertura.",
    efeito: "alta",
    rotulo: "Mínimo Alta",
  },
  {
    id: "prazo",
    titulo: "Há um prazo legal ou externo em 7 dias ou menos",
    ajuda: "Banco, escola, INSS, conselho profissional, eSocial ou outro prazo informado no chamado.",
    efeito: "alta",
    rotulo: "Mínimo Alta",
  },
  {
    id: "coletivo",
    titulo: "O problema atinge várias pessoas",
    ajuda: "Exemplo: a folha de uma unidade inteira ou um sistema fora do ar para todos.",
    efeito: "sobe",
    rotulo: "+1 nível",
  },
  {
    id: "reincidente",
    titulo: "A pessoa já reclamou deste assunto sem solução",
    ajuda: "Segundo chamado sobre o mesmo problema ou reclamação de demora.",
    efeito: "sobe-ate-alta",
    rotulo: "+1 nível, até Alta",
  },
];

export const agravanteValido = (valor: unknown): valor is AgravanteId =>
  AGRAVANTES.some((a) => a.id === valor);

// ---------------------------------------------------------------------------
// Regras por assunto
// ---------------------------------------------------------------------------

export type OpcaoVariante = { nome: string; nivel: NivelSla; por: string; dias: number };

export type ContextoVariante = { dados: Record<string, string>; texto: string };

export type RegraAssunto = {
  base: NivelSla;
  por: string;
  /** Prazo de resolução, em dias úteis. */
  dias: number;
  /** O que conta como resolvido, quando não é óbvio. */
  entrega?: string;
  dica?: string;
  /** Assuntos em que um detalhe do chamado muda a prioridade. */
  variantes?: {
    titulo: string;
    opcoes: OpcaoVariante[];
    /** Escolhe a opção pelo que o portal já entrega. Devolve o nome da opção. */
    escolher: (ctx: ContextoVariante) => string;
  };
  /** Campo de data do formulário (rótulo como fica gravado no chamado). */
  data?: {
    campo: string;
    /** "padrao": 7 dias ou menos sobe para Alta. "programavel": 30 dias ou menos, Normal; 7 ou menos, Alta. */
    regra: "padrao" | "programavel";
    /** A resolução precisa ficar pronta antes da data ("vespera") ou antes do aviso de 30 dias ("aviso30"). */
    limite: "vespera" | "aviso30";
  };
};

const POR_PIX = "Muda a conta que recebe o pagamento. Há risco de fraude e de pagamento na conta errada (critério 2).";
const DICA_PIX =
  "Antes de trocar, confirme o pedido com a pessoa por outro canal (telefone do cadastro). Se ela disser que não pediu a troca, é suspeita de fraude: marque o agravante de risco legal (Crítica).";
const ENTREGA_PIX = "Troca confirmada com a pessoa por outro canal e cadastrada antes do próximo pagamento.";
const POR_NAO_RECEBIDO = "Pagamento em risco: a pessoa está sem receber (critério 3).";
const POR_DIVERGENCIA = "A pessoa recebeu, mas o valor precisa ser conferido. É dúvida de folha (critério 3).";
const DICA_DIVERGENCIA =
  "Se faltou uma parte grande do valor, marque “dinheiro atrasado”. Se várias pessoas relatam a mesma diferença, marque “atinge várias pessoas”.";
const DICA_VT = "Se a pessoa está sem vale-transporte para chegar ao trabalho, marque “impedida de trabalhar”.";
const DUVIDA = "Dúvida sem impacto imediato.";

const normalizar = (texto: string) =>
  texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const regraPix: RegraAssunto = { base: "alta", por: POR_PIX, dias: 2, entrega: ENTREGA_PIX, dica: DICA_PIX };
const regraDuvida: RegraAssunto = { base: "normal", por: DUVIDA, dias: 3 };
const regraVt: RegraAssunto = { base: "normal", por: "Rotina de benefício.", dias: 5, dica: DICA_VT };

const regraNaoRecebido = (oQue: string): RegraAssunto => ({
  base: "alta",
  por: POR_NAO_RECEBIDO,
  dias: 2,
  entrega: `${oQue} paga, ou nova data confirmada por escrito para a pessoa.`,
});

const regraDivergencia = (ondeAcerta: string): RegraAssunto => ({
  base: "normal",
  por: POR_DIVERGENCIA,
  dias: 5,
  entrega: `Diferença apurada e explicada. Se houver acerto, informe em qual ${ondeAcerta} ele entra.`,
  dica: DICA_DIVERGENCIA,
});

export const REGRAS: Record<string, RegraAssunto> = {
  // Comuns aos três vínculos ------------------------------------------------
  "*:acesso-anclinic:solicitar-acesso-anclinic": {
    base: "normal",
    por: "Cadastro de rotina, mas é necessário para registrar os atendimentos (critério 4).",
    dias: 2,
    data: { campo: "Data de início do contrato", regra: "padrao", limite: "vespera" },
    dica: "Se o início é em 7 dias ou menos, a pessoa começaria a atender sem acesso ao sistema: a prioridade sobe para Alta.",
  },
  "*:acesso-anclinic:problema-acesso-anclinic": {
    base: "alta",
    por: "Com o acesso bloqueado, o profissional não registra sessões nem evoluções. Afeta a assistência (critério 4).",
    dias: 1,
  },
  "*:outros-assuntos:duvida-geral": { base: "normal", por: DUVIDA, dias: 3 },
  "*:outros-assuntos:declaracao-documento": {
    base: "normal",
    por: "Documento de rotina (declaração de vínculo, comprovante de renda).",
    dias: 3,
  },
  "*:outros-assuntos:atualizacao-cadastro": {
    base: "normal",
    por: "Cadastro de rotina.",
    dias: 3,
    dica: "A inclusão de dependente afeta o IR e o plano de saúde. Veja se não há um prazo junto.",
  },
  "*:outros-assuntos:sugestao-elogio": {
    base: "normal",
    por: "Uma reclamação pede retorno rápido para não gerar mais desgaste (critério 5).",
    dias: 5,
    dica: "Leia com atenção. Reclamação que relata assédio, discriminação, violência ou risco a paciente é Crítica: marque o agravante de segurança.",
    variantes: {
      titulo: "Tipo de mensagem",
      opcoes: [
        { nome: "Reclamação", nivel: "normal", por: "Uma reclamação pede retorno rápido para não gerar mais desgaste (critério 5).", dias: 5 },
        { nome: "Sugestão ou elogio", nivel: "planejada", por: "Melhoria: entra no fluxo de projetos (critério 6).", dias: 15 },
      ],
      escolher: ({ texto }) =>
        /reclam|insatisf|absurd|descaso|problema|pessim|demora|nao resolv|falta de/.test(normalizar(texto))
          ? "Reclamação"
          : /sugest|sugir|elogi|parabe|agradec|ideia|obrigad/.test(normalizar(texto))
            ? "Sugestão ou elogio"
            : "Reclamação",
    },
  },
  "*:outros-assuntos:outro-assunto": {
    base: "normal",
    por: "Sem tema definido: responda em 1 dia útil, entenda o pedido e direcione para a pessoa certa.",
    dias: 5,
    dica: "Depois de ler, use os agravantes para reclassificar. Assuntos graves costumam chegar por aqui.",
  },

  // PJ -----------------------------------------------------------------------
  "pj:contratos:assinatura-novo-contrato": {
    base: "alta",
    por: "Sem contrato assinado, o profissional atende e recebe sem cobertura contratual. Há risco legal e de pagamento (critério 2).",
    dias: 2,
  },
  "pj:contratos:aditivo-renovacao": {
    base: "normal",
    por: "Rotina contratual, com prazo de vigência.",
    dias: 5,
    data: { campo: "A partir de qual data", regra: "padrao", limite: "vespera" },
  },
  "pj:contratos:segunda-via": { base: "normal", por: "Pedido de documento.", dias: 3 },
  "pj:contratos:duvidas-contrato": regraDuvida,
  "pj:distratos:solicitar-distrato": {
    base: "alta",
    por: "Desligamento próximo: é preciso cobrir os pacientes, fazer o último pagamento e retirar os acessos (critérios 2 e 4).",
    dias: 5,
    entrega: "Distrato assinado, acessos retirados e último pagamento programado.",
    dica: "Avise a coordenação da unidade no mesmo dia para planejar a cobertura dos pacientes.",
    data: { campo: "Último dia de prestação de serviço", regra: "padrao", limite: "vespera" },
  },
  "pj:distratos:duvidas-distrato": regraDuvida,
  "pj:distratos:documentos-distrato": { base: "normal", por: "Pedido de documento.", dias: 3 },
  "pj:chave-pix:alterar-chave-pix": regraPix,
  "pj:pagamentos:envio-nota-fiscal": {
    base: "normal",
    por: "Recebimento de documento que libera o pagamento.",
    dias: 2,
    dica: "Se a nota chegou depois do prazo e o pagamento do mês depende dela, marque “dinheiro atrasado ou fechamento travado”.",
  },
  "pj:pagamentos:pagamento-nao-recebido": regraNaoRecebido("Pagamento"),
  "pj:pagamentos:divergencia-valor": regraDivergencia("pagamento"),
  "pj:pagamentos:duvidas-pagamento": { base: "normal", por: "Dúvida de folha (critério 3).", dias: 3 },

  // CLT ----------------------------------------------------------------------
  "clt:beneficios:alterar-chave-pix": regraPix,
  "clt:beneficios:plano-saude": {
    base: "normal",
    por: "Rotina de benefício.",
    dias: 5,
    entrega: "Pedido enviado à operadora e protocolo informado à pessoa. O prazo da operadora não conta para o RH.",
    dica: "O recém-nascido deve ser incluído em até 30 dias do nascimento para evitar carência.",
    variantes: {
      titulo: "Tipo de pedido",
      opcoes: [
        { nome: "Inclusão ou exclusão de dependente", nivel: "normal", por: "Rotina de benefício.", dias: 5 },
        { nome: "Carteirinha para uso imediato", nivel: "alta", por: "A pessoa precisa de atendimento de saúde e está sem cobertura (critério 1).", dias: 1 },
      ],
      escolher: ({ texto }) =>
        /carteirinha|consulta marcada|cirurgia|internad|pronto.socorro|urgencia|emergencia|exame marcado|negad/.test(
          normalizar(texto),
        )
          ? "Carteirinha para uso imediato"
          : "Inclusão ou exclusão de dependente",
    },
  },
  "clt:beneficios:vale-transporte-alimentacao": regraVt,
  "clt:beneficios:duvidas-beneficios": regraDuvida,
  "clt:pagamento:holerite": { base: "normal", por: "Pedido de documento de folha.", dias: 2 },
  "clt:pagamento:pagamento-nao-recebido": regraNaoRecebido("Pagamento"),
  "clt:pagamento:divergencia-valor": regraDivergencia("folha"),
  "clt:pagamento:duvidas-pagamento": { base: "normal", por: "Dúvida de folha (critério 3).", dias: 3 },
  "clt:afastamento:comunicar-afastamento": {
    base: "alta",
    por: "Ausência que afeta a agenda de pacientes e a folha (critérios 3 e 4).",
    dias: 2,
    entrega: "Afastamento registrado, gestor avisado e, se for o caso, encaminhamento ao INSS ou CAT emitida.",
    dica: "Se o acidente não tiver relação com o trabalho nem com o trajeto, escolha “Doença”.",
    variantes: {
      titulo: "Motivo informado",
      opcoes: [
        { nome: "Doença", nivel: "alta", por: "A ausência afeta a agenda de pacientes e a folha. Mais de 15 dias exige encaminhamento ao INSS (critérios 3 e 4).", dias: 2 },
        { nome: "Acidente de trabalho ou de trajeto", nivel: "critica", por: "A CAT deve ser emitida até o primeiro dia útil seguinte (Lei 8.213, art. 22), e há risco à pessoa (critérios 1 e 2).", dias: 1 },
        { nome: "Licença maternidade", nivel: "alta", por: "Afastamento longo: exige cobertura dos pacientes, ajuste na folha e registro no eSocial (critérios 3 e 4).", dias: 3 },
        { nome: "Licença paternidade", nivel: "normal", por: "Afastamento curto e previsível: registre e ajuste o ponto.", dias: 2 },
        { nome: "Outro", nivel: "alta", por: "Ausência que afeta a agenda de pacientes e a folha (critérios 3 e 4).", dias: 2 },
      ],
      escolher: ({ dados }) => {
        const motivo = dados["Motivo"] ?? "";
        if (motivo === "Acidente") return "Acidente de trabalho ou de trajeto";
        if (["Doença", "Licença maternidade", "Licença paternidade"].includes(motivo)) return motivo;
        return "Outro";
      },
    },
  },
  "clt:afastamento:retorno-afastamento": {
    base: "normal",
    por: "Rotina, mas depende de exame de retorno quando o afastamento passa de 30 dias (NR-7).",
    dias: 3,
    dica: "Sem o exame de retorno (ASO), a pessoa não pode voltar a atender.",
    data: { campo: "Data de retorno", regra: "padrao", limite: "vespera" },
  },
  "clt:afastamento:duvidas-afastamento": regraDuvida,
  "clt:ferias:solicitar-ferias": {
    base: "planejada",
    por: "Pedido programável. A CLT exige aviso com 30 dias de antecedência e pagamento até 2 dias antes do início (arts. 135 e 145).",
    dias: 10,
    entrega: "Férias programadas no sistema e aviso entregue à pessoa.",
    data: { campo: "Data de início", regra: "programavel", limite: "aviso30" },
  },
  "clt:ferias:cancelar-ferias": {
    base: "normal",
    por: "Pode envolver devolução de pagamento já feito e ajuste na escala.",
    dias: 3,
  },
  "clt:ferias:duvidas-ferias": regraDuvida,
  "clt:auxilio-creche:solicitar-auxilio-creche": { base: "normal", por: "Pedido de benefício.", dias: 5 },
  "clt:auxilio-creche:comprovante-mensal": {
    base: "normal",
    por: "Recebimento de documento que libera o reembolso.",
    dias: 3,
    dica: "Se o reembolso do mês depende do comprovante e o fechamento está perto, marque o agravante de fechamento.",
  },
  "clt:auxilio-creche:duvidas-auxilio-creche": regraDuvida,
  "clt:ponto-eletronico:envio-atestado": {
    base: "normal",
    por: "Rotina de ponto: registre e informe o gestor.",
    dias: 2,
    dica: "Se o atestado for de acidente de trabalho, trate como Crítica (emissão da CAT).",
    variantes: {
      titulo: "Duração do atestado",
      opcoes: [
        { nome: "Até 15 dias", nivel: "normal", por: "Rotina de ponto: registre e informe o gestor.", dias: 2 },
        { nome: "Mais de 15 dias", nivel: "alta", por: "Vira afastamento: exige encaminhamento ao INSS e cobertura dos pacientes (critérios 2 e 4).", dias: 2 },
      ],
      escolher: ({ dados }) => {
        const texto = normalizar(dados["Dias ou horas de afastamento"] ?? "");
        const numero = Number((/\d+/.exec(texto) ?? ["0"])[0]);
        return !/hora/.test(texto) && numero > 15 ? "Mais de 15 dias" : "Até 15 dias";
      },
    },
  },
  "clt:ponto-eletronico:ajuste-ponto": {
    base: "normal",
    por: "Rotina de ponto.",
    dias: 3,
    dica: "Perto do fechamento da folha, marque o agravante de fechamento.",
  },
  "clt:ponto-eletronico:banco-de-horas": { base: "normal", por: "Dúvida de ponto.", dias: 5 },
  "clt:ponto-eletronico:acesso-ponto": {
    base: "alta",
    por: "Sem acesso, a jornada fica sem registro. Há risco trabalhista e de erro na folha (critério 2).",
    dias: 1,
  },

  // Estágio ------------------------------------------------------------------
  "estagio:beneficios:alterar-chave-pix": regraPix,
  "estagio:beneficios:vale-transporte-alimentacao": regraVt,
  "estagio:beneficios:duvidas-beneficios": regraDuvida,
  "estagio:bolsa-auxilio:bolsa-nao-recebida": regraNaoRecebido("Bolsa"),
  "estagio:bolsa-auxilio:divergencia-valor": regraDivergencia("pagamento da bolsa"),
  "estagio:bolsa-auxilio:comprovante-bolsa": { base: "normal", por: "Pedido de documento.", dias: 3 },
  "estagio:bolsa-auxilio:duvidas-bolsa": { base: "normal", por: "Dúvida de folha (critério 3).", dias: 3 },
  "estagio:descanso-remunerado:solicitar-descanso": {
    base: "planejada",
    por: "Pedido programável, depois do aceite do gestor.",
    dias: 5,
    data: { campo: "Data de início", regra: "programavel", limite: "vespera" },
  },
  "estagio:descanso-remunerado:cancelar-descanso": {
    base: "normal",
    por: "Muda um período já combinado com o gestor.",
    dias: 3,
  },
  "estagio:descanso-remunerado:duvidas-descanso": regraDuvida,
  "estagio:contrato:assinatura-termo": {
    base: "alta",
    por: "Estágio sem termo de compromisso assinado pode ser considerado vínculo de emprego (Lei 11.788, art. 3º). É risco legal (critério 2).",
    dias: 2,
  },
  "estagio:contrato:renovacao-aditivo": {
    base: "normal",
    por: "Rotina contratual, com prazo de vigência.",
    dias: 5,
    dica: "Com o termo vencido e sem aditivo, o estágio fica irregular.",
    data: { campo: "A partir de qual data", regra: "padrao", limite: "vespera" },
  },
  "estagio:contrato:segunda-via": { base: "normal", por: "Pedido de documento.", dias: 3 },
  "estagio:contrato:encerramento-estagio": {
    base: "alta",
    por: "Desligamento próximo: termo de realização, recesso proporcional e retirada dos acessos (critérios 2 e 4).",
    dias: 5,
    entrega: "Termo de realização emitido, recesso acertado e acessos retirados.",
    dica: "Avise o supervisor do estágio e a coordenação da unidade no mesmo dia.",
    data: { campo: "Último dia de estágio", regra: "padrao", limite: "vespera" },
  },
  "estagio:contrato:duvidas-contrato": regraDuvida,
};

/** Regra usada quando um assunto novo entra no catálogo sem regra própria. */
export const REGRA_PADRAO: RegraAssunto = {
  base: "normal",
  por: "Assunto sem regra própria: tratado como Normal até ganhar uma regra em src/lib/sla/regras.ts.",
  dias: 5,
};

export function regraDoAssunto(vinculo: string, categoria: string, subcategoria: string): {
  regra: RegraAssunto;
  propria: boolean;
} {
  const regra =
    REGRAS[`${vinculo}:${categoria}:${subcategoria}`] ?? REGRAS[`*:${categoria}:${subcategoria}`];
  return regra ? { regra, propria: true } : { regra: REGRA_PADRAO, propria: false };
}
