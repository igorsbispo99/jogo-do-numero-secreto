/**
 * Catálogo de atendimentos do RH.
 *
 * Este arquivo é a "régua" do sistema: o formulário do colaborador, os filtros
 * do painel e os relatórios saem todos daqui. Para criar um novo tipo de
 * chamado basta acrescentar uma subcategoria abaixo - nada mais precisa mudar.
 */

export type VinculoSlug = "pj" | "clt" | "estagio";

export type CampoExtra = {
  nome: string;
  label: string;
  tipo: "texto" | "textarea" | "data" | "numero" | "select";
  obrigatorio?: boolean;
  opcoes?: string[];
  ajuda?: string;
};

export type Subcategoria = {
  slug: string;
  titulo: string;
  descricao?: string;
  campos?: CampoExtra[];
  anexoObrigatorio?: boolean;
  anexoAjuda?: string;
};

export type Categoria = {
  slug: string;
  titulo: string;
  descricao?: string;
  subcategorias: Subcategoria[];
};

export const VINCULOS: { slug: VinculoSlug; titulo: string; descricao: string }[] = [
  {
    slug: "pj",
    titulo: "PJ",
    descricao: "Prestador de serviço com contrato entre empresas",
  },
  {
    slug: "clt",
    titulo: "CLT",
    descricao: "Contratado com carteira assinada",
  },
  {
    slug: "estagio",
    titulo: "Estágio",
    descricao: "Estagiário com termo de compromisso",
  },
];

const CHAVE_PIX_CAMPOS: CampoExtra[] = [
  {
    nome: "tipo_chave",
    label: "Tipo da nova chave Pix",
    tipo: "select",
    obrigatorio: true,
    opcoes: ["CPF", "CNPJ", "E-mail", "Telefone", "Chave aleatória"],
  },
  {
    nome: "chave_pix",
    label: "Nova chave Pix",
    tipo: "texto",
    obrigatorio: true,
  },
  {
    nome: "banco",
    label: "Banco da nova chave",
    tipo: "texto",
    obrigatorio: true,
  },
  {
    nome: "titular",
    label: "Nome do titular da conta",
    tipo: "texto",
    obrigatorio: true,
    ajuda: "A conta precisa estar no seu nome (ou no CNPJ da sua empresa, se PJ).",
  },
];

/**
 * Porta de entrada para o que não se encaixa nas outras categorias.
 * O canal promete atender "outros assuntos relacionados ao RH" - ninguém pode
 * ficar sem caminho por não achar o assunto exato na lista.
 */
const CATEGORIA_OUTROS: Categoria = {
  slug: "outros-assuntos",
  titulo: "Outros assuntos",
  descricao: "Não achou seu assunto na lista? Registre por aqui",
  subcategorias: [
    {
      slug: "duvida-geral",
      titulo: "Dúvida geral sobre RH",
    },
    {
      slug: "declaracao-documento",
      titulo: "Declaração ou documento",
      descricao: "Declaração de vínculo, comprovante de renda e afins",
      campos: [
        {
          nome: "documento",
          label: "Qual documento você precisa",
          tipo: "texto",
          obrigatorio: true,
        },
        { nome: "finalidade", label: "Para qual finalidade", tipo: "texto" },
      ],
    },
    {
      slug: "atualizacao-cadastro",
      titulo: "Atualização de dados cadastrais",
      descricao: "Endereço, telefone, estado civil, dependentes",
    },
    {
      slug: "sugestao-elogio",
      titulo: "Sugestão, elogio ou reclamação",
    },
    {
      slug: "outro-assunto",
      titulo: "Outro assunto",
      descricao: "Descreva livremente e o RH direciona para a pessoa certa",
    },
  ],
};

