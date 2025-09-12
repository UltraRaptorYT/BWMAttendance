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
