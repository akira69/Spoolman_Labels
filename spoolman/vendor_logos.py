"""Helpers for vendor logo pack lookup and GitHub syncing."""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import tarfile
import tempfile
from dataclasses import dataclass
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from uuid import uuid4
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen

from PIL import Image, ImageOps, UnidentifiedImageError

from spoolman import env

DEFAULT_SOURCE_REPO = "MarksMakerSpace/filament-profiles"
DEFAULT_SOURCE_REF = "main"


@dataclass
class VendorLogoRemoteState:
    source_repo: str
    source_ref: str
    source_url: str
    signature: str
    web_logo_count: int
    print_logo_count: int


@dataclass
class VendorLogoSyncResult:
    source_repo: str
    source_ref: str
    source_url: str
    updated: bool
    message: str
    web_logo_count: int
    print_logo_count: int
    local_signature: str | None
    remote_signature: str
    synced_at_utc: str | None


def get_logo_source_repo() -> str:
    return os.getenv("SPOOLMAN_VENDOR_LOGO_SOURCE_REPO", DEFAULT_SOURCE_REPO)


def get_logo_source_ref() -> str:
    return os.getenv("SPOOLMAN_VENDOR_LOGO_SOURCE_REF", DEFAULT_SOURCE_REF)


def get_logo_source_url(source_repo: str, source_ref: str) -> str:
    return f"https://github.com/{source_repo}/tree/{source_ref}"


def get_runtime_vendor_logo_dir() -> Path:
    target_dir = env.get_data_dir() / "vendor-logos"
    target_dir.mkdir(parents=True, exist_ok=True)
    return target_dir


def get_bundled_vendor_logo_dir() -> Path:
    project_root = Path(__file__).resolve().parent.parent
    return project_root / "client" / "dist" / "vendor-logos"


def resolve_vendor_logo_asset(path: str) -> Path | None:
    """Resolve logo asset path from runtime pack first, then bundled pack."""
    safe_path = path.lstrip("/")
    if not safe_path or ".." in Path(safe_path).parts:
        return None

    for base_dir in (get_runtime_vendor_logo_dir(), get_bundled_vendor_logo_dir()):
        candidate = (base_dir / safe_path).resolve()
        try:
            candidate.relative_to(base_dir.resolve())
        except ValueError:
            continue
        if candidate.is_file():
            return candidate
    return None


def slugify_vendor_name(name: str | None) -> str:
    """Create a filesystem-safe slug from vendor name."""
    if not name:
        return ""
    normalized = name.strip().lower()
    normalized = re.sub(r"[^a-z0-9]+", "-", normalized)
    return normalized.strip("-")


def _read_manifest(path: Path) -> dict[str, object] | None:
    if not path.is_file():
        return None
    try:
        with path.open(encoding="utf-8") as file:
            data = json.load(file)
    except (OSError, json.JSONDecodeError):
        return None
    return data if isinstance(data, dict) else None


def _read_bundled_manifest() -> dict[str, object] | None:
    return _read_manifest(get_bundled_vendor_logo_dir() / "manifest.json")


def _normalize_logo_asset_path(logo_url: str) -> str:
    value = logo_url.strip()
    if value == "":
        return ""

    parsed = urlparse(value)
    path = parsed.path if parsed.scheme in {"http", "https"} else value
    base_path = env.get_base_path().rstrip("/")
    if base_path and path.startswith(base_path + "/"):
        path = path[len(base_path) + 1 :]

    normalized = path.lstrip("/")
    if normalized.startswith("vendor-logos/"):
        normalized = normalized[len("vendor-logos/") :]
    return normalized


def _load_logo_source_bytes(logo_url: str) -> bytes:
    value = logo_url.strip()
    if value == "":
        raise ValueError("Logo URL is required.")

    if value.startswith(("http://", "https://")):
        request = Request(value, headers={"User-Agent": "spoolman-vendor-logo-convert"})
        with urlopen(request, timeout=60) as response:  # noqa: S310
            return response.read()

    local_asset = _normalize_logo_asset_path(value)
    if local_asset == "":
        raise ValueError("Logo URL is required.")

    resolved = resolve_vendor_logo_asset(local_asset)
    if resolved is None:
        raise RuntimeError("Logo asset could not be resolved from local vendor logo paths.")
    return resolved.read_bytes()


