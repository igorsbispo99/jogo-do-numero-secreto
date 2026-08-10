import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookiesParaGravar = { name: string; value: string; options: CookieOptions }[];

/**
 * Renova a sessão do Supabase a cada navegação e barra o painel do RH
 * para quem não está logado.
 */
export async function middleware(request: NextRequest) {
  let resposta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookiesParaGravar) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          resposta = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            resposta.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const ehLogin = pathname.startsWith("/rh/login");

  if (!user && pathname.startsWith("/rh") && !ehLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/rh/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (user && ehLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/rh";
    return NextResponse.redirect(url);
  }

  return resposta;
}

export const config = {
  matcher: ["/rh/:path*"],
};
