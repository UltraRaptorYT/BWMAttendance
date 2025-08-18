import sharp from "sharp";
import { createCanvas } from "@napi-rs/canvas";

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

function hexToRgb(hex: string) {
  const clean = hex.replace(/^#/, "");
  const bigint = parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return { r, g, b };
}

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
  const wm = raw.get("wm");
  if (!margin) {
    if (wm) {
      out.set("margin", "30");
    } else {
      out.set("margin", "25");
    }
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

async function createWatermarkBuffer(
  text: string,
  width: number,
  height: number,
  color: string
): Promise<Buffer> {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Clear canvas with transparency
  ctx.clearRect(0, 0, width, height);

  // Calculate font size and position
  const fontSize = Math.max(12, Math.round(width * 0.08));
  const y = height - Math.max(8, Math.round(height * 0.04));

  // Set up text shadow
  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 1;
  ctx.shadowBlur = 2;

  // Set text properties
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Parse color and set fill style
  const rgb = hexToRgb(color);
  ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;

  // Draw text
  ctx.fillText(text, width / 2, y);

  // Convert canvas to buffer
  return canvas.toBuffer("image/png");
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

  // Get dimensions
  const side =
    parseInt((params.get("size") ?? "300x300").split("x")[0], 10) || 300;

  // Get watermark color
  const wmColorRaw = params.get("wmcolor") || "FF0000";
  const wmColor = stripHash(wmColorRaw);

  // Create watermark using canvas
  const watermarkBuffer = await createWatermarkBuffer(wm, side, side, wmColor);

  // Composite watermark onto QR code
  buffer = await sharp(buffer)
    .composite([
      {
        input: watermarkBuffer,
        top: 0,
        left: 0,
      },
    ])
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
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("GET error:", e);
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
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("POST error:", e);
    return new Response("Unexpected error.", { status: 500 });
  }
}