const CATEGORIAS_PJ: Categoria[] = [
  {
    slug: "contratos",
    titulo: "Contratos",
    descricao: "Assinatura, renovação e cópias do contrato de prestação de serviço",
    subcategorias: [
      {
        slug: "assinatura-novo-contrato",
        titulo: "Assinatura de novo contrato",
        descricao: "Contrato ainda não recebido ou com pendência na assinatura",
      },
      {
        slug: "aditivo-renovacao",
        titulo: "Aditivo ou renovação",
        campos: [
          { nome: "motivo", label: "Motivo do aditivo", tipo: "texto", obrigatorio: true },
          { nome: "vigencia", label: "A partir de qual data", tipo: "data" },
        ],
      },
      {
        slug: "segunda-via",
        titulo: "Segunda via do contrato",
      },
      {
        slug: "duvidas-contrato",
        titulo: "Dúvidas sobre o contrato",
      },
    ],
  },
  {
    slug: "distratos",
    titulo: "Distratos",
    descricao: "Encerramento do contrato de prestação de serviço",
    subcategorias: [
      {
        slug: "solicitar-distrato",
        titulo: "Solicitar distrato",
        campos: [
          {
            nome: "ultimo_dia",
            label: "Último dia de prestação de serviço",
            tipo: "data",
            obrigatorio: true,
          },
          { nome: "motivo", label: "Motivo", tipo: "textarea" },
        ],
      },
      {
        slug: "duvidas-distrato",
        titulo: "Dúvidas sobre distrato",
      },
      {
        slug: "documentos-distrato",
        titulo: "Documentos do distrato",
        descricao: "Termo de encerramento, comprovantes e afins",
      },
    ],
  },
  {
    slug: "chave-pix",
    titulo: "Mudança de chave Pix",
    descricao: "Alteração da conta que recebe os pagamentos",
    subcategorias: [
      {
        slug: "alterar-chave-pix",
        titulo: "Alterar minha chave Pix",
        campos: CHAVE_PIX_CAMPOS,
        anexoAjuda: "Se possível, anexe um comprovante bancário da nova conta.",
      },
    ],
  },
  {
    slug: "pagamentos",
    titulo: "Pagamentos",
    descricao: "Nota fiscal, valores e datas de pagamento",
    subcategorias: [
      {
        slug: "envio-nota-fiscal",
        titulo: "Envio de nota fiscal",
        anexoObrigatorio: true,
        anexoAjuda: "Anexe a nota fiscal em PDF.",
        campos: [
          { nome: "competencia", label: "Competência (mês/ano)", tipo: "texto", obrigatorio: true },
          { nome: "valor", label: "Valor da nota (R$)", tipo: "numero" },
        ],
      },
      {
        slug: "pagamento-nao-recebido",
        titulo: "Pagamento não recebido",
        campos: [
          { nome: "competencia", label: "Competência (mês/ano)", tipo: "texto", obrigatorio: true },
          { nome: "valor", label: "Valor esperado (R$)", tipo: "numero" },
        ],
      },
      {
        slug: "divergencia-valor",
        titulo: "Divergência de valor",
        campos: [
          { nome: "competencia", label: "Competência (mês/ano)", tipo: "texto", obrigatorio: true },
          { nome: "valor_recebido", label: "Valor recebido (R$)", tipo: "numero" },
          { nome: "valor_esperado", label: "Valor esperado (R$)", tipo: "numero" },
        ],
      },
      {
        slug: "duvidas-pagamento",
        titulo: "Dúvidas sobre pagamento",
      },
    ],
  },
];