def _update_runtime_manifest_with_generated_print_logo(print_logo_url: str) -> None:
    runtime_dir = get_runtime_vendor_logo_dir()
    runtime_manifest_path = runtime_dir / "manifest.json"

    manifest = _read_local_manifest() or _read_bundled_manifest() or {}

    web_files = [value for value in manifest.get("web_files", []) if isinstance(value, str)]
    print_files = [value for value in manifest.get("print_files", []) if isinstance(value, str)]

    if print_logo_url not in print_files:
        print_files.append(print_logo_url)

    now_utc = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    runtime_manifest: dict[str, object] = {
        "source_repo": manifest.get("source_repo") if isinstance(manifest.get("source_repo"), str) else "local",
        "source_ref": manifest.get("source_ref") if isinstance(manifest.get("source_ref"), str) else "local",
        "source_url": manifest.get("source_url") if isinstance(manifest.get("source_url"), str) else "local",
        "source_tree_signature": (
            manifest.get("source_tree_signature")
            if isinstance(manifest.get("source_tree_signature"), str)
            else hashlib.sha256("\n".join(sorted(web_files + print_files)).encode("utf-8")).hexdigest()
        ),
        "synced_at_utc": now_utc,
        "web_logo_count": len(web_files),
        "print_logo_count": len(print_files),
        "web_files": sorted(set(web_files)),
        "print_files": sorted(set(print_files)),
    }

    with runtime_manifest_path.open("w", encoding="utf-8") as file:
        json.dump(runtime_manifest, file, indent=2)


def convert_web_logo_to_print_logo(logo_url: str, vendor_name: str | None = None) -> str:
    """Convert a web logo to grayscale PNG and store it in runtime print logo directory."""
    source_bytes = _load_logo_source_bytes(logo_url)

    try:
        with Image.open(BytesIO(source_bytes)) as source_image:
            rgba = source_image.convert("RGBA")
    except UnidentifiedImageError as exc:
        raise RuntimeError("Logo image format is not supported.") from exc

    alpha = rgba.getchannel("A")
    grayscale = ImageOps.grayscale(rgba.convert("RGB"))
    monochrome = grayscale.point(lambda value: 0 if value < 180 else 255, mode="L")
    converted = Image.merge("RGBA", (monochrome, monochrome, monochrome, alpha))

    parsed_logo_path = urlparse(logo_url).path if logo_url.startswith(("http://", "https://")) else logo_url
    source_stem = Path(parsed_logo_path).stem.replace("-web", "")
    slug = slugify_vendor_name(vendor_name) or slugify_vendor_name(source_stem) or f"vendor-{uuid4().hex[:8]}"
    source_hash = hashlib.sha1(source_bytes).hexdigest()[:10]

    runtime_dir = get_runtime_vendor_logo_dir()
    print_dir = runtime_dir / "print"
    print_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{slug}-{source_hash}-print-auto.png"
    output_path = print_dir / filename
    converted.save(output_path, format="PNG", optimize=True)

    print_logo_url = f"/vendor-logos/print/{filename}"
    _update_runtime_manifest_with_generated_print_logo(print_logo_url)
    return print_logo_url


def _read_local_manifest() -> dict[str, object] | None:
    manifest_path = get_runtime_vendor_logo_dir() / "manifest.json"
    if not manifest_path.is_file():
        return None
    try:
        with manifest_path.open(encoding="utf-8") as file:
            data = json.load(file)
        if isinstance(data, dict):
            return data
    except (OSError, json.JSONDecodeError):
        return None
    return None


def _download_json(url: str) -> dict[str, object]:
    request = Request(url, headers={"User-Agent": "spoolman-vendor-logo-sync"})
    with urlopen(request, timeout=30) as response:  # noqa: S310
        return json.loads(response.read().decode("utf-8"))


