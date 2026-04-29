type TicketPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function buildQrLink(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const rawQrLink = getParamValue(searchParams.qrlink);

  if (!rawQrLink) return undefined;

  try {
    const url = new URL(rawQrLink);

    // Re-attach params that accidentally became /ticket params
    for (const [key, value] of Object.entries(searchParams)) {
      if (key === "qrlink") continue;

      const cleanValue = getParamValue(value);
      if (cleanValue) {
        url.searchParams.set(key, cleanValue);
      }
    }

    return url.toString();
  } catch {
    return undefined;
  }
}

function getQrTitle(qrlink?: string) {
  if (!qrlink) return "QR Ticket";

  try {
    const url = new URL(qrlink);

    const title = url.searchParams.get("title");
    const wm = url.searchParams.get("wm");

    if (title && wm) return `${title} - ${wm} Ticket`;
    if (title) return `${title} Ticket`;
    if (wm) return `${wm} Ticket`;

    return "QR Ticket";
  } catch {
    return "QR Ticket";
  }
}

export async function generateMetadata({ searchParams }: TicketPageProps) {
  const resolvedSearchParams = await searchParams;

  const qrLink = buildQrLink(resolvedSearchParams);
  const pageTitle = getQrTitle(qrLink);

  return {
    title: pageTitle,
    description: "Show this QR code during registration.",
    openGraph: {
      title: pageTitle,
      description: "Show this QR code during registration.",
      images: qrLink
        ? [
            {
              url: qrLink,
              width: 300,
              height: 300,
              alt: pageTitle,
            },
          ]
        : [],
    },
  };
}

export default async function TicketPage({ searchParams }: TicketPageProps) {
  const resolvedSearchParams = await searchParams;

  const qrLink = buildQrLink(resolvedSearchParams);
  const pageTitle = getQrTitle(qrLink);

  return (
    <main>
      <h1>{pageTitle}</h1>

      {qrLink ? (
        <img src={qrLink} alt={pageTitle} />
      ) : (
        <p>No QR link provided.</p>
      )}
    </main>
  );
}
