import "server-only";
import { STATUS_ABERTOS } from "./dominio";
import {
  emailResumoGestao,
  emailResumoPessoal,
  emailResumoTriagem,
  type ItemResumo,
} from "./email";
import { formatarData } from "./format";
import {
  chaveDoDia,
  ehDiaUtil,
  inicioDoDia,
  inicioDoDiaUtilAnterior,
  inicioDoProximoDiaUtil,
  somarDias,
} from "./sla/calendario";
import { NIVEIS_SLA, ORDEM_NIVEIS, nivelValido, rankNivel } from "./sla/regras";
import { destinatarios } from "./sla/servidor";
import { supabaseAdmin } from "./supabase/admin";

/**
 * Resumo da manhã, enviado em dias úteis pela rotina /api/resumo-diario.
 *
 * - Cada pessoa do RH: chamados atribuídos a ela, vencidos e que vencem hoje
 *   e no próximo dia útil. Quem não tem chamado em aberto não recebe nada.
 * - Gestão: recebidos e respondidos desde o último dia útil, vencidos e fila
 *   por criticidade. Às segundas, também a comparação da semana.
 * - Triagem: SLA a confirmar, sem responsável e situação da 1ª resposta.
 *
 * Os e-mails levam só números e links para a fila filtrada.
 */

type Aberto = {
  id: string;
  responsavel_id: string | null;
  primeira_resposta_em: string | null;
  sla_nivel: string | null;
  sla_primeira_resposta_ate: string | null;
  sla_proximo_prazo: string | null;
  sla_confirmado_em: string | null;
};

type Movimento = {
  criado_em: string;
  primeira_resposta_em: string | null;
  sla_primeira_resposta_ate: string | null;
};

export type RelatorioResumos = {
  diaUtil: boolean;
  referencia: string;
  enviados: { tipo: string; quantidade: number }[];
  pulados: string[];
};

const contar = <T,>(lista: T[], filtro: (item: T) => boolean) => lista.filter(filtro).length;

/** Envia uma vez por destinatário e dia, mesmo que a rotina rode de novo. */
async function enviarUmaVez(
  tipo: string,
  destinatario: string,
  referencia: string,
  enviar: () => Promise<boolean>,
): Promise<boolean> {
  const supabase = supabaseAdmin();
  const { data: registro, error } = await supabase
    .from("notificacoes_enviadas")
    .insert({ tipo, destinatario, referencia })
    .select("id")
    .maybeSingle();

  if (error?.code === "23505") return false; // já enviado hoje
  if (error) console.error("[resumo] registro de envio indisponível:", error.message);

  const ok = await enviar();
  if (!ok && registro) await supabase.from("notificacoes_enviadas").delete().eq("id", registro.id);
  return ok;
}