def _get_remote_logo_state(source_repo: str, source_ref: str) -> VendorLogoRemoteState:
    encoded_ref = quote(source_ref, safe="")
    url = f"https://api.github.com/repos/{source_repo}/git/trees/{encoded_ref}?recursive=1"
    payload = _download_json(url)

    tree = payload.get("tree")
    if not isinstance(tree, list):
        raise RuntimeError("GitHub tree response is missing file list.")

    web_entries: list[tuple[str, str]] = []
    print_entries: list[tuple[str, str]] = []

    for item in tree:
        if not isinstance(item, dict):
            continue
        path = item.get("path")
        sha = item.get("sha")
        item_type = item.get("type")
        if not isinstance(path, str) or not isinstance(sha, str) or item_type != "blob":
            continue
        if not path.lower().endswith(".png"):
            continue
        if path.startswith("web/"):
            web_entries.append((path, sha))
        elif path.startswith("logos/"):
            print_entries.append((path, sha))

    if len(web_entries) == 0 and len(print_entries) == 0:
        raise RuntimeError("No logo PNG files found in GitHub repository tree.")

    signature_source = "\n".join(
        sorted([f"web:{path}:{sha}" for path, sha in web_entries] + [f"print:{path}:{sha}" for path, sha in print_entries])
    )
    signature = hashlib.sha256(signature_source.encode("utf-8")).hexdigest()

    return VendorLogoRemoteState(
        source_repo=source_repo,
        source_ref=source_ref,
        source_url=get_logo_source_url(source_repo, source_ref),
        signature=signature,
        web_logo_count=len(web_entries),
        print_logo_count=len(print_entries),
    )


def _find_first_subdir(parent: Path, directory_name: str, max_depth: int = 4) -> Path | None:
    for path in parent.rglob(directory_name):
        if not path.is_dir():
            continue
        depth = len(path.relative_to(parent).parts)
        if depth <= max_depth:
            return path
    return None


def _write_manifest(
    target_dir: Path,
    source_repo: str,
    source_ref: str,
    source_url: str,
    signature: str,
    web_files: list[str],
    print_files: list[str],
) -> dict[str, object]:
    now_utc = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    manifest = {
        "source_repo": source_repo,
        "source_ref": source_ref,
        "source_url": source_url,
        "source_tree_signature": signature,
        "synced_at_utc": now_utc,
        "web_logo_count": len(web_files),
        "print_logo_count": len(print_files),
        "web_files": sorted(web_files),
        "print_files": sorted(print_files),
    }
    with (target_dir / "manifest.json").open("w", encoding="utf-8") as file:
        json.dump(manifest, file, indent=2)
    return manifest


def _get_archive_url(source_repo: str, source_ref: str) -> str:
    encoded_ref = quote(source_ref, safe="")
    return f"https://codeload.github.com/{source_repo}/tar.gz/{encoded_ref}"


