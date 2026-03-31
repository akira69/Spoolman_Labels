import { CSSProperties, useEffect, useMemo, useState } from "react";
import { IVendor } from "../pages/vendors/model";
import { getVendorLogoCandidates } from "../utils/vendorLogo";

interface VendorLogoProps {
  vendor?: IVendor;
  usePrintLogo?: boolean;
  showFallbackText?: boolean;
  imgStyle?: CSSProperties;
  fallbackStyle?: CSSProperties;
}

export function VendorLogo({
  vendor,
  usePrintLogo = false,
  showFallbackText = false,
  imgStyle,
  fallbackStyle,
}: VendorLogoProps) {
  const candidates = useMemo(() => getVendorLogoCandidates(vendor, usePrintLogo), [vendor, usePrintLogo]);
  const [currentCandidateIndex, setCurrentCandidateIndex] = useState(0);
  useEffect(() => {
    setCurrentCandidateIndex(0);
  }, [vendor, usePrintLogo]);

  const currentSrc = candidates[currentCandidateIndex];
  const fallbackText = vendor?.name ?? "";

  if (currentSrc) {
    return (
      <img
        src={currentSrc}
        alt={vendor?.name ? `${vendor.name} logo` : "Manufacturer logo"}
        style={imgStyle}
        onError={() => {
          setCurrentCandidateIndex((idx) => idx + 1);
        }}
      />
    );
  }

  if (showFallbackText && fallbackText) {
    return <div style={fallbackStyle}>{fallbackText}</div>;
  }

  return null;
}

export default VendorLogo;
