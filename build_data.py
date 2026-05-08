#!/usr/bin/env python3
"""
Greyhound Games Ship Map - data builder

Regenerates shipments.json from an eBay Orders CSV export.

Usage:
    pip install zipcodes
    python3 build_data.py path/to/eBay-OrdersReport.csv

Output:
    shipments.json (next to index.html)
"""

import csv
import json
import sys
from pathlib import Path

try:
    import zipcodes
except ImportError:
    print("ERROR: missing dependency. Run: pip install zipcodes", file=sys.stderr)
    sys.exit(1)


# eBay column indices (1-based row 2 is the header in their export, row 1 is blank)
COL = {
    'ship_city': 18,
    'ship_state': 19,
    'ship_zip': 20,
    'ship_country': 21,
    'sale_date': 52,
}

# ZIPs that are international forwarding hubs -- orders here count as international,
# not toward the destination state's totals.
FORWARDING_HUBS = {'60139'}  # Glendale Heights, IL


def main(csv_path, out_path):
    with open(csv_path, 'r', encoding='utf-8-sig', newline='') as f:
        rows = list(csv.reader(f))

    # eBay exports start with a blank row, then header, then data
    data_rows = [r for r in rows[2:] if len(r) > COL['ship_country'] and r[COL['ship_zip']].strip()]
    print(f"Read {len(data_rows)} rows with shipping ZIPs.")

    agg = {}
    for r in data_rows:
        ship_city = r[COL['ship_city']].strip()
        ship_state = r[COL['ship_state']].strip()
        ship_zip = r[COL['ship_zip']].strip()
        ship_country = r[COL['ship_country']].strip()

        zip_norm = ship_zip.split('-')[0] if ship_country == 'United States' else ship_zip
        key = (zip_norm, ship_country)

        if key not in agg:
            agg[key] = {
                'zip': zip_norm,
                'city': ship_city.title() if ship_city else '',
                'state': ship_state,
                'country': ship_country,
                'count': 0,
                'platform': 'ebay',
                'forwarding_hub': zip_norm in FORWARDING_HUBS,
            }
        agg[key]['count'] += 1

    # Geocode
    geocoded = []
    missed = []
    for (z, country), v in agg.items():
        try:
            results = zipcodes.matching(z)
        except (TypeError, ValueError):
            results = []
        if results:
            r0 = results[0]
            v['lat'] = float(r0['lat'])
            v['lng'] = float(r0['long'])
            if not v['city']:
                v['city'] = r0['city']
            geocoded.append(v)
        else:
            missed.append(v)

    print(f"Geocoded: {len(geocoded)}")
    if missed:
        print(f"Missed:   {len(missed)}")
        for m in missed[:20]:
            print(f"  ! {m['zip']} ({m['country']}) - {m['city']}, {m['state']}")

    # Sort largest first so the JSON is easier to skim
    geocoded.sort(key=lambda x: -x['count'])

    with open(out_path, 'w') as f:
        json.dump(geocoded, f, separators=(',', ':'))

    total_orders = sum(d['count'] for d in geocoded)
    print(f"\nWrote {out_path}")
    print(f"  {len(geocoded)} unique ZIPs")
    print(f"  {total_orders} total orders")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 build_data.py <ebay_orders.csv> [output.json]", file=sys.stderr)
        sys.exit(1)
    csv_arg = sys.argv[1]
    out_arg = sys.argv[2] if len(sys.argv) > 2 else str(Path(__file__).parent / 'shipments.json')
    main(csv_arg, out_arg)