def _download_and_write_logo_pack(remote_state: VendorLogoRemoteState) -> dict[str, object]:
    target_dir = get_runtime_vendor_logo_dir()
    staged_target_dir = Path(tempfile.mkdtemp(prefix=".vendor-logos-stage-", dir=target_dir.parent))

    try:
        web_dir = staged_target_dir / "web"
        print_dir = staged_target_dir / "print"
        web_dir.mkdir(parents=True, exist_ok=True)
        print_dir.mkdir(parents=True, exist_ok=True)

        with tempfile.TemporaryDirectory() as temp_dir_str:
            temp_dir = Path(temp_dir_str)
            archive_path = temp_dir / "logos.tar.gz"
            archive_url = _get_archive_url(remote_state.source_repo, remote_state.source_ref)
            request = Request(archive_url, headers={"User-Agent": "spoolman-vendor-logo-sync"})
            with urlopen(request, timeout=60) as response:  # noqa: S310
                archive_path.write_bytes(response.read())

            with tarfile.open(archive_path, mode="r:gz") as archive:
                archive.extractall(path=temp_dir)  # noqa: S202

            source_logo_dir = _find_first_subdir(temp_dir, "logos")
            source_web_dir = _find_first_subdir(temp_dir, "web")
            if source_logo_dir is None and source_web_dir is None:
                raise RuntimeError("Downloaded archive did not contain logos/ or web/ directories.")

            web_files: list[str] = []
            print_files: list[str] = []

            if source_web_dir is not None:
                for source_file in sorted(source_web_dir.rglob("*.png")):
                    dest_file = web_dir / source_file.name
                    shutil.copy2(source_file, dest_file)
                    web_files.append(f"/vendor-logos/web/{source_file.name}")

            if source_logo_dir is not None:
                for source_file in sorted(source_logo_dir.rglob("*.png")):
                    filename = source_file.name
                    if filename.lower().endswith("-web.png"):
                        if source_web_dir is None:
                            dest_file = web_dir / filename
                            shutil.copy2(source_file, dest_file)
                            web_files.append(f"/vendor-logos/web/{filename}")
                        continue
                    dest_file = print_dir / filename
                    shutil.copy2(source_file, dest_file)
                    print_files.append(f"/vendor-logos/print/{filename}")

        manifest = _write_manifest(
            target_dir=staged_target_dir,
            source_repo=remote_state.source_repo,
            source_ref=remote_state.source_ref,
            source_url=remote_state.source_url,
            signature=remote_state.signature,
            web_files=web_files,
            print_files=print_files,
        )

        backup_dir = target_dir.parent / f".vendor-logos-backup-{uuid4().hex}"
        had_existing_target = target_dir.exists()
        try:
            if had_existing_target:
                os.replace(target_dir, backup_dir)
            os.replace(staged_target_dir, target_dir)
        except Exception:
            if staged_target_dir.exists():
                shutil.rmtree(staged_target_dir, ignore_errors=True)
            if had_existing_target and backup_dir.exists() and not target_dir.exists():
                os.replace(backup_dir, target_dir)
            raise
        else:
            if backup_dir.exists():
                shutil.rmtree(backup_dir, ignore_errors=True)

        return manifest
    finally:
        if staged_target_dir.exists():
            shutil.rmtree(staged_target_dir, ignore_errors=True)


def sync_logo_pack_from_github_if_needed() -> VendorLogoSyncResult:
    source_repo = get_logo_source_repo()
    source_ref = get_logo_source_ref()
    source_url = get_logo_source_url(source_repo, source_ref)

    local_manifest = _read_local_manifest()
    local_signature = None
    if local_manifest is not None:
        signature_value = local_manifest.get("source_tree_signature")
        if isinstance(signature_value, str) and signature_value != "":
            local_signature = signature_value

    remote_state = _get_remote_logo_state(source_repo, source_ref)

    if local_signature == remote_state.signature:
        synced_at = local_manifest.get("synced_at_utc") if isinstance(local_manifest, dict) else None
        return VendorLogoSyncResult(
            source_repo=source_repo,
            source_ref=source_ref,
            source_url=source_url,
            updated=False,
            message="Logo pack is already up to date.",
            web_logo_count=int(local_manifest.get("web_logo_count", 0)) if isinstance(local_manifest, dict) else 0,
            print_logo_count=int(local_manifest.get("print_logo_count", 0)) if isinstance(local_manifest, dict) else 0,
            local_signature=local_signature,
            remote_signature=remote_state.signature,
            synced_at_utc=synced_at if isinstance(synced_at, str) else None,
        )

    new_manifest = _download_and_write_logo_pack(remote_state)
    synced_at = new_manifest.get("synced_at_utc")

    return VendorLogoSyncResult(
        source_repo=source_repo,
        source_ref=source_ref,
        source_url=source_url,
        updated=True,
        message="Downloaded newer vendor logo pack from GitHub.",
        web_logo_count=int(new_manifest.get("web_logo_count", 0)),
        print_logo_count=int(new_manifest.get("print_logo_count", 0)),
        local_signature=local_signature,
        remote_signature=remote_state.signature,
        synced_at_utc=synced_at if isinstance(synced_at, str) else None,
    )
