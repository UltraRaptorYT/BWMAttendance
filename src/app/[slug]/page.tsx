"use client";

import { useParams } from "next/navigation";

export default function CustomScannerPage() {
  const { slug } = useParams();

  return <div>{slug}</div>;
}
