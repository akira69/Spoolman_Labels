This directory stores bundled manufacturer logos for Spoolman.

Layout:
- `web/*-web.png`: logos used in the regular UI (manufacturer pages and list)
- `print/*.png`: logos used in label print/export rendering

The app resolves logos by slugified manufacturer name.  
Example:
- Manufacturer `Bambu Lab` -> slug `bambu-lab`
- UI logo path: `/vendor-logos/web/bambu-lab-web.png`
- Print logo path: `/vendor-logos/print/bambu-lab.png`

To sync the logo set from `MarksMakerSpace/filament-profiles`, run:

```bash
./scripts/sync_vendor_logos.sh
```

You can override logos per manufacturer in the UI by filling:
- `Logo URL` (UI logo)
- `Print Logo URL` (label logo)
