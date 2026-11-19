import type { Prioridade, Status } from "./dominio";
import type { VinculoSlug } from "./catalogo";
import type { AgravanteId, NivelSla } from "./sla/regras";

export type Chamado = {
  id: string;
  protocolo: string;
  solicitante_nome: string;
  solicitante_email: string;
  solicitante_cpf: string;
  solicitante_telefone: string | null;
  unidade: string | null;
  /** Só para estagiários: quem supervisiona a pessoa. */
  supervisores: string | null;
  vinculo: VinculoSlug;
  categoria: string;
  subcategoria: string;
  assunto: string;
  descricao: string;
  dados_extras: Record<string, string>;
  status: Status;
  prioridade: Prioridade;
  responsavel_id: string | null;
  /** Chamado de teste: fica fora da fila e dos indicadores. */
  de_teste: boolean;
  criado_em: string;
  atualizado_em: string;
  primeira_resposta_em: string | null;
  resolvido_em: string | null;
} & Partial<ColunasSla>;

/** Colunas de SLA. Opcionais: chamados antigos (ou banco sem a migração) não têm. */
export type ColunasSla = {
  sla_nivel: NivelSla | null;
  sla_variante: string | null;
  sla_agravantes: AgravanteId[];
  sla_nivel_manual: NivelSla | null;
  sla_justificativa: string | null;
  sla_primeira_resposta_ate: string | null;
  sla_resolucao_ate: string | null;
  sla_pausado_desde: string | null;
  sla_minutos_pausados: number;
  sla_proximo_prazo: string | null;
  sla_previa_nivel: NivelSla | null;
  sla_previa_variante: string | null;
  sla_previa_agravantes: AgravanteId[] | null;
  sla_sugestoes: { agravante: AgravanteId; termo: string }[];
  sla_confirmado_em: string | null;
  sla_confirmado_por: string | null;
  sla_previa_correta: boolean | null;
  sla_previa_agravantes_corretos: boolean | null;
};

export type Mensagem = {
  id: string;
  chamado_id: string;
  autor_tipo: "colaborador" | "rh" | "sistema";
  autor_nome: string;
  autor_id: string | null;
  corpo: string;
  interna: boolean;
  criado_em: string;
};

export type Anexo = {
  id: string;
  chamado_id: string;
  mensagem_id: string | null;
  caminho: string;
  nome_arquivo: string;
  tipo_mime: string | null;
  tamanho_bytes: number | null;
  criado_em: string;
  /** Preenchido quando o arquivo sai do armazenamento (retenção ou RH). */
  removido_em: string | null;
  removido_por: string | null;
};

export type Evento = {
  id: string;
  chamado_id: string;
  autor_nome: string;
  descricao: string;
  criado_em: string;
};

export type AnexoComLink = Anexo & { url: string | null };

/** Retorno padrão das server actions usadas com useActionState. */
export type EstadoAcao<T = undefined> =
  | { estado: "inicial" }
  | { estado: "erro"; mensagem: string }
  | { estado: "ok"; dados: T };

export const ESTADO_INICIAL: EstadoAcao<never> = { estado: "inicial" };
