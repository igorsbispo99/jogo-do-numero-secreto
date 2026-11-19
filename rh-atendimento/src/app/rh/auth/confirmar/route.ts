import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseServidor } from "@/lib/supabase/server";

/**
 * Destino do link de "Esqueci minha senha".
 *
 * Aceita os dois formatos do Supabase: `?code=` (padrão, funciona no mesmo
 * navegador em que o pedido foi feito) e `?token_hash=&type=recovery` (modelo
 * de e-mail ajustado no painel do Supabase, funciona em qualquer aparelho).
 * Com a sessão de recuperação aberta, leva para a tela de nova senha.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const tipo = url.searchParams.get("type") as EmailOtpType | null;

  const supabase = await supabaseServidor();
  let ok = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  } else if (tokenHash && tipo === "recovery") {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tipo });
    ok = !error;
  }

  const destino = url.clone();
  destino.search = "";
  destino.pathname = ok ? "/rh/nova-senha" : "/rh/recuperar";
  if (!ok) destino.searchParams.set("erro", "link");
  return NextResponse.redirect(destino);
}
