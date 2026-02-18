import { getBasePath } from "./url";
import { IVendor } from "../pages/vendors/model";

export interface VendorLogoManifestPaths {
  web_files?: string[];
  print_files?: string[];
}

export function parseExtraString(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "string" ? parsed.trim() : undefined;
  } catch {
    return value.trim();
  }
}

function normalizeUrl(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")) {
    return value;
  }
  if (value.startsWith("/")) {
    return `${getBasePath()}${value}`;
  }
  return `${getBasePath()}/${value}`;
}

export function slugifyVendorName(name: string | undefined): string {
  if (!name) {
    return "";
  }
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeForMatch(value: string): string {
  return value.replace(/[^a-z0-9]/g, "");
}

function slugFromManifestPath(path: string, type: "web" | "print"): string {
  const filename = path.split("/").pop() ?? "";
  const base = filename.replace(/\.[^.]+$/, "");
  if (type === "web") {
    return base.replace(/-web$/i, "");
  }
  return base;
}

function findBestPath(name: string, paths: string[], type: "web" | "print"): string | undefined {
  if (paths.length === 0) {
    return undefined;
  }

  const targetSlug = slugifyVendorName(name);
  const targetNorm = normalizeForMatch(targetSlug);
  const targetTokens = new Set(targetSlug.split("-").filter(Boolean));

  let bestPath: string | undefined;
  let bestScore = -1;

  for (const path of paths) {
    const candidateSlug = slugifyVendorName(slugFromManifestPath(path, type));
    const candidateNorm = normalizeForMatch(candidateSlug);
    const candidateTokens = new Set(candidateSlug.split("-").filter(Boolean));
    let score = 0;

    if (candidateSlug === targetSlug) {
      score = 100;
    } else if (candidateNorm === targetNorm) {
      score = 95;
    } else if (candidateSlug.includes(targetSlug) || targetSlug.includes(candidateSlug)) {
      score = 80 - Math.abs(candidateSlug.length - targetSlug.length);
    } else if (candidateNorm.includes(targetNorm) || targetNorm.includes(candidateNorm)) {
      score = 70 - Math.abs(candidateNorm.length - targetNorm.length);
    } else {
      let overlap = 0;
      for (const token of targetTokens) {
        if (candidateTokens.has(token)) overlap += 1;
      }
      if (overlap > 0) {
        score = 40 + overlap;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestPath = path;
    }
  }

  return bestScore >= 40 ? bestPath : undefined;
}

export function suggestVendorLogoPaths(name: string, manifest: VendorLogoManifestPaths) {
  const webPath = findBestPath(name, manifest.web_files ?? [], "web");
  const printPath = findBestPath(name, manifest.print_files ?? [], "print");
  return { webPath, printPath };
}

export function getVendorLogoCandidates(vendor: IVendor | undefined, usePrintLogo: boolean): string[] {
  if (!vendor) {
    return [];
  }

  const extraLogo = parseExtraString(vendor.extra?.logo_url);
  const extraPrintLogo = parseExtraString(vendor.extra?.print_logo_url);
  const customLogo = usePrintLogo ? extraPrintLogo ?? extraLogo : extraLogo;

  const candidates: string[] = [];
  const customUrl = normalizeUrl(customLogo);
  if (customUrl) {
    candidates.push(customUrl);
  }

  const slug = slugifyVendorName(vendor.name);
  if (slug) {
    const basePath = getBasePath();
    const printCandidates = [
      `${basePath}/vendor-logos/print/${slug}.png`,
      `${basePath}/vendor-logos/${slug}.png`,
    ];
    const webCandidates = [
      `${basePath}/vendor-logos/web/${slug}.png`,
      `${basePath}/vendor-logos/web/${slug}-web.png`,
      `${basePath}/vendor-logos/${slug}.png`,
      `${basePath}/vendor-logos/${slug}-web.png`,
    ];
    candidates.push(...(usePrintLogo ? [...printCandidates, ...webCandidates] : [...webCandidates, ...printCandidates]));
  }

  return [...new Set(candidates)];
}
