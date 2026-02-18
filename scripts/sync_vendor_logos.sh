#!/usr/bin/env bash
set -euo pipefail

SOURCE_REPO="${SOURCE_REPO:-MarksMakerSpace/filament-profiles}"
SOURCE_REF="${SOURCE_REF:-main}"
TARGET_DIR="${TARGET_DIR:-client/public/vendor-logos}"

tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

archive_url="https://codeload.github.com/${SOURCE_REPO}/tar.gz/refs/heads/${SOURCE_REF}"
archive_file="${tmp_dir}/logos.tar.gz"

echo "Downloading logos from ${SOURCE_REPO}@${SOURCE_REF}..."
curl -fsSL "$archive_url" -o "$archive_file"

echo "Extracting archive..."
tar -xzf "$archive_file" -C "$tmp_dir"

source_logo_dir="$(find "$tmp_dir" -maxdepth 3 -type d -name logos | head -n 1 || true)"
source_web_dir="$(find "$tmp_dir" -maxdepth 4 -type d -name web | head -n 1 || true)"

if [[ -z "$source_logo_dir" && -z "$source_web_dir" ]]; then
  echo "Could not find a 'logos' or 'web' directory in downloaded archive."
  exit 1
fi

web_dir="${TARGET_DIR}/web"
print_dir="${TARGET_DIR}/print"
mkdir -p "$web_dir" "$print_dir"

find "$web_dir" -type f -name "*.png" -delete
find "$print_dir" -type f -name "*.png" -delete

web_count=0
print_count=0
web_files=()
print_files=()

if [[ -n "$source_web_dir" ]]; then
  while IFS= read -r -d '' web_logo_file; do
    logo_name="$(basename "$web_logo_file")"
    cp "$web_logo_file" "${web_dir}/${logo_name}"
    web_count=$((web_count + 1))
    web_files+=("/vendor-logos/web/${logo_name}")
  done < <(find "$source_web_dir" -type f -name "*.png" -print0)
fi

if [[ -n "$source_logo_dir" ]]; then
  while IFS= read -r -d '' logo_file; do
    logo_name="$(basename "$logo_file")"
    if [[ "$logo_name" == *-web.png ]]; then
      # If dedicated web/ already exists, keep that as source of truth.
      if [[ -z "$source_web_dir" ]]; then
        cp "$logo_file" "${web_dir}/${logo_name}"
        web_count=$((web_count + 1))
        web_files+=("/vendor-logos/web/${logo_name}")
      fi
      continue
    fi

    cp "$logo_file" "${print_dir}/${logo_name}"
    print_count=$((print_count + 1))
    print_files+=("/vendor-logos/print/${logo_name}")
  done < <(find "$source_logo_dir" -type f -name "*.png" -print0)
fi

IFS=$'\n' web_files=($(printf '%s\n' "${web_files[@]}" | sort -u))
IFS=$'\n' print_files=($(printf '%s\n' "${print_files[@]}" | sort -u))

updated_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
{
  echo "{"
  echo "  \"source_repo\": \"${SOURCE_REPO}\","
  echo "  \"source_ref\": \"${SOURCE_REF}\","
  echo "  \"synced_at_utc\": \"${updated_at}\","
  echo "  \"web_logo_count\": ${web_count},"
  echo "  \"print_logo_count\": ${print_count},"
  echo "  \"web_files\": ["
  for i in "${!web_files[@]}"; do
    comma=","
    if [[ "$i" -eq "$(( ${#web_files[@]} - 1 ))" ]]; then
      comma=""
    fi
    echo "    \"${web_files[$i]}\"${comma}"
  done
  echo "  ],"
  echo "  \"print_files\": ["
  for i in "${!print_files[@]}"; do
    comma=","
    if [[ "$i" -eq "$(( ${#print_files[@]} - 1 ))" ]]; then
      comma=""
    fi
    echo "    \"${print_files[$i]}\"${comma}"
  done
  echo "  ]"
  echo "}"
} > "${TARGET_DIR}/manifest.json"

echo "Synced ${web_count} web logo(s) and ${print_count} print logo(s) to ${TARGET_DIR}."
