"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";

interface CompanyLogoProps {
  website: string | null;
  size?: number;
}

function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return parsed.hostname.replace("www.", "");
  } catch {
    return null;
  }
}

export function CompanyLogo({ website, size = 16 }: CompanyLogoProps) {
  const [hasError, setHasError] = useState(false);

  const domain = website ? extractDomain(website) : null;

  if (!domain || hasError) {
    return <Building2 className="text-muted-foreground/60" style={{ width: size, height: size }} />;
  }

  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

  return (
    <img
      src={faviconUrl}
      alt=""
      width={size}
      height={size}
      className="rounded-sm"
      onError={() => setHasError(true)}
    />
  );
}
