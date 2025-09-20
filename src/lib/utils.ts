import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function extractSheetId(url: string): string {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : "";
}

export const isValidCssColor = (str: string) => {
  const s = new Option().style;
  s.color = str;
  return s.color !== "";
};

export const getHexFromKeyword = (keyword: string) => {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return keyword;
  ctx.fillStyle = keyword;
  return ctx.fillStyle;
};

export const HEX_TO_COLOR: Record<string, string> = {
  // CUSTOM
  "#feb914": "Yellow",

  // STANDARD
  "#ffff00": "Yellow",
  "#008000": "Green",
  "#00ff00": "Lime",
  "#ff0000": "Red",
  "#0000ff": "Blue",
  "#ffa500": "Orange",
  "#800080": "Purple",
};

export const normalizeHex = (hex: string) =>
  hex.toLowerCase().replace(/^#?([a-f0-9]{6})$/i, "#$1");
