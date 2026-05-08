// ----- Greyhound Games Ship Map -----

const fmtNum = (n) => n.toLocaleString('en-US');

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

const STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon',
  PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
  WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  AE: 'Military (Europe)', AP: 'Military (Pacific)',
};

const TIERS = {
  zip:   [{ size: 14, label: '1 order' }, { size: 19, min: 2, label: '2–3 orders' }, { size: 24, min: 4, label: '4–6 orders' }, { size: 30, min: 7, label: '7+ orders' }],
  city:  [{ size: 14, label: '1–2 orders' }, { size: 19, min: 3, label: '3–5 orders' }, { size: 24, min: 6, label: '6–10 orders' }, { size: 30, min: 11, label: '11+ orders' }],
  state: [{ size: 14, label: '1–10 orders' }, { size: 19, min: 11, label: '11–25 orders' }, { size: 24, min: 26, label: '26–50 orders' }, { size: 30, min: 51, label: '51+ orders' }],
};

const TOP_COUNT = 5;
const STATE_ROWS_DEFAULT = 6;
const TOP_TITLES = { zip: 'Top destinations', city: 'Top cities', state: 'Top states' };

function pinSize(count, view) {
  const tiers = TIERS[view];
  let size = tiers[0].size;
  for (const t of tiers) {
    if (t.min !== undefined && count >= t.min) size = t.size;
  }
  return size;
}

function updateLegend(view) {
  TIERS[view].forEach((t, i) => {
    document.getElementById(`leg-${i + 1}`).textContent = t.label;
  });
}

async function load() {
  const res = await fetch('shipments.json', { cache: 'no-store' });
  return res.json();
}

function aggregateCity(data) {
  const map = {};
  for (const d of data) {
    if (!d.city || !d.state || d.forwarding_hub) continue;
    const key = `${d.city}||${d.state}`;
    if (!map[key]) map[key] = { city: d.city, state: d.state, count: 0, latSum: 0, lngSum: 0, n: 0 };
    map[key].count += d.count;
    if (d.lat !== 0 && d.lng !== 0) { map[key].latSum += d.lat; map[key].lngSum += d.lng; map[key].n++; }
  }
  return Object.values(map)
    .filter(v => v.n > 0)
    .map(v => ({ city: v.city, state: v.state, count: v.count, lat: v.latSum / v.n, lng: v.lngSum / v.n, _key: `${v.city}||${v.state}` }));
}

function aggregateState(data) {
  const map = {};
  for (const d of data) {
    if (!d.state || d.forwarding_hub) continue;
    if (!map[d.state]) map[d.state] = { state: d.state, count: 0, latSum: 0, lngSum: 0, n: 0 };
    map[d.state].count += d.count;
    if (d.lat !== 0 && d.lng !== 0) { map[d.state].latSum += d.lat; map[d.state].lngSum += d.lng; map[d.state].n++; }
  }
  return Object.values(map)
    .filter(v => v.n > 0)
    .map(v => ({ state: v.state, count: v.count, lat: v.latSum / v.n, lng: v.lngSum / v.n, _key: v.state }));
}

function getViewData(raw, view) {
  if (view === 'city') return aggregateCity(raw);
  if (view === 'state') return aggregateState(raw);
  return raw
    .filter(d => !(d.lat === 0 && d.lng === 0))
    .map(d => ({ ...d, _key: `${d.zip}_${d.country}` }));
}

function buildStats(raw) {
  const totalOrders = raw.reduce((s, d) => s + d.count, 0);
  const intlOrders = raw.filter(d => d.forwarding_hub).reduce((s, d) => s + d.count, 0);
  const stateSet = new Set(raw.filter(d => !d.forwarding_hub).map(d => d.state).filter(Boolean));
  document.getElementById('stat-orders').textContent = fmtNum(totalOrders);
  document.getElementById('stat-zips').textContent = fmtNum(raw.length);
  document.getElementById('stat-states').textContent = fmtNum(stateSet.size);
  document.getElementById('stat-intl').textContent = fmtNum(intlOrders);
}

function popupHTML(d, view) {
  if (view === 'state') {
    return `
      <div class="popup-place">${STATE_NAMES[d.state] || d.state}</div>
      <div class="popup-row"><span class="k">Orders</span><span class="v accent">${fmtNum(d.count)}</span></div>
    `;
  }
  if (view === 'city') {
    return `
      <div class="popup-place">${d.city}, ${d.state}</div>
      <div class="popup-row"><span class="k">Orders</span><span class="v accent">${fmtNum(d.count)}</span></div>
    `;
  }
  const hubBadge = d.forwarding_hub
    ? '<div class="popup-hub">International forwarding hub</div>'
    : '';
  return `
    <div class="popup-place">${d.city}, ${d.state}</div>
    <div class="popup-zip">${d.country === 'United States' ? 'ZIP' : 'Postal'} ${d.zip}</div>
    ${hubBadge}
    <div class="popup-row"><span class="k">Orders</span><span class="v accent">${d.count}</span></div>
  `;
}

