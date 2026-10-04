// Intermediário entre o site e o TSE.
// Cada arquivo é buscado no TSE no máximo uma vez a cada poucos segundos e entregue a todos
// os visitantes pelo cache da Netlify (durable cache compartilhado entre as regiões).
// Só passam arquivos da divulgação de resultados de 2026; não é um proxy aberto.

const ORIGIN = "https://resultados.tse.jus.br";
const ALLOWED = [
  /^oficial\/ele2026\/\d{3,5}\/(dados|config)\/[a-z]{2}\/[a-z0-9-]+\.json$/,   // resultados e configuração por UF
  /^oficial\/ele2026\/\d{3,5}\/config\/[a-z0-9-]+\.json$/,                    // configuração da eleição
  /^oficial\/ele2026\/\d{3,5}\/fotos\/[a-z]{2}\/\d+\.jpe?g$/,                // fotos dos candidatos
  /^oficial\/comum\/config\/[a-z0-9-]+\.json$/,                               // lista de eleições
];
const TTL_DATA = 30, TTL_PHOTO = 86400;   // o TSE atualiza cada estado a cada ~15 min; 30 s mantém o site em dia e poupa execuções

export default async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/tse\//, "");
  if (!ALLOWED.some(re => re.test(path))) return new Response("Not found", { status: 404 });

  const isPhoto = /\/fotos\//.test(path);
  const ttl = isPhoto ? TTL_PHOTO : TTL_DATA;
  let upstream;
  try {
    upstream = await fetch(`${ORIGIN}/${path}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CentralEleicoes/1.0)", "Accept": isPhoto ? "image/*" : "application/json" },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    // TSE fora do ar ou lento: o CDN continua servindo a última cópia boa (stale-if-error)
    return new Response("Upstream unavailable", { status: 502, headers: { "Cache-Control": "no-store" } });
  }

  const headers = new Headers({
    "Content-Type": upstream.headers.get("content-type") || (isPhoto ? "image/jpeg" : "application/json; charset=utf-8"),
    // navegador: sempre confere com o CDN (responde 304 se nada mudou)
    "Cache-Control": isPhoto ? "public, max-age=86400" : "public, max-age=0, must-revalidate",
    // CDN da Netlify: cópia compartilhada entre todos os visitantes e regiões
    "Netlify-CDN-Cache-Control": upstream.ok
      ? `public, durable, s-maxage=${ttl}, stale-while-revalidate=${ttl * 4}, stale-if-error=600`
      : "public, durable, s-maxage=10",
    "Access-Control-Allow-Origin": "*",
  });
  const lm = upstream.headers.get("last-modified");
  if (lm) headers.set("Last-Modified", lm);

  if (!upstream.ok) return new Response(upstream.status === 404 ? "Not found" : "Upstream error", { status: upstream.status === 404 ? 404 : 502, headers });

  const body = await upstream.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-1", body);
  headers.set("ETag", `"${Buffer.from(hash).toString("base64url").slice(0, 20)}"`);
  return new Response(body, { status: 200, headers });
};

export const config = { path: "/api/tse/*" };
