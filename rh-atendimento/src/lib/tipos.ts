import type { Prioridade, Status } from "./dominio";
import type { VinculoSlug } from "./catalogo";

export type Chamado = {
  id: string;
  protocolo: string;
  solicitante_nome: string;
  solicitante_email: string;
  solicitante_cpf: string;
  solicitante_telefone: string | null;
  unidade: string | null;
  vinculo: VinculoSlug;
  categoria: string;
  subcategoria: string;
  assunto: string;
  descricao: string;
  dados_extras: Record<string, string>;
  status: Status;
  prioridade: Prioridade;
  responsavel_id: string | null;
  criado_em: string;
  atualizado_em: string;
  primeira_resposta_em: string | null;
  resolvido_em: string | null;
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