export async function enviarResumos(opcoes: {
  agora?: Date;
  simular?: boolean;
  forcar?: boolean;
}): Promise<RelatorioResumos> {
  const agora = opcoes.agora ?? new Date();
  const referencia = chaveDoDia(agora);
  const relatorio: RelatorioResumos = { diaUtil: ehDiaUtil(agora), referencia, enviados: [], pulados: [] };

  if (!relatorio.diaUtil && !opcoes.forcar) {
    relatorio.pulados.push("Hoje não é dia útil: nenhum resumo enviado.");
    return relatorio;
  }

  const supabase = supabaseAdmin();
  const hoje = inicioDoDia(agora);
  const fimDeHoje = somarDias(hoje, 1);
  const proximoDia = inicioDoProximoDiaUtil(agora);
  const fimProximoDia = somarDias(proximoDia, 1);
  const inicioJanela = inicioDoDiaUtilAnterior(agora);
  const dia = formatarData(agora);

  const { data: dadosAbertos, error } = await supabase
    .from("chamados")
    .select(
      "id, responsavel_id, primeira_resposta_em, sla_nivel, sla_primeira_resposta_ate, sla_proximo_prazo, sla_confirmado_em",
    )
    .eq("de_teste", false)
    .in("status", STATUS_ABERTOS)
    .limit(10000);
  if (error) throw new Error(`Banco sem as colunas de SLA (rode supabase/schema.sql): ${error.message}`);
  const abertos = (dadosAbertos ?? []) as Aberto[];

  const vencido = (c: Aberto) => !!c.sla_proximo_prazo && new Date(c.sla_proximo_prazo) < agora;
  const venceHoje = (c: Aberto) =>
    !!c.sla_proximo_prazo && new Date(c.sla_proximo_prazo) >= agora && new Date(c.sla_proximo_prazo) < fimDeHoje;
  const venceProximoDia = (c: Aberto) =>
    !!c.sla_proximo_prazo &&
    new Date(c.sla_proximo_prazo) >= proximoDia &&
    new Date(c.sla_proximo_prazo) < fimProximoDia;
  const respostaVencida = (c: Aberto) =>
    !c.primeira_resposta_em && !!c.sla_primeira_resposta_ate && new Date(c.sla_primeira_resposta_ate) < agora;
  const respostaHoje = (c: Aberto) =>
    !c.primeira_resposta_em &&
    !!c.sla_primeira_resposta_ate &&
    new Date(c.sla_primeira_resposta_ate) >= agora &&
    new Date(c.sla_primeira_resposta_ate) < fimDeHoje;

  const registrar = (tipo: string, enviados: number) => relatorio.enviados.push({ tipo, quantidade: enviados });

  // ---------------------------------------------------------------- Pessoal
  let equipe = await supabase.from("rh_usuarios").select("id, nome, email, recebe_resumo").eq("ativo", true);
  if (equipe.error) {
    // Sem a coluna recebe_resumo: todo mundo ativo recebe.
    equipe = (await supabase.from("rh_usuarios").select("id, nome, email").eq("ativo", true)) as typeof equipe;
  }
  let pessoais = 0;
  for (const pessoa of equipe.data ?? []) {
    if (pessoa.recebe_resumo === false) continue;
    const meus = abertos.filter((c) => c.responsavel_id === pessoa.id);
    if (meus.length === 0) continue;

    const itens: ItemResumo[] = [
      { rotulo: "Atribuídos a você, em aberto", valor: meus.length, href: "/rh?responsavel=meus&ordem=prazo" },
      {
        rotulo: "Vencidos",
        valor: contar(meus, vencido),
        href: "/rh?responsavel=meus&prazo=vencidos&ordem=prazo",
        destaque: contar(meus, vencido) ? "vermelho" : "neutro",
      },
      {
        rotulo: "Vencem hoje",
        valor: contar(meus, venceHoje),
        href: "/rh?responsavel=meus&prazo=hoje&ordem=prazo",
        destaque: contar(meus, venceHoje) ? "ambar" : "neutro",
      },
      { rotulo: `Vencem no próximo dia útil (${formatarData(proximoDia)})`, valor: contar(meus, venceProximoDia) },
    ];
    if (opcoes.simular) {
      pessoais += 1;
      continue;
    }
    const ok = await enviarUmaVez("resumo-pessoal", pessoa.email, referencia, () =>
      emailResumoPessoal({ para: pessoa.email, nome: pessoa.nome, dia, itens }),
    );
    if (ok) pessoais += 1;
  }
  registrar(opcoes.simular ? "resumo-pessoal (simulado)" : "resumo-pessoal", pessoais);

  // ---------------------------------------------------------------- Gestão
  const gestao = await destinatarios(["gestao"]);
  if (gestao.length === 0) {
    relatorio.pulados.push("Sem destinatários de gestão cadastrados.");
  } else {
    const desde14 = somarDias(hoje, -14).toISOString();
    const { data: movimento } = await supabase
      .from("chamados")
      .select("criado_em, primeira_resposta_em, sla_primeira_resposta_ate")
      .eq("de_teste", false)
      .or(`criado_em.gte.${desde14},primeira_resposta_em.gte.${desde14}`)
      .limit(10000);
    const mov = (movimento ?? []) as Movimento[];

    const entre = (iso: string | null, de: Date, ate: Date) => !!iso && new Date(iso) >= de && new Date(iso) < ate;
    const noPeriodo = (de: Date, ate: Date) => {
      const recebidos = contar(mov, (m) => entre(m.criado_em, de, ate));
      const respondidos = mov.filter((m) => entre(m.primeira_resposta_em, de, ate));
      const comPrazo = respondidos.filter((m) => m.sla_primeira_resposta_ate);
      const noPrazo = contar(comPrazo, (m) => new Date(m.primeira_resposta_em!) <= new Date(m.sla_primeira_resposta_ate!));
      return {
        recebidos,
        respondidos: respondidos.length,
        noPrazo: comPrazo.length ? `${Math.round((noPrazo / comPrazo.length) * 100)}%` : "-",
      };
    };

    const ontem = noPeriodo(inicioJanela, hoje);
    const desde30 = somarDias(hoje, -30).toISOString();
    const { data: confirmados } = await supabase
      .from("chamados")
      .select("sla_previa_correta, sla_previa_nivel, sla_nivel")
      .eq("de_teste", false)
      .not("sla_previa_correta", "is", null)
      .gte("sla_confirmado_em", desde30)
      .limit(10000);
    const avaliados = confirmados ?? [];
    const acerto = avaliados.length
      ? `${Math.round((contar(avaliados, (c) => c.sla_previa_correta === true) / avaliados.length) * 100)}%`
      : "-";
    const abaixo = contar(
      avaliados,
      (c) => nivelValido(c.sla_previa_nivel) && nivelValido(c.sla_nivel) && rankNivel(c.sla_previa_nivel) < rankNivel(c.sla_nivel),
    );

    const periodo =
      inicioJanela.getTime() === somarDias(hoje, -1).getTime()
        ? `ontem (${formatarData(inicioJanela)})`
        : `${formatarData(inicioJanela)} até ontem`;

    const blocos: { titulo: string; itens: ItemResumo[] }[] = [
      {
        titulo: `Movimento de ${periodo}`,
        itens: [
          { rotulo: "Chamados recebidos", valor: ontem.recebidos },
          { rotulo: "Chamados respondidos (1ª resposta)", valor: ontem.respondidos },
          { rotulo: "1ª resposta dentro do prazo", valor: ontem.noPrazo },
        ],
      },
      {
        titulo: "Fila agora",
        itens: [
          { rotulo: "Em aberto", valor: abertos.length, href: "/rh" },
          {
            rotulo: "Vencidos",
            valor: contar(abertos, vencido),
            href: "/rh?prazo=vencidos&ordem=prazo",
            destaque: contar(abertos, vencido) ? "vermelho" : "neutro",
          },
          ...[...ORDEM_NIVEIS].reverse().map((n) => ({
            rotulo: `Criticidade ${NIVEIS_SLA[n].titulo}`,
            valor: contar(abertos, (c) => c.sla_nivel === n),
            href: `/rh?criticidade=${n}&ordem=prazo`,
            destaque: (n === "critica" && contar(abertos, (c) => c.sla_nivel === n) ? "vermelho" : "neutro") as ItemResumo["destaque"],
          })),
          { rotulo: "Sem classificação de SLA", valor: contar(abertos, (c) => !c.sla_nivel), href: "/rh?criticidade=sem" },
        ],
      },
      {
        titulo: "Prévia automática (últimos 30 dias)",
        itens: [
          { rotulo: "SLAs confirmados pela triagem", valor: avaliados.length },
          { rotulo: "Acerto do nível", valor: acerto },
          { rotulo: "Prévia abaixo do nível oficial", valor: abaixo, destaque: abaixo ? "ambar" : "neutro" },
        ],
      },
    ];

    // Segunda-feira: a semana que passou comparada com a anterior.
    if (new Date(hoje.getTime() + 3 * 60 * 60_000).getUTCDay() === 1) {
      const semana = noPeriodo(somarDias(hoje, -7), hoje);
      const anterior = noPeriodo(somarDias(hoje, -14), somarDias(hoje, -7));
      blocos.push({
        titulo: "Semana passada (comparada com a anterior)",
        itens: [
          { rotulo: "Recebidos", valor: `${semana.recebidos} (antes: ${anterior.recebidos})` },
          { rotulo: "Respondidos", valor: `${semana.respondidos} (antes: ${anterior.respondidos})` },
          { rotulo: "1ª resposta no prazo", valor: `${semana.noPrazo} (antes: ${anterior.noPrazo})` },
        ],
      });
    }

    let enviados = 0;
    for (const email of gestao) {
      if (opcoes.simular) {
        enviados += 1;
        continue;
      }
      const ok = await enviarUmaVez("resumo-gestao", email, referencia, () =>
        emailResumoGestao({ para: [email], dia, periodo, blocos }),
      );
      if (ok) enviados += 1;
    }
    registrar(opcoes.simular ? "resumo-gestao (simulado)" : "resumo-gestao", enviados);
  }

  // ---------------------------------------------------------------- Triagem
  const triagem = await destinatarios(["triagem"]);
  if (triagem.length === 0) {
    relatorio.pulados.push("Sem destinatários de triagem cadastrados.");
  } else {
    const aConfirmar = contar(abertos, (c) => !!c.sla_nivel && !c.sla_confirmado_em);
    const semClassificacao = contar(abertos, (c) => !c.sla_nivel);
    const semResponsavel = contar(abertos, (c) => !c.responsavel_id);
    const vencidas = contar(abertos, respostaVencida);
    const hojeResp = contar(abertos, respostaHoje);

    const itens: ItemResumo[] = [
      { rotulo: "SLA a confirmar", valor: aConfirmar, href: "/rh?classificacao=pendente&ordem=prazo", destaque: aConfirmar ? "ambar" : "neutro" },
      { rotulo: "Sem classificação de SLA", valor: semClassificacao, href: "/rh?criticidade=sem" },
      { rotulo: "Sem responsável", valor: semResponsavel, href: "/rh?responsavel=sem&ordem=prazo", destaque: semResponsavel ? "ambar" : "neutro" },
      { rotulo: "1ª resposta vencida", valor: vencidas, href: "/rh?prazo=resposta-vencida&ordem=prazo", destaque: vencidas ? "vermelho" : "neutro" },
      { rotulo: "1ª resposta vence hoje", valor: hojeResp, href: "/rh?prazo=hoje&ordem=prazo", destaque: hojeResp ? "ambar" : "neutro" },
    ];

    if (aConfirmar + semClassificacao + semResponsavel + vencidas + hojeResp === 0) {
      relatorio.pulados.push("Triagem sem pendências: nada enviado.");
    } else {
      let enviados = 0;
      for (const email of triagem) {
        if (opcoes.simular) {
          enviados += 1;
          continue;
        }
        const ok = await enviarUmaVez("resumo-triagem", email, referencia, () =>
          emailResumoTriagem({ para: [email], dia, itens }),
        );
        if (ok) enviados += 1;
      }
      registrar(opcoes.simular ? "resumo-triagem (simulado)" : "resumo-triagem", enviados);
    }
  }

  return relatorio;
}
