import sharp from "sharp";
import path from "path";

path.resolve(process.cwd(), "fonts", "fonts.conf");
path.resolve(process.cwd(), "fonts", "Arial Bold.ttf");
path.resolve(process.cwd(), "fonts", "KaiTi.ttf");

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
  "wmsize",
  "wmfont",
  "wmbold",
  "title",
  "titlecolor",
  "titlesize",
  "titlefont",
  "titlebold",
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
  out.set("data", data);

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
  const wm = raw.get("wm") || "";
  const title = raw.get("title") || "";

  if (!margin) {
    if (wm && title) {
      out.set("margin", "40");
    } else if (wm || title) {
      out.set("margin", "35");
    } else {
      out.set("margin", "25");
    }
  }

  const skipList = ["data", "size", "margin", "wm", "title"];
  for (const key of ALLOWED_PARAMS) {
    if (skipList.includes(key)) continue;
    const v = raw.get(key);
    if (v == null) continue;

    const colorKeys = ["color", "bgcolor", "wmcolor", "titlecolor"];
    if (colorKeys.includes(key)) {
      out.set(key, stripHash(v)); // API expects hex without '#'
    } else {
      out.set(key, v);
    }
  }

  return { params: out, wm, title };
}

async function proxy(params: URLSearchParams, wm: string, title: string) {
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

  if (!wm.trim() && !title.trim()) {
    const u8 = new Uint8Array(buffer);
    const body = new Blob([u8.buffer], { type: "image/png" });
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  }

  const side =
    parseInt((params.get("size") ?? "300x300").split("x")[0], 10) || 300;

  const wmColor = stripHash(params.get("wmcolor") || "FF0000");
  const wmFontSize =
    params.get("wmsize") || Math.max(12, Math.round(side * 0.08));
  const yBottom = side - Math.max(8, Math.round(side * 0.01));
  const wmFont = params.get("wmfont");
  const wmBold = params.get("wmbold") == "true";

  const titleColor = stripHash(params.get("titlecolor") || "000000");
  const titleFontSize =
    params.get("titlesize") || Math.max(12, Math.round(side * 0.08));
  const yTop = Math.max(3, Math.round(side * 0.01)) + Number(titleFontSize);
  const titleFont = params.get("titlefont");
  const titleBold = params.get("titlebold") == "true";

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

  ${
    title.trim()
      ? `
  <text
    x="50%"
    y="${yTop}"
    dominant-baseline="hanging"
    text-anchor="middle"
    font-family="${titleFont},'KaiTi','Arial','sans-serif'"
    font-size="${titleFontSize}"
    font-weight="${titleBold ? "bold" : "normal"}"
    fill="#${titleColor}"
    letter-spacing=".8"
  >${escapeXML(title)}</text>`
      : ""
  }

  ${
    wm.trim()
      ? `
  <text
    x="50%"
    y="${yBottom}"
    dominant-baseline="alphabetic"
    text-anchor="middle"
    font-family="${wmFont},'KaiTi','Arial','sans-serif'"
    font-size="${wmFontSize}"
    font-weight="${wmBold ? "bold" : "normal"}"
    fill="#${wmColor}"
    letter-spacing=".8"
  >${escapeXML(wm)}</text>`
      : ""
  }
</svg>`.trim();

  // Single composite, force PNG output
  buffer = await sharp(buffer)
    .composite([{ input: Buffer.from(overlaySvg) }])
    .png()
    .toBuffer();

  const u8 = new Uint8Array(buffer);
  const body = new Blob([u8.buffer], { type: "image/png" });
  return new Response(body, {
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
    const { params, wm, title } = buildParams(url.searchParams);
    return await proxy(params, wm, title);
  } catch (e) {
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

    const { params, wm, title } = buildParams(incoming);
    return await proxy(params, wm, title);
  } catch (e) {
    if (e instanceof Response) return e;
    return new Response("Unexpected error.", { status: 500 });
  }
}
