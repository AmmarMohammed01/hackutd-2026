const ORIGIN_HOST = "origin.givemeasign.study";

const TUNNEL_DOWN = new Set([502, 503, 521, 522, 523, 524, 530]);

export default {
  async fetch(request, env) {
    const incoming = new URL(request.url);
    const origin = new URL(request.url);
    origin.hostname = ORIGIN_HOST;
    origin.protocol = "https:";

    try {
      const response = await fetch(new Request(origin, request));
      if (!TUNNEL_DOWN.has(response.status)) return response;
    } catch {
      // The tunnel process is stopped, or the laptop is offline.
    }

    return offlinePage(request, env, incoming);
  },
};

async function offlinePage(request, env, incoming) {
  if (incoming.pathname.startsWith("/api")) {
    return Response.json(
      { ok: false, detail: "The live demo is off." },
      { status: 503 },
    );
  }

  const page = await env.ASSETS.fetch(new URL("/index.html", request.url));
  return new Response(page.body, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
