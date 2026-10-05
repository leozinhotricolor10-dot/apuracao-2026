// Entrega o histórico (/api/hist/1-br) e o resumo (/api/resumo/dep6) guardados pela coleta automática.
import { getStore } from "@netlify/blobs";

const HIST = /^[135]-(br|[a-z]{2})$/;
const RESUMO = /^dep6$/;

export default async (req) => {
  const { pathname } = new URL(req.url);
  const m = pathname.match(/^\/api\/(hist|resumo)\/([a-z0-9-]+)$/);
  if (!m || !(m[1] === "hist" ? HIST : RESUMO).test(m[2])) return new Response("Not found", { status: 404 });
  const data = await getStore("apuracao").get(`${m[1]}/${m[2]}`, { type: "text" });
  if (!data) return new Response("[]", { status: 404, headers: { "Content-Type": "application/json", "Netlify-CDN-Cache-Control": "public, durable, s-maxage=20" } });
  return new Response(data, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Netlify-CDN-Cache-Control": "public, durable, s-maxage=60, stale-while-revalidate=120",
    },
  });
};

export const config = { path: ["/api/hist/*", "/api/resumo/*"] };
