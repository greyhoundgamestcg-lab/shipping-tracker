# Greyhound Games — Ship Map

A static web app that visualizes every US ZIP code shipped to from eBay as pins on a dark-themed map. Built for Greyhound Games, a TCG resale business (Pokémon, One Piece, Japanese cards, etc.).

## Stack

- Plain HTML/CSS/JS. No framework, no bundler, no build step for the frontend.
- [Leaflet 1.9.4](https://leafletjs.com/) for the map (loaded from unpkg CDN).
- [CARTO dark basemap](https://carto.com/basemaps/) — free, no API key.
- Fonts: Fraunces (display) + JetBrains Mono (UI/data) via Google Fonts.
- Python 3 + the [`zipcodes`](https://pypi.org/project/zipcodes/) package for the offline geocoding step.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Page structure: header, sidebar (stats + top list + state bars + legend), map, footer |
| `styles.css` | Dark theme. Burnt orange (`#c2410c`) accent matches Greyhound Games branding |
| `app.js` | Loads `shipments.json`, renders pins/popups, builds sidebar, wires click-to-fly |
| `shipments.json` | The data the page reads. One entry per ZIP+country: `{zip, city, state, country, count, revenue, lat, lng, platform}` |
| `build_data.py` | Regenerates `shipments.json` from an eBay Orders CSV export |
| `README.md` | User-facing setup + hosting notes |

## Data pipeline

1. Export an Orders Report from eBay's Seller Hub (CSV).
2. Run `python3 build_data.py path/to/eBay-OrdersReport.csv`.
3. The script parses eBay's slightly weird CSV (blank first row, header on row 2), aggregates orders by normalized 5-digit ZIP + country, then geocodes each ZIP using the bundled `zipcodes` package data.
4. Output: `shipments.json` next to `index.html`, sorted by order count descending.

The eBay CSV column indices we use are pinned in `COL` at the top of `build_data.py`. If eBay changes their export format, that's the place to adjust.

## Design choices worth knowing

- **One pin per unique ZIP, not per order.** Pin radius scales in 4 tiers based on `count` (1, 2-3, 4-6, 7+). Pins with 2+ orders display the count number.
- **ZIP centroid coordinates**, not exact addresses. This is intentional for both privacy and clarity — clusters of nearby shipments get visually merged into the ZIP's representative pin.
- **eBay only for now.** TCGplayer's standard order list export does not include shipping addresses, so it can't be mapped. If a TCGplayer export with addresses becomes available, extend `build_data.py` to merge both sources and add a `platform` filter to the UI (color-coded pins per platform was the original spec).
- **Public-safe data.** `shipments.json` contains city, state, ZIP, count, and revenue only — no buyer names, no addresses, no emails, no order IDs. It is safe to commit and deploy publicly. **However, revenue per ZIP is in there** — if hosting publicly, consider stripping the `revenue` field in `build_data.py` and removing the corresponding rows in `app.js` (`popupHTML`) and `index.html` (the revenue stat card).

## Local development

```bash
# preview (fetch() needs http://, not file://)
python3 -m http.server 8000
# open http://localhost:8000

# regenerate data after a new eBay export
pip install zipcodes  # one-time
python3 build_data.py ~/Downloads/eBay-OrdersReport-XXXX.csv
```

## Deployment

Target is Vercel as a static site. No build command, no output directory override. Either connect a git repo and let auto-deploys handle it, or use `vercel` CLI from this folder.

## Owner conventions

- Output style: clean, neutral, technical. No salesy language.
- **Never use em dashes** in any user-facing copy or messages drafted for the owner. Use commas, periods, parens, or "—" written as a regular hyphen pair if absolutely needed.
- Brand slogan (already in footer): "Good cards. Great service. GG."
- Brand colors: burnt orange (`#c2410c` / `#ea580c`) as the dominant accent, near-black backgrounds.

## Likely next changes

Things that may come up and where to make them:

- **More platforms** → extend `build_data.py` aggregation, add `platform` to per-entry data, color pins by platform in `app.js`'s pin-building loop.
- **Time filters** (last 30/90/365 days) → preserve `sale_date` in `shipments.json`, add a UI control, filter the dataset before render.
- **Heatmap view** → add Leaflet.heat plugin, toggle between markers and heat layer.
- **Repeat customer detection** → currently only ZIPs are aggregated; if you want per-buyer repeat counts you'd need to keep `buyer_username` (or an anonymized hash of it) and aggregate separately. Be careful about putting buyer identifiers in a public JSON file.
- **International** → would need a different geocoding source. The current `zipcodes` package is US-only (Puerto Rico happens to work because PR uses US ZIPs).