const CATEGORIAS_CLT: Categoria[] = [
  {
    slug: "beneficios",
    titulo: "Benefícios",
    descricao: "Vale, plano de saúde, odontológico e chave Pix de benefícios",
    subcategorias: [
      {
        slug: "alterar-chave-pix",
        titulo: "Mudança de chave Pix",
        campos: CHAVE_PIX_CAMPOS,
      },
      {
        slug: "plano-saude",
        titulo: "Plano de saúde / odontológico",
        descricao: "Inclusão, exclusão de dependente ou carteirinha",
      },
      {
        slug: "vale-transporte-alimentacao",
        titulo: "Vale transporte / alimentação",
      },
      {
        slug: "duvidas-beneficios",
        titulo: "Dúvidas sobre benefícios",
      },
    ],
  },
  {
    slug: "pagamento",
    titulo: "Pagamento",
    descricao: "Holerite, salário, descontos e adiantamentos",
    subcategorias: [
      {
        slug: "holerite",
        titulo: "Holerite / demonstrativo",
        campos: [{ nome: "competencia", label: "Competência (mês/ano)", tipo: "texto", obrigatorio: true }],
      },
      {
        slug: "pagamento-nao-recebido",
        titulo: "Pagamento não recebido",
        campos: [{ nome: "competencia", label: "Competência (mês/ano)", tipo: "texto", obrigatorio: true }],
      },
      {
        slug: "divergencia-valor",
        titulo: "Divergência de valor ou desconto",
        campos: [
          { nome: "competencia", label: "Competência (mês/ano)", tipo: "texto", obrigatorio: true },
          { nome: "valor_recebido", label: "Valor recebido (R$)", tipo: "numero" },
          { nome: "valor_esperado", label: "Valor esperado (R$)", tipo: "numero" },
        ],
      },
      {
        slug: "duvidas-pagamento",
        titulo: "Dúvidas sobre pagamento",
      },
    ],
  },
  {
    slug: "afastamento",
    titulo: "Afastamento",
    descricao: "Licenças, INSS e retorno ao trabalho",
    subcategorias: [
      {
        slug: "comunicar-afastamento",
        titulo: "Comunicar afastamento",
        anexoObrigatorio: true,
        anexoAjuda: "Anexe o atestado ou laudo médico.",
        campos: [
          { nome: "inicio", label: "Início do afastamento", tipo: "data", obrigatorio: true },
          { nome: "dias", label: "Quantidade de dias", tipo: "numero", obrigatorio: true },
          {
            nome: "motivo",
            label: "Motivo",
            tipo: "select",
            obrigatorio: true,
            opcoes: ["Doença", "Acidente", "Licença maternidade", "Licença paternidade", "Outro"],
          },
        ],
      },
      {
        slug: "retorno-afastamento",
        titulo: "Retorno de afastamento",
        campos: [{ nome: "retorno", label: "Data de retorno", tipo: "data", obrigatorio: true }],
      },
      {
        slug: "duvidas-afastamento",
        titulo: "Dúvidas sobre afastamento",
      },
    ],
  },
  {
    slug: "ferias",
    titulo: "Férias",
    descricao: "Solicitação, cancelamento e dúvidas sobre o período aquisitivo",
    subcategorias: [
      {
        slug: "solicitar-ferias",
        titulo: "Solicitar férias",
        campos: [
          { nome: "inicio", label: "Data de início", tipo: "data", obrigatorio: true },
          { nome: "dias", label: "Quantidade de dias", tipo: "numero", obrigatorio: true },
          {
            nome: "abono",
            label: "Deseja vender 1/3 (abono pecuniário)?",
            tipo: "select",
            opcoes: ["Não", "Sim"],
          },
          {
            nome: "adiantamento_13",
            label: "Deseja adiantar a 1ª parcela do 13º?",
            tipo: "select",
            opcoes: ["Não", "Sim"],
          },
          {
            nome: "gestor",
            label: "Gestor que aprovou",
            tipo: "texto",
            obrigatorio: true,
            ajuda: "As férias só são programadas após o aceite do gestor.",
          },
        ],
      },
      {
        slug: "cancelar-ferias",
        titulo: "Cancelar ou reprogramar férias",
        campos: [
          { nome: "periodo", label: "Período já programado", tipo: "texto", obrigatorio: true },
          { nome: "motivo", label: "Motivo do cancelamento", tipo: "textarea", obrigatorio: true },
          { nome: "gestor", label: "Gestor que aprovou", tipo: "texto", obrigatorio: true },
        ],
      },
      {
        slug: "duvidas-ferias",
        titulo: "Dúvidas sobre férias",
      },
    ],
  },
  {
    slug: "auxilio-creche",
    titulo: "Auxílio creche",
    descricao: "Solicitação e comprovações do auxílio",
    subcategorias: [
      {
        slug: "solicitar-auxilio-creche",
        titulo: "Solicitar auxílio creche",
        anexoObrigatorio: true,
        anexoAjuda: "Anexe a certidão de nascimento da criança e o comprovante da creche.",
        campos: [
          { nome: "nome_crianca", label: "Nome da criança", tipo: "texto", obrigatorio: true },
          { nome: "nascimento", label: "Data de nascimento", tipo: "data", obrigatorio: true },
        ],
      },
      {
        slug: "comprovante-mensal",
        titulo: "Envio de comprovante mensal",
        anexoObrigatorio: true,
        anexoAjuda: "Anexe o recibo pago da creche.",
        campos: [
          { nome: "competencia", label: "Competência (mês/ano)", tipo: "texto", obrigatorio: true },
          { nome: "valor", label: "Valor pago (R$)", tipo: "numero" },
        ],
      },
      {
        slug: "duvidas-auxilio-creche",
        titulo: "Dúvidas sobre auxílio creche",
      },
    ],
  },
  {
    slug: "ponto-eletronico",
    titulo: "Ponto eletrônico",
    descricao: "Atestados, ajustes de marcação e banco de horas",
    subcategorias: [
      {
        slug: "envio-atestado",
        titulo: "Envio de atestado",
        anexoObrigatorio: true,
        anexoAjuda: "Anexe a foto ou o PDF do atestado, legível e com o CID/carimbo visível.",
        campos: [
          { nome: "data_atestado", label: "Data do atestado", tipo: "data", obrigatorio: true },
          { nome: "dias", label: "Dias ou horas de afastamento", tipo: "texto", obrigatorio: true },
        ],
      },
      {
        slug: "ajuste-ponto",
        titulo: "Ajuste de marcação de ponto",
        campos: [
          { nome: "data_ocorrencia", label: "Data da marcação", tipo: "data", obrigatorio: true },
          { nome: "horario_correto", label: "Horário correto", tipo: "texto", obrigatorio: true },
          { nome: "gestor", label: "Gestor que aprovou o ajuste", tipo: "texto", obrigatorio: true },
        ],
      },
      {
        slug: "banco-de-horas",
        titulo: "Banco de horas",
      },
      {
        slug: "acesso-ponto",
        titulo: "Acesso ao sistema de ponto",
        descricao: "Senha, cadastro ou app não funciona",
      },
    ],
  },
];

