import "server-only";

/**
 * Rotinas agendadas só aceitam a própria Vercel ou quem tiver o CRON_SECRET.
 * Sem segredo configurado, só a própria Vercel consegue chamar a rota.
 */
export function chamadaDeRotinaAutorizada(request: Request): boolean {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return request.headers.get("user-agent")?.includes("vercel-cron") ?? false;
  return request.headers.get("authorization") === `Bearer ${segredo}`;
}
