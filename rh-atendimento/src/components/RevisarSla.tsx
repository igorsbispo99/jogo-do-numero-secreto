"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { classificarSla, type EstadoSimples } from "@/actions/rh";
import { AGRAVANTES, NIVEIS_SLA, ORDEM_NIVEIS, type AgravanteId, type NivelSla } from "@/lib/sla/regras";

const INICIAL: EstadoSimples = { estado: "inicial" };

const COR_EFEITO: Record<string, string> = {
  critica: "bg-tea-vinho-100 text-tea-vinho-800",
  alta: "bg-tea-ambar-100 text-tea-ambar-800",
  sobe: "bg-tea-turquesa-100 text-tea-turquesa-800",
  "sobe-ate-alta": "bg-tea-turquesa-100 text-tea-turquesa-800",
};

export function RevisarSla({
  chamadoId,
  confirmado,
  variantes,
  varianteAtual,
  agravantesAtuais,
  sugestoes,
  nivelManualAtual,
  justificativaAtual,
}: {
  chamadoId: string;
  confirmado: boolean;
  variantes: { titulo: string; opcoes: { nome: string; nivel: NivelSla }[] } | null;
  varianteAtual: string | null;
  agravantesAtuais: AgravanteId[];
  sugestoes: { agravante: AgravanteId; termo: string }[];
  nivelManualAtual: NivelSla | null;
  justificativaAtual: string | null;
}) {
  const [estado, acao] = useActionState(classificarSla, INICIAL);
  const varianteInicial = varianteAtual ?? variantes?.opcoes[0]?.nome ?? "";
  const [marcados, setMarcados] = useState<AgravanteId[]>(agravantesAtuais);
  const [variante, setVariante] = useState(varianteInicial);
  const [manual, setManual] = useState<string>(nivelManualAtual ?? "");

  const alterado = useMemo(
    () =>
      variante !== varianteInicial ||
      manual !== (nivelManualAtual ?? "") ||
      marcados.length !== agravantesAtuais.length ||
      marcados.some((m) => !agravantesAtuais.includes(m)),
    [variante, manual, marcados, varianteInicial, nivelManualAtual, agravantesAtuais],
  );

  const termoDe = (id: AgravanteId) => sugestoes.find((s) => s.agravante === id)?.termo;

  return (
    <form action={acao} className="cartao space-y-4 p-5">
      <input type="hidden" name="chamadoId" value={chamadoId} />
      <div>
        <h2 className="text-sm font-bold text-slate-900">
          {confirmado ? "Reclassificar SLA" : "Confirmar ou revisar o SLA"}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          {confirmado
            ? "Mude só se algo novo apareceu no chamado. A mudança fica no histórico."
            : "A prévia foi calculada pelo assunto, pelos campos do formulário e por palavras do relato. Leia o chamado e confirme, ou ajuste antes de confirmar."}
        </p>
      </div>

      {variantes && (
        <div>
          <label className="rotulo" htmlFor="variante">
            {variantes.titulo}
          </label>
          <select
            id="variante"
            name="variante"
            value={variante}
            onChange={(e) => setVariante(e.target.value)}
            className="campo"
          >
            {variantes.opcoes.map((o) => (
              <option key={o.nome} value={o.nome}>
                {o.nome} · {NIVEIS_SLA[o.nivel].titulo}
              </option>
            ))}
          </select>
        </div>
      )}

      <fieldset className="space-y-2">
        <legend className="rotulo">Agravantes</legend>
        {AGRAVANTES.map((a) => {
          const termo = termoDe(a.id);
          return (
            <label
              key={a.id}
              htmlFor={`ag-${a.id}`}
              className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 has-[:checked]:border-tea-turquesa-500 has-[:checked]:bg-tea-turquesa-50"
            >
              <input
                id={`ag-${a.id}`}
                type="checkbox"
                name="agravante"
                value={a.id}
                checked={marcados.includes(a.id)}
                onChange={(e) =>
                  setMarcados((atual) =>
                    e.target.checked ? [...atual, a.id] : atual.filter((x) => x !== a.id),
                  )
                }
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300"
              />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{a.titulo}</span>
                {termo && (
                  <span className="block text-xs text-tea-ambar-800">Sugerido pelo relato: “{termo}”</span>
                )}
              </span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${COR_EFEITO[a.efeito]}`}>
                {a.rotulo}
              </span>
            </label>
          );
        })}
      </fieldset>

      <div>
        <label className="rotulo" htmlFor="nivelManual">
          Ajuste manual do nível
        </label>
        <select
          id="nivelManual"
          name="nivelManual"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          className="campo"
        >
          <option value="">Seguir o cálculo</option>
          {[...ORDEM_NIVEIS].reverse().map((n) => (
            <option key={n} value={n}>
              {NIVEIS_SLA[n].titulo}
            </option>
          ))}
        </select>
        {manual && (
          <div className="mt-2">
            <label className="rotulo" htmlFor="justificativa">
              Por que ajustar?
            </label>
            <input
              id="justificativa"
              name="justificativa"
              defaultValue={justificativaAtual ?? ""}
              required
              maxLength={500}
              className="campo"
              placeholder="Ex.: o colaborador já foi atendido por telefone"
            />
          </div>
        )}
      </div>

      <Botao rotulo={!confirmado && !alterado ? "Confirmar SLA" : alterado ? "Salvar revisão" : "Reconfirmar"} />

      {estado.estado === "erro" && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800 ring-1 ring-red-600/20">
          {estado.mensagem}
        </p>
      )}
      {estado.estado === "ok" && estado.mensagem && (
        <p className="text-sm font-medium text-tea-turquesa-700">{estado.mensagem}</p>
      )}
    </form>
  );
}

function Botao({ rotulo }: { rotulo: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="botao-primario w-full">
      {pending ? "Salvando..." : rotulo}
    </button>
  );
}
