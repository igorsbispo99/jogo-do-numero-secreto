import { z } from "zod";
import { acharSubcategoria, type VinculoSlug } from "./catalogo";
import { apenasDigitos, cpfValido } from "./format";

export const vinculoSchema = z.enum(["pj", "clt", "estagio"]);

export const novoChamadoSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(5, "Informe seu nome completo.")
    .max(120)
    .refine((v) => v.split(/\s+/).length >= 2, "Informe nome e sobrenome."),
  email: z.string().trim().toLowerCase().email("E-mail inválido.").max(160),
  cpf: z
    .string()
    .transform(apenasDigitos)
    .refine(cpfValido, "CPF inválido."),
  telefone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => (v ? v : undefined)),
  unidade: z.string().trim().max(120).optional(),
  vinculo: vinculoSchema,
  categoria: z.string().trim().min(1).max(80),
  subcategoria: z.string().trim().min(1).max(80),
  // O tamanho mínimo é conferido na ação, porque depende do assunto escolhido.
  descricao: z.string().trim().max(5000),
});

export type NovoChamado = z.infer<typeof novoChamadoSchema>;

export const respostaColaboradorSchema = z.object({
  protocolo: z.string().trim().min(4).max(40),
  cpf: z.string().transform(apenasDigitos).refine(cpfValido, "CPF inválido."),
  mensagem: z.string().trim().min(2, "Escreva sua mensagem.").max(5000),
});

export const consultaSchema = z.object({
  protocolo: z.string().trim().min(4, "Informe o protocolo.").max(40),
  cpf: z.string().transform(apenasDigitos).refine(cpfValido, "CPF inválido."),
});

export const respostaRhSchema = z.object({
  chamadoId: z.string().uuid(),
  mensagem: z.string().trim().min(1, "Escreva a resposta.").max(8000),
  interna: z.coerce.boolean().optional().default(false),
  novoStatus: z
    .enum(["aberto", "em_andamento", "aguardando_colaborador", "resolvido", "cancelado"])
    .optional(),
});

export const atualizarChamadoSchema = z.object({
  chamadoId: z.string().uuid(),
  status: z
    .enum(["aberto", "em_andamento", "aguardando_colaborador", "resolvido", "cancelado"])
    .optional(),
  prioridade: z.enum(["baixa", "normal", "alta", "urgente"]).optional(),
  responsavelId: z.string().uuid().nullable().optional(),
});

/**
 * Valida os campos extras declarados no catálogo para a subcategoria escolhida.
 * Retorna os dados já limpos ou a lista de erros.
 */
export function validarCamposExtras(
  vinculo: VinculoSlug,
  categoria: string,
  subcategoria: string,
  formData: FormData,
): { ok: true; dados: Record<string, string> } | { ok: false; erro: string } {
  const sub = acharSubcategoria(vinculo, categoria, subcategoria);
  if (!sub) return { ok: false, erro: "Categoria inválida. Recomece a solicitação." };

  const valorDe = (nome: string) => {
    const bruto = formData.get(`extra_${nome}`);
    return typeof bruto === "string" ? bruto.trim() : "";
  };

  const dados: Record<string, string> = {};
  for (const campo of sub.campos ?? []) {
    // Campo que só aparece em certa condição não é cobrado quando ela não vale.
    if (campo.mostrarSe && valorDe(campo.mostrarSe.campo) !== campo.mostrarSe.valor) continue;

    const valor = valorDe(campo.nome);

    if (!valor) {
      if (campo.obrigatorio) return { ok: false, erro: `Preencha o campo "${campo.label}".` };
      continue;
    }
    if (valor.length > 500) return { ok: false, erro: `O campo "${campo.label}" é muito longo.` };
    if (campo.tipo === "select" && campo.opcoes && !campo.opcoes.includes(valor)) {
      return { ok: false, erro: `Opção inválida em "${campo.label}".` };
    }
    if (campo.tipo === "numero" && Number.isNaN(Number(valor.replace(",", ".")))) {
      return { ok: false, erro: `O campo "${campo.label}" precisa ser um número.` };
    }
    dados[campo.label] = valor;
  }

  return { ok: true, dados };
}

/** Primeira mensagem de erro de um ZodError, em português. */
export function primeiroErro(erro: z.ZodError): string {
  return erro.issues[0]?.message ?? "Verifique os dados informados.";
}
