# Greyhound Games — Ship Map

A small static web app that maps every ZIP code you've shipped to from eBay, with a pin per ZIP scaled by order count.

## Files

- `index.html` — the page
- `styles.css` — styling (dark theme, GG burnt orange accent)
- `app.js` — map + sidebar logic (Leaflet + CARTO dark basemap)
- `shipments.json` — the data the page reads
- `build_data.py` — regenerates `shipments.json` from an eBay CSV export

No build step. No bundler. Plain HTML/CSS/JS.

## Updating data

When you have a fresh eBay export:

```bash
pip install zipcodes
python3 build_data.py path/to/eBay-OrdersReport.csv
```

That overwrites `shipments.json` in place.

## Running locally

You can't open `index.html` directly with a `file://` URL because `fetch('shipments.json')` won't work. Run a tiny local server:

```bash
cd shipmap
python3 -m http.server 8000
# then open http://localhost:8000
```

## Hosting on Vercel (recommended)

1. Put the `shipmap/` folder in its own git repo (GitHub, GitLab, whatever) — or use the Vercel CLI to deploy without git.
2. Sign in at https://vercel.com.
3. Click **Add New → Project**, import the repo.
4. Framework preset: **Other** (it's plain static). Build command: leave blank. Output directory: leave blank or `.`.
5. Click **Deploy**. Done. You get a URL like `https://greyhound-shipmap.vercel.app`.

To update later: re-run `build_data.py`, commit the new `shipments.json`, push. Vercel auto-redeploys.

### Vercel CLI alternative (no git needed)

```bash
npm i -g vercel
cd shipmap
vercel
# follow prompts; pick "no" on linking to existing project, accept defaults
```

## Notes / known limits

- US ZIPs only. Non-US shipments would need a different geocoding source — none in the export so far besides one Puerto Rico order, which `zipcodes` handles since PR uses US ZIPs.
- ZIP centroid coordinates, not exact addresses. A pin shows the rough center of the ZIP area, which is what you wanted.
- TCGplayer's standard order list export doesn't include addresses, so this is eBay-only for now. If you find a TCGplayer export with shipping data, the build script can be extended to merge both and color pins by platform.
