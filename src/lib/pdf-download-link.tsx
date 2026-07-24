import { useEffect, useState, type ReactNode } from "react";
import type { PDFAuthData } from "./authorization-pdf";

type Mod = {
  PDFDownloadLink: typeof import("@react-pdf/renderer").PDFDownloadLink;
  AuthorizationPDF: typeof import("./authorization-pdf").AuthorizationPDF;
};

export function PdfDownloadLink({
  data, fileName, children, className,
}: {
  data: PDFAuthData;
  fileName: string;
  children: ReactNode;
  className?: string;
}) {
  const [mod, setMod] = useState<Mod | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      import("@react-pdf/renderer"),
      import("./authorization-pdf"),
    ]).then(([r, p]) => {
      if (!alive) return;
      setMod({ PDFDownloadLink: r.PDFDownloadLink, AuthorizationPDF: p.AuthorizationPDF });
    });
    return () => { alive = false; };
  }, []);

  if (!mod) {
    return (
      <span className={className} aria-busy="true">
        {children}
      </span>
    );
  }

  const { PDFDownloadLink: DL, AuthorizationPDF } = mod;
  return (
    <DL
      document={<AuthorizationPDF data={data} />}
      fileName={fileName}
      className={className}
    >
      {({ loading }) => (loading ? "Preparing PDF…" : children)}
    </DL>
  );
}

/** Generate the PDF as a Blob (for upload/email). Dynamically imports to keep it out of SSR. */
export async function generateAuthorizationPdfBlob(data: PDFAuthData): Promise<Blob> {
  const [{ pdf }, { AuthorizationPDF }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("./authorization-pdf"),
  ]);
  return pdf(<AuthorizationPDF data={data} />).toBlob();
}
