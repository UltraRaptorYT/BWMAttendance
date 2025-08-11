import sharp from "sharp";

export const runtime = "nodejs";

const ALLOWED_PARAMS = new Set([
  "data",
  "size",
  "charset-source",
  "charset-target",
  "ecc",
  "color",
  "bgcolor",
  "margin",
  "qzone",
  "format",
  "wm",
  "wmcolor",
]);

const stripHash = (v: string) => v.replace(/^#/, "").toUpperCase();
const isSquare = (s: string) => {
  const m = s.match(/^(\d+)x(\d+)$/i);
  return !!m && m[1] === m[2];
};

function buildParams(raw: URLSearchParams) {
  const out = new URLSearchParams();

  const data = raw.get("data");
  if (!data || data.length < 1) {
    throw new Response("Missing required `data` query param.", { status: 400 });
  }
  out.set("data", encodeURIComponent(data));

  let size = raw.get("size") || "";
  if (!size) {
    size = "300x300";
  } else if (/^\d+$/i.test(size)) {
    size = `${size}x${size}`;
  } else if (!isSquare(size)) {
    throw new Response(
      "`size` must be square like 300x300 (or a single integer).",
      { status: 400 }
    );
  }
  out.set("size", size);

  const margin = raw.get("margin");
  if (!margin) {
    out.set("margin", "30");
  }

  const skipList = ["data", "size", "margin", "wm"];
  for (const key of ALLOWED_PARAMS) {
    if (skipList.includes(key)) continue;
    const v = raw.get(key);
    if (v == null) continue;

    if (key === "color" || key === "bgcolor" || key === "wmcolor") {
      out.set(key, stripHash(v)); // API expects hex without '#'
    } else {
      out.set(key, v);
    }
  }

  return { params: out, wm: raw.get("wm") || "" };
}

async function proxy(params: URLSearchParams, wm: string) {
  const upstream = `https://api.qrserver.com/v1/create-qr-code/?${params.toString()}`;

  const res = await fetch(upstream, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Response(`Upstream error (${res.status}): ${text}`, {
      status: 502,
    });
  }

  const ab = await res.arrayBuffer();
  let buffer: Buffer = await sharp(Buffer.from(ab as ArrayBuffer))
    .png()
    .toBuffer();

  if (!wm.trim()) {
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  }

  const side =
    parseInt((params.get("size") ?? "300x300").split("x")[0], 10) || 300;

  const wmColorRaw = params.get("wmcolor") || "FF0000";
  const wmColor = stripHash(wmColorRaw);

  const fontSize = Math.max(12, Math.round(side * 0.08));
  const y = side - Math.max(8, Math.round(side * 0.04));

  const escapeXML = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Build SVG overlay at the same dimensions as the QR
  const overlaySvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}" viewBox="0 0 ${side} ${side}">
  <defs>
    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="1" stdDeviation="1" flood-opacity="0.35"/>
    </filter>
  </defs>
  <text
    x="50%"
    y="${y}"
    text-anchor="middle"
    dominant-baseline="middle"
    font-size="${fontSize}"
    font-weight="700"
    font-family="Arial, Helvetica, sans-serif"
    fill="#${wmColor}"
    filter="url(#shadow)"
  >${escapeXML(wm)}</text>
</svg>`.trim();

  // Single composite, force PNG output
  buffer = await sharp(buffer)
    .composite([{ input: Buffer.from(overlaySvg) }]) // overlay drawn at (0,0) within same-size SVG
    .png()
    .toBuffer();

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const { params, wm } = buildParams(url.searchParams);
    return await proxy(params, wm);
  } catch (e: any) {
    if (e instanceof Response) return e;
    return new Response("Unexpected error.", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const ct = req.headers.get("content-type") || "";
    let incoming = new URLSearchParams();

    if (ct.includes("application/json")) {
      const json = await req.json();
      for (const [k, v] of Object.entries(json || {})) {
        if (typeof v === "string") incoming.set(k, v);
      }
    } else if (ct.includes("application/x-www-form-urlencoded")) {
      incoming = new URLSearchParams(await req.text());
    } else if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      for (const [k, v] of form.entries()) {
        if (typeof v === "string") incoming.set(k, v);
      }
    } else {
      return new Response("Unsupported Content-Type for POST.", {
        status: 415,
      });
    }

    const { params, wm } = buildParams(incoming);
    return await proxy(params, wm);
  } catch (e: any) {
    if (e instanceof Response) return e;
    return new Response("Unexpected error.", { status: 500 });
  }
}