function buildTopList(viewData, view, focusFn) {
  document.getElementById('top-title').textContent = TOP_TITLES[view];
  const top = [...viewData].sort((a, b) => b.count - a.count).slice(0, TOP_COUNT);
  const ol = document.getElementById('top-list');
  ol.innerHTML = '';
  top.forEach((d, i) => {
    const li = document.createElement('li');
    const label = view === 'state'
      ? (STATE_NAMES[d.state] || d.state)
      : `${d.city}, ${d.state}`;
    const sub = view === 'zip' ? `<span class="zip">${d.zip}</span>` : '';
    const countLabel = `${fmtNum(d.count)} ${d.count === 1 ? 'order' : 'orders'}`;
    li.innerHTML = `
      <span class="rank">${ordinal(i + 1)}</span>
      <span class="place">${label}${sub}</span>
      <span class="count">${countLabel}</span>
    `;
    li.addEventListener('click', () => focusFn(d));
    ol.appendChild(li);
  });
}

function buildStateList(raw) {
  const byState = {};
  for (const d of raw) {
    if (!d.state || d.forwarding_hub) continue;
    byState[d.state] = (byState[d.state] || 0) + d.count;
  }
  const arr = Object.entries(byState).sort((a, b) => b[1] - a[1]);
  const max = arr.length ? arr[0][1] : 1;
  const ul = document.getElementById('state-list');
  ul.innerHTML = '';

  arr.forEach(([st, n], i) => {
    const li = document.createElement('li');
    li.className = 'state-row';
    if (i >= STATE_ROWS_DEFAULT) li.style.display = 'none';
    const pct = Math.max(2, (n / max) * 100);
    li.innerHTML = `
      <span class="st">${st}</span>
      <span class="bar-wrap"><span class="bar" data-pct="${pct}"></span></span>
      <span class="num">${n}</span>
    `;
    ul.appendChild(li);
  });

  requestAnimationFrame(() => requestAnimationFrame(() => {
    ul.querySelectorAll('.bar[data-pct]').forEach(bar => {
      bar.style.width = bar.dataset.pct + '%';
    });
  }));

  const btn = document.getElementById('state-expand-btn');
  if (arr.length > STATE_ROWS_DEFAULT) {
    btn.style.display = '';
    btn.textContent = `Show all ${arr.length} states`;
    btn.dataset.expanded = '0';
    btn.onclick = () => {
      const expanded = btn.dataset.expanded === '1';
      ul.querySelectorAll('.state-row').forEach((el, i) => {
        if (i >= STATE_ROWS_DEFAULT) el.style.display = expanded ? 'none' : '';
      });
      btn.dataset.expanded = expanded ? '0' : '1';
      btn.textContent = expanded ? `Show all ${arr.length} states` : 'Show less';
    };
  } else {
    btn.style.display = 'none';
  }
}

function buildMarkers(viewData, view, markerLayer) {
  markerLayer.clearLayers();
  const index = {};
  for (const d of viewData) {
    if (typeof d.lat !== 'number' || typeof d.lng !== 'number') continue;
    const size = pinSize(d.count, view);
    const showNum = d.count >= 2;
    const hubClass = d.forwarding_hub ? ' hub' : '';
    const html = `<div class="pin${showNum ? ' with-num' : ''}${hubClass}" style="width:${size}px;height:${size}px;">${showNum ? fmtNum(d.count) : ''}</div>`;
    const icon = L.divIcon({ className: 'pin-wrap', html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
    const m = L.marker([d.lat, d.lng], { icon, riseOnHover: true });
    const tipLabel = view === 'state' ? (STATE_NAMES[d.state] || d.state) : `${d.city}, ${d.state}`;
    const tipSuffix = d.forwarding_hub ? ' (intl hub)' : '';
    m.bindPopup(popupHTML(d, view), { closeButton: true, autoPan: true });
    m.bindTooltip(`${tipLabel}${tipSuffix} — ${fmtNum(d.count)}`, { direction: 'top', offset: [0, -size / 2 - 4] });
    m.addTo(markerLayer);
    index[d._key] = m;
  }
  return index;
}

(async function main() {
  const raw = await load();
  let view = 'state';

  buildStats(raw);
  buildStateList(raw);

  const map = L.map('map', { zoomControl: true, worldCopyJump: true, minZoom: 3, maxZoom: 12 });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(map);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    maxZoom: 19,
    pane: 'shadowPane',
  }).addTo(map);

  const markerLayer = L.layerGroup().addTo(map);

  let viewData = getViewData(raw, view);
  const bounds = viewData.filter(d => d.lat && d.lng).map(d => [d.lat, d.lng]);
  if (bounds.length) map.fitBounds(bounds, { padding: [40, 40] });
  else map.setView([39.5, -98.35], 4);

  let index = buildMarkers(viewData, view, markerLayer);
  updateLegend(view);

  function focusFn(d) {
    const m = index[d._key];
    if (!m) return;
    const zoom = view === 'state' ? 6 : 9;
    map.flyTo(m.getLatLng(), Math.max(map.getZoom(), zoom), { duration: 0.6 });
    m.openPopup();
  }

  buildTopList(viewData, view, focusFn);

  document.getElementById('foot-meta').textContent =
    `${fmtNum(raw.length)} ZIPs · ${fmtNum(raw.reduce((s, d) => s + d.count, 0))} orders · eBay`;

  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.view === view) return;
      view = btn.dataset.view;
      document.querySelectorAll('.view-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
      viewData = getViewData(raw, view);
      index = buildMarkers(viewData, view, markerLayer);
      const ol = document.getElementById('top-list');
      ol.style.transition = 'opacity 0.15s ease';
      ol.style.opacity = '0';
      setTimeout(() => {
        buildTopList(viewData, view, focusFn);
        ol.style.opacity = '1';
      }, 150);
      updateLegend(view);
    });
  });
})();