export const CATALOGO: Record<VinculoSlug, Categoria[]> = {
  pj: [...CATEGORIAS_PJ, CATEGORIA_OUTROS],
  clt: [...CATEGORIAS_CLT, CATEGORIA_OUTROS],
  // Estágio segue o mesmo fluxo do CLT, como no desenho do processo.
  estagio: [...CATEGORIAS_CLT, CATEGORIA_OUTROS],
};

export function categoriasDo(vinculo: VinculoSlug): Categoria[] {
  return CATALOGO[vinculo] ?? [];
}

export function acharCategoria(vinculo: VinculoSlug, categoria: string): Categoria | undefined {
  return categoriasDo(vinculo).find((c) => c.slug === categoria);
}

export function acharSubcategoria(
  vinculo: VinculoSlug,
  categoria: string,
  subcategoria: string,
): Subcategoria | undefined {
  return acharCategoria(vinculo, categoria)?.subcategorias.find((s) => s.slug === subcategoria);
}

export function tituloVinculo(slug: string): string {
  return VINCULOS.find((v) => v.slug === slug)?.titulo ?? slug;
}

/** Título legível de "categoria › subcategoria", para painel e e-mails. */
export function rotuloAssunto(vinculo: VinculoSlug, categoria: string, subcategoria: string): string {
  const cat = acharCategoria(vinculo, categoria);
  const sub = acharSubcategoria(vinculo, categoria, subcategoria);
  return [cat?.titulo ?? categoria, sub?.titulo ?? subcategoria].join(" › ");
}
