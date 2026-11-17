// Measure your yard: trace grass on a satellite map, get square feet written inside each area.
// Free imagery (Esri World Imagery) and free address search (Esri geocoder, no key, not stored).
// Shapes are saved on the visitor's phone only (localStorage 'mit-yard').

import { saveProfile } from './profile.js';
import L from './leafletGlobal.js';
import 'leaflet-rotate';
import 'leaflet/dist/leaflet.css';
import polylabel from 'polylabel';
import { getPlace } from './place.js';
import { renderImage } from './measureExport.js';
import { satLayer } from './satTiles.js';

const KEY = 'mit-yard';
export const COLORS = ['#f6c945', '#9fd36a', '#7cc8f2', '#ff9ec0', '#ffad5c', '#c7a8ff', '#5fe0c4', '#ff7a6b'];
export const ATTRIBUTION = 'Imagery © Esri, Maxar, Earthstar Geographics';
const GEO = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer';
const NAMES = ['Front yard', 'Back yard', 'Side yard', 'By the street', 'Other side'];
const Z_REF = 22; // label math happens in pixel space at this zoom
const SNAP_PX = 16; // new corners stick to a neighbor area's corner this close
const PIN = '<svg viewBox="0 0 7 9" width="28" height="36" shape-rendering="crispEdges" aria-hidden="true"><path fill="#0a2414" d="M2 0h3v1h1v1h1v3h-1v1h-1v1h-1v2h-1v-2h-1v-1h-1v-1h-1v-3h1v-1h1z"/><path fill="#c8372d" d="M2 1h3v1h1v3h-1v1h-1v1h-1v-1h-1v-1h-1v-3h1z"/><path fill="#f1f6ec" d="M3 2h1v2h-1z"/></svg>';

// Area on the earth's surface in square meters (spherical, plenty accurate at yard size).
export function areaM2(pts) {
  const n = pts.length;
  if (n < 3) return 0;
  const R = 6378137, d = Math.PI / 180;
  let a = 0;
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    a += (q.lng - p.lng) * d * (2 + Math.sin(p.lat * d) + Math.sin(q.lat * d));
  }
  return Math.abs((a * R * R) / 2);
}
export const toSqft = (m2) => m2 * 10.7639104;
export const fmt = (n) => Math.round(n).toLocaleString('en-US');
export const acresText = (sqft) => {
  const a = sqft / 43560;
  return `${a < 0.1 ? a.toFixed(3) : a.toFixed(2)} acres`;
};

// The roomiest spot inside a shape, so labels land in the grass even on L-shaped areas.
function labelSpot(ring) {
  const r = polylabel([[...ring, ring[0]]], 0.5);
  return { x: r[0], y: r[1], r: r.distance };
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function initMeasure(root) {
  const $ = (s) => root.querySelector(s);
  const stage = $('[data-mz-map]');
  const hintEl = $('[data-mz-hint]');
  const barEl = $('[data-mz-bar]');
  const totalEl = $('[data-mz-total]');
  const searchEl = $('[data-mz-search]');
  const searchForm = $('[data-mz-search-form]');
  const searchInput = searchForm.querySelector('input');
  const suggEl = $('[data-mz-sugg]');
  const searchMsg = $('[data-mz-search-msg]');
  const nameEl = $('[data-mz-name]');
  const nameForm = $('[data-mz-name-form]');
  const nameInput = nameForm.querySelector('input');
  const nameChips = $('[data-mz-chips]');
  const toastEl = $('[data-mz-toast]');
  const summaryEl = $('[data-mz-summary]');

  let areas = [];
  let drawing = null;
  let selected = null;
  let pickedVtx = -1;
  let naming = null;
  let full = false;
  let pin = null;
  let handles = [];
  let uid = 0;
  let toastTimer = 0;
  let lastDeleted = null;

  const place = getPlace();
  const map = L.map(stage, {
    zoomControl: false,
    doubleClickZoom: false,
    boxZoom: false,
    keyboard: false,
    scrollWheelZoom: false,
    dragging: false,
    touchZoom: false,
    zoomSnap: 0.25,
    zoomDelta: 0.5,
    maxZoom: 21.5,
    minZoom: 4,
    rotate: true,
    rotateControl: false,
    touchRotate: false,
    shiftKeyRotate: false,
    pitchDrag: false,
    touchPitch: false,
  }).setView([place.lat, place.lon], 16);
  satLayer(L, { attribution: ATTRIBUTION, maxZoom: 22 }).addTo(map);
  map.attributionControl.setPrefix(false);   // keep the credit short enough to read on a phone; Esri's credit stays

  // Page mode never grabs touches, so the page always scrolls. Full screen does.
  function setInteractive(on) {
    for (const h of [map.dragging, map.touchZoom, map.touchRotate, map.shiftKeyRotate, map.scrollWheelZoom]) {
      if (h) on ? h.enable() : h.disable();
    }
  }

  const project = (p) => map.project(p, Z_REF);
  const nextColor = () => COLORS.find((c) => !areas.some((a) => a.color === c)) || COLORS[areas.length % COLORS.length];
  const total = () => areas.reduce((s, a) => s + a.sqft, 0);

  function makeArea(pts, name, color) {
    const a = { id: ++uid, name, color, pts, sqft: 0, spot: null };
    a.poly = L.polygon(pts, {
      color, weight: 3, fillColor: color, fillOpacity: 0.3, bubblingMouseEvents: false, lineJoin: 'round',
    }).addTo(map);
    a.label = L.marker(pts[0] || map.getCenter(), {
      icon: L.divIcon({ className: 'mz-label-wrap', iconSize: [0, 0], html: `<div class="mz-label" style="--c:${color}"><b></b><span></span></div>` }),
      keyboard: false,
      zIndexOffset: 400,
      bubblingMouseEvents: false,
    }).addTo(map);
    const tap = (e) => onShapeTap(a, e);
    a.poly.on('click', tap);
    a.label.on('click', tap);
    return a;
  }

  function dropArea(a) {
    a.poly.remove();
    a.label.remove();
  }

  function sizeLabel(a) {
    const el = a.label.getElement();
    if (!el || !a.spot) return;
    const r = a.spot.r * 2 ** (map.getZoom() - Z_REF);
    el.dataset.size = r >= 44 && a.name ? 'lg' : r >= 22 ? 'md' : 'sm';
  }

  function refresh(a) {
    a.poly.setLatLngs(a.pts);
    const el = a.label.getElement();
    const ok = a.pts.length >= 3;
    a.sqft = ok ? toSqft(areaM2(a.pts)) : 0;
    if (!el) return;
    el.style.visibility = ok ? '' : 'hidden';
    if (!ok) return;
    a.spot = labelSpot(a.pts.map((p) => { const q = project(p); return [q.x, q.y]; }));
    a.label.setLatLng(map.unproject([a.spot.x, a.spot.y], Z_REF));
    el.querySelector('b').textContent = a.name || '';
    el.querySelector('span').textContent = `${fmt(a.sqft)} sq ft`;
    sizeLabel(a);
  }

  let rafId = 0;
  const pending = new Set();
  function schedule(a) {
    pending.add(a);
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      for (const p of pending) refresh(p);
      pending.clear();
      paintTotal();
    });
  }

  // ---------- turning the map ----------
  const compass = $('[data-mz-compass]');
  function paintCompass() {
    const b = ((Math.round(map.getBearing()) % 360) + 360) % 360;
    compass.hidden = b === 0;
    compass.querySelector('svg').style.transform = `rotate(${-map.getBearing()}deg)`;
  }
  let bearingTimer = 0;
  map.on('rotate', () => {
    paintCompass();
    clearTimeout(bearingTimer);
    bearingTimer = setTimeout(save, 400);
  });
  function turn(deg) {
    map.setBearing(map.getBearing() + deg, { animate: true, duration: 0.25 });
  }
  // Which way the photo is turned on screen, for the saved image.
  function screenAngle() {
    const c = map.getCenter();
    const a = map.latLngToContainerPoint(c), b = map.latLngToContainerPoint([c.lat, c.lng + 0.001]);
    return Math.atan2(b.y - a.y, b.x - a.x);
  }

  map.on('zoomend', () => {
    areas.forEach(sizeLabel);
    if (drawing) sizeLabel(drawing);
  });

  // ---------- corners ----------
  function linkedTo(pt, self) {
    const out = [];
    for (const b of areas) {
      if (b === self) continue;
      b.pts.forEach((q, k) => { if (Math.abs(q.lat - pt.lat) < 1e-9 && Math.abs(q.lng - pt.lng) < 1e-9) out.push([b, k]); });
    }
    return out;
  }

  function snap(ll, self, skip) {
    const p = map.latLngToContainerPoint(ll);
    let best = null, bd = SNAP_PX;
    for (const a of areas) {
      if (a === self || (skip && skip.has(a))) continue;
      for (const q of a.pts) {
        const d = map.latLngToContainerPoint(q).distanceTo(p);
        if (d < bd) { bd = d; best = q; }
      }
    }
    return best ? L.latLng(best.lat, best.lng) : L.latLng(ll.lat, ll.lng);
  }

  function clearHandles() {
    handles.forEach((h) => h.remove());
    handles = [];
  }

  function buildHandles(a) {
    clearHandles();
    const isDraw = a === drawing;
    a.pts.forEach((p, i) => {
      const first = isDraw && i === 0 && a.pts.length >= 3;
      const cls = 'mz-vtx' + (first ? ' is-first' : '') + (!isDraw && i === pickedVtx ? ' is-picked' : '');
      const m = L.marker(p, {
        draggable: true, autoPan: true, keyboard: false, bubblingMouseEvents: false,
        zIndexOffset: 1000, icon: L.divIcon({ className: cls, iconSize: [44, 44] }),
      }).addTo(map);
      // Corners shared with a neighbor area (from snapping) move together, so no gaps open up.
      let linked = [];
      m.on('dragstart', () => {
        root.classList.add('is-dragging');
        linked = isDraw ? [] : linkedTo(a.pts[i], a);
      });
      const moveTo = (ll) => {
        a.pts[i] = ll;
        schedule(a);
        for (const [b, k] of linked) { b.pts[k] = ll; schedule(b); }
      };
      m.on('drag', () => moveTo(m.getLatLng()));
      m.on('dragend', () => {
        root.classList.remove('is-dragging');
        const others = new Set(linked.map(([b]) => b));
        const ll = snap(m.getLatLng(), a, others);
        a.pts[i] = ll;
        for (const [b, k] of linked) { b.pts[k] = ll; refresh(b); }
        refresh(a);
        if (!isDraw) save();
        buildHandles(a);
        setMode();
      });
      m.on('click', () => {
        if (isDraw) {
          if (i === 0 && a.pts.length >= 3) finish();
          return;
        }
        pickedVtx = pickedVtx === i ? -1 : i;
        buildHandles(a);
        setMode();
      });
      handles.push(m);
    });
    if (isDraw || a.pts.length < 3) return;
    // Little "+" dots halfway along each edge: drag or tap one to add a corner.
    a.pts.forEach((p, i) => {
      const q = a.pts[(i + 1) % a.pts.length];
      const mid = L.latLng((p.lat + q.lat) / 2, (p.lng + q.lng) / 2);
      const m = L.marker(mid, {
        draggable: true, autoPan: true, keyboard: false, bubblingMouseEvents: false,
        zIndexOffset: 900, icon: L.divIcon({ className: 'mz-mid', iconSize: [36, 36] }),
      }).addTo(map);
      m.on('dragstart', () => { root.classList.add('is-dragging'); a.pts.splice(i + 1, 0, m.getLatLng()); });
      m.on('drag', () => { a.pts[i + 1] = m.getLatLng(); schedule(a); });
      m.on('dragend', () => {
        root.classList.remove('is-dragging');
        a.pts[i + 1] = snap(m.getLatLng(), a);
        pickedVtx = -1;
        refresh(a); save(); buildHandles(a); setMode();
      });
      m.on('click', () => {
        a.pts.splice(i + 1, 0, mid);
        pickedVtx = i + 1;
        refresh(a); save(); buildHandles(a); setMode();
      });
      handles.push(m);
    });
  }

  // ---------- drawing ----------
  function startDrawing() {
    deselect();
    hideSheets();
    drawing = makeArea([], '', nextColor());
    drawing.poly.setStyle({ dashArray: '7 7', fillOpacity: 0.2 });
    setMode();
  }

  function addPoint(ll) {
    if (!drawing) return;
    if (pin) { pin.remove(); pin = null; }
    drawing.pts.push(snap(ll, drawing));
    refresh(drawing);
    buildHandles(drawing);
    setMode();
  }

  function undo() {
    if (!drawing) return;
    if (!drawing.pts.length) return cancelDrawing();
    drawing.pts.pop();
    refresh(drawing);
    buildHandles(drawing);
    setMode();
  }

  function cancelDrawing() {
    if (!drawing) return;
    dropArea(drawing);
    drawing = null;
    clearHandles();
    setMode();
  }

  function finish(quiet) {
    if (!drawing || drawing.pts.length < 3) return;
    const a = drawing;
    drawing = null;
    clearHandles();
    a.poly.setStyle({ dashArray: null, fillOpacity: 0.3 });
    a.name = defaultName();
    areas.push(a);
    refresh(a);
    save();
    setMode();
    if (!quiet) openName(a);
    window.mitTrack && window.mitTrack('measure_area_added', { area_count: areas.length });
  }

  function defaultName() {
    let n = areas.length + 1;
    while (areas.some((a) => a.name === `Area ${n}`)) n++;
    return `Area ${n}`;
  }

  // ---------- selecting ----------
  function onShapeTap(a, e) {
    if (!full) return enterFull();
    if (drawing) return addPoint(e.latlng);
    select(a);
  }

  function select(a) {
    if (selected === a) return;
    deselect();
    hideSheets();
    selected = a;
    pickedVtx = -1;
    a.poly.setStyle({ weight: 5 });
    a.poly.bringToFront();
    buildHandles(a);
    setMode();
  }

  function deselect() {
    if (!selected) return;
    selected.poly.setStyle({ weight: 3 });
    selected = null;
    pickedVtx = -1;
    clearHandles();
    setMode();
  }

  function removeCorner() {
    const a = selected;
    if (!a || pickedVtx < 0 || a.pts.length <= 3) return;
    a.pts.splice(pickedVtx, 1);
    pickedVtx = -1;
    refresh(a); save(); buildHandles(a); setMode();
  }

  function deleteArea(a) {
    const i = areas.indexOf(a);
    if (i < 0) return;
    deselect();
    areas.splice(i, 1);
    dropArea(a);
    lastDeleted = { i, name: a.name, color: a.color, pts: a.pts };
    save();
    setMode();
    toast(`Deleted ${a.name}.`, true);
  }

  function undoDelete() {
    if (!lastDeleted) return;
    const d = lastDeleted;
    lastDeleted = null;
    const a = makeArea(d.pts, d.name, d.color);
    areas.splice(Math.min(d.i, areas.length), 0, a);
    refresh(a);
    save();
    setMode();
    hideToast();
  }

  map.on('click', (e) => {
    if (!full) return enterFull();
    if (naming || !searchEl.hidden) return closeSheets();
    if (drawing) return addPoint(e.latlng);
    if (selected) return deselect();
    hintEl.classList.remove('is-nudge');
    void hintEl.offsetWidth;
    hintEl.classList.add('is-nudge');
  });

  // ---------- naming ----------
  function openName(a) {
    naming = a;
    searchEl.hidden = true;
    nameEl.hidden = false;
    $('[data-mz-name-sqft]').textContent = `${fmt(a.sqft)} sq ft`;
    nameInput.value = '';
    nameChips.innerHTML = NAMES.map((n) => {
      const used = areas.some((x) => x !== a && x.name === n);
      return `<button type="button" class="mz-chip${used ? ' is-used' : ''}" data-name="${esc(n)}">${esc(n)}</button>`;
    }).join('');
    setMode();
  }

  function setName(n) {
    const a = naming;
    if (!a) return;
    const clean = String(n || '').trim().slice(0, 24);
    if (clean) a.name = clean;
    refresh(a);
    save();
    closeSheets();
  }

  nameChips.addEventListener('click', (e) => {
    const b = e.target.closest('[data-name]');
    if (b) setName(b.dataset.name);
  });
  nameForm.addEventListener('submit', (e) => {
    e.preventDefault();
    setName(nameInput.value);
  });

  // ---------- search ----------
  function openSearch() {
    naming = null;
    nameEl.hidden = true;
    searchEl.hidden = false;
    searchMsg.textContent = '';
    suggEl.innerHTML = '';
    setMode();
    setTimeout(() => searchInput.focus(), 60);
  }

  function hideSheets() {
    searchEl.hidden = true;
    nameEl.hidden = true;
    naming = null;
    searchInput.blur();
    nameInput.blur();
  }

  // Closing the "find your house" box on an empty map goes straight to tracing.
  function closeSheets() {
    const wasSearch = !searchEl.hidden;
    hideSheets();
    if (wasSearch && full && !areas.length && !drawing) startDrawing();
    else setMode();
  }

  function goTo(lat, lon) {
    map.setView([lat, lon], 19.5);
    if (pin) pin.remove();
    pin = L.marker([lat, lon], {
      interactive: false, keyboard: false,
      icon: L.divIcon({ className: 'mz-pin', html: PIN, iconSize: [28, 36], iconAnchor: [14, 34] }),
    }).addTo(map);
    closeSheets();
    if (!drawing && !areas.length) startDrawing();
    if (!tipShown) {
      tipShown = true;
      toast('Tip: twist two fingers, or tap the arrows, to turn the map.');
    }
  }
  let tipShown = false;

  let suggTimer = 0, suggReq = 0;
  searchInput.addEventListener('input', () => {
    clearTimeout(suggTimer);
    suggTimer = setTimeout(suggest, 220);
  });

  function near() {
    const c = map.getCenter();
    return `${c.lng.toFixed(4)},${c.lat.toFixed(4)}`;
  }

  async function suggest() {
    const q = searchInput.value.trim();
    const id = ++suggReq;
    if (q.length < 3) { suggEl.innerHTML = ''; return; }
    try {
      const url = `${GEO}/suggest?f=json&countryCode=USA&category=Address,Postal&maxSuggestions=5&location=${near()}&text=${encodeURIComponent(q)}`;
      const j = await (await fetch(url)).json();
      if (id !== suggReq) return;
      suggEl.innerHTML = (j.suggestions || []).map((s) =>
        `<li><button type="button" data-key="${esc(s.magicKey)}">${esc(s.text.replace(/, USA$/, ''))}</button></li>`).join('');
    } catch { /* offline: the Go button still works */ }
  }

  async function geocode(text, magicKey) {
    searchMsg.textContent = 'Looking…';
    try {
      let url = `${GEO}/findAddressCandidates?f=json&countryCode=USA&maxLocations=1&location=${near()}&SingleLine=${encodeURIComponent(text)}`;
      if (magicKey) url += `&magicKey=${encodeURIComponent(magicKey)}`;
      const j = await (await fetch(url)).json();
      const c = j.candidates && j.candidates[0];
      if (!c) { searchMsg.textContent = 'Couldn’t find that one. Try adding your town.'; return; }
      searchMsg.textContent = '';
      goTo(c.location.y, c.location.x);
    } catch {
      searchMsg.textContent = 'The map search isn’t answering. Try again, or drag the map to your house.';
    }
  }

  suggEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-key]');
    if (!b) return;
    searchInput.value = b.textContent;
    suggEl.innerHTML = '';
    geocode(b.textContent, b.dataset.key);
  });
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = searchInput.value.trim();
    if (q) geocode(q);
  });

  function useGps() {
    if (!('geolocation' in navigator)) { searchMsg.textContent = 'Your browser won’t share a location. Type your address instead.'; return; }
    searchMsg.textContent = 'Finding you…';
    navigator.geolocation.getCurrentPosition(
      (pos) => { searchMsg.textContent = ''; goTo(pos.coords.latitude, pos.coords.longitude); },
      () => { searchMsg.textContent = 'No location, no problem. Type your address instead.'; },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }

  // ---------- toast ----------
  function toast(text, withUndo) {
    toastEl.querySelector('span').textContent = text;
    toastEl.querySelector('button').hidden = !withUndo;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 5000);
  }
  function hideToast() {
    toastEl.hidden = true;
    lastDeleted = null;
  }

  // ---------- full screen ----------
  function fit(animate) {
    const all = [...areas.flatMap((a) => a.pts), ...(drawing ? drawing.pts : [])];
    if (!all.length) return;
    const b = L.latLngBounds(all);
    if (full) map.fitBounds(b, { paddingTopLeft: [30, 150], paddingBottomRight: [30, 120], maxZoom: 20, animate });
    else map.fitBounds(b, { padding: [24, 24], maxZoom: 20, animate });
  }

  function enterFull() {
    if (full) return;
    full = true;
    window.mitTrack && window.mitTrack('measure_open', { area_count: areas.length });
    root.classList.add('is-full');
    document.documentElement.classList.add('mz-lock');
    history.pushState({ mz: 1 }, '');
    setInteractive(true);
    requestAnimationFrame(() => {
      map.invalidateSize();
      if (areas.length) fit(false);
    });
    if (!areas.length) openSearch();
    setMode();
  }

  function exitFull(fromPop) {
    if (!full) return;
    if (drawing) drawing.pts.length >= 3 ? finish(true) : cancelDrawing();
    deselect();
    hideSheets();
    hideToast();
    if (pin) { pin.remove(); pin = null; }
    full = false;
    root.classList.remove('is-full');
    document.documentElement.classList.remove('mz-lock');
    setInteractive(false);
    requestAnimationFrame(() => {
      map.invalidateSize();
      if (areas.length) fit(false);
    });
    setMode();
    if (!fromPop && history.state && history.state.mz) history.back();
  }

  window.addEventListener('popstate', () => { if (full) exitFull(true); });

  // ---------- image ----------
  async function saveImage(btn) {
    if (!areas.length) return;
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Making it…';
    try {
      const blob = await renderImage(
        areas.map((a) => ({ name: a.name, color: a.color, sqft: a.sqft, pts: a.pts.map((p) => [p.lat, p.lng]) })),
        { angle: screenAngle() },
      );
      const file = new File([blob], 'my-lawn-mowittall.jpg', { type: 'image/jpeg' });
      const touch = matchMedia('(pointer: coarse)').matches;
      if (touch && navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: 'My lawn' }); } catch { /* closed the share sheet */ }
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.name;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      }
    } catch {
      if (full) toast('Couldn’t make the image. Try again.');
      else alertText('Couldn’t make the image. Try again.');
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  }

  function alertText(t) {
    const p = $('[data-mz-note]');
    if (p) p.textContent = t;
  }

  // ---------- painting the UI ----------
  function paintTotal() {
    const live = drawing && drawing.pts.length >= 3 ? drawing.sqft : 0;
    const t = total() + live;
    totalEl.innerHTML = t ? `<small>Total</small> ${fmt(t)} <small>sq ft</small>` : '<small>Total</small> 0 <small>sq ft</small>';
  }

  function hint() {
    if (naming) return 'Pick a name, or skip it.';
    if (drawing) {
      const n = drawing.pts.length;
      if (!n) return areas.length ? 'Tap the first corner of the next area.' : 'Tap a corner of your grass to start.';
      if (n < 3) return 'Keep tapping corners around the edge.';
      return 'Tap the yellow dot or Finish to close it up.';
    }
    if (selected) {
      if (pickedVtx >= 0) return 'Drag it, or remove it.';
      return 'Drag dots to fix the edges. Drag a + to add a corner.';
    }
    if (areas.length) return 'Tap an area to fix it. Add more for the rest of the yard.';
    return 'Find your house to get started.';
  }

  function btn(act, text, cls = '', disabled = false) {
    return `<button type="button" data-act="${act}" class="${cls}"${disabled ? ' disabled' : ''}>${text}</button>`;
  }

  function setMode() {
    root.classList.toggle('is-drawing', !!drawing);
    root.classList.toggle('has-areas', areas.length > 0);
    hintEl.textContent = hint();
    paintTotal();

    let html = '';
    if (drawing) {
      html = btn('undo', drawing.pts.length || !areas.length ? 'Undo' : 'Cancel', '', !drawing.pts.length && !areas.length)
        + btn('finish', 'Finish', 'is-primary', drawing.pts.length < 3);
    } else if (selected) {
      html = (pickedVtx >= 0
        ? btn('remove-corner', 'Remove Corner', '', selected.pts.length <= 3)
        : btn('rename', 'Rename'))
        + btn('delete', 'Delete')
        + btn('deselect', 'OK', 'is-primary');
    } else if (areas.length) {
      html = btn('add', '+ Add Area', 'is-primary') + btn('save-image', 'Save Image');
    } else {
      html = btn('search', 'Find My House', 'is-primary');
    }
    barEl.innerHTML = html;
    renderSummary();
  }

  function renderSummary() {
    const has = areas.length > 0;
    summaryEl.hidden = !has;
    $('[data-mz-empty]').hidden = has;
    if (!has) return;
    const t = total();
    $('[data-mz-list]').innerHTML = areas.map((a) =>
      `<li><i style="background:${a.color}"></i><span>${esc(a.name)}</span><b>${fmt(a.sqft)} sq ft</b></li>`).join('');
    $('[data-mz-sum]').textContent = `${fmt(t)} sq ft`;
    $('[data-mz-acres]').textContent = acresText(t);
  }

  // ---------- saving ----------
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        v: 1,
        total: Math.round(total()),
        bearing: Math.round(map.getBearing() * 10) / 10,
        areas: areas.map((a) => ({ name: a.name, color: a.color, pts: a.pts.map((p) => [+p.lat.toFixed(7), +p.lng.toFixed(7)]) })),
      }));
    } catch { /* private mode */ }
    window.dispatchEvent(new CustomEvent('mit:yard', { detail: { total: Math.round(total()) } }));
    // Email subscribers: every reminder after this uses the measured size (src/scripts/profile.js).
    if (total() >= 100) saveProfile('sqft', Math.round(total()));
  }

  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (d && typeof d.bearing === 'number' && d.bearing) map.setBearing(d.bearing);
      for (const x of (d && d.areas) || []) {
        if (!Array.isArray(x.pts) || x.pts.length < 3) continue;
        const a = makeArea(x.pts.map((p) => L.latLng(p[0], p[1])), String(x.name || defaultName()).slice(0, 24), x.color || nextColor());
        areas.push(a);
        refresh(a);
      }
    } catch { /* bad data: start fresh */ }
  }

  let clearArmed = 0;
  function clearAll(b) {
    if (!clearArmed) {
      b.textContent = 'Tap again to erase everything';
      clearArmed = setTimeout(() => { clearArmed = 0; b.textContent = 'Start Over'; }, 3500);
      return;
    }
    clearTimeout(clearArmed);
    clearArmed = 0;
    b.textContent = 'Start Over';
    areas.forEach(dropArea);
    areas = [];
    map.setBearing(0);
    save();
    map.setView([place.lat, place.lon], 16);
    setMode();
  }

  // ---------- buttons ----------
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const act = b.dataset.act;
    if (act === 'start' || act === 'edit') return enterFull();
    if (act === 'done') return exitFull(false);
    if (act === 'search') return openSearch();
    if (act === 'search-close') return closeSheets();
    if (act === 'gps') return useGps();
    if (act === 'undo') return undo();
    if (act === 'finish') return finish();
    if (act === 'add') return startDrawing();
    if (act === 'rename') return selected && openName(selected);
    if (act === 'name-skip') return closeSheets();
    if (act === 'delete') return selected && deleteArea(selected);
    if (act === 'deselect') return deselect();
    if (act === 'remove-corner') return removeCorner();
    if (act === 'undo-delete') return undoDelete();
    if (act === 'save-image') return saveImage(b);
    if (act === 'clear') return clearAll(b);
    if (act === 'turn-left') return turn(-15);
    if (act === 'turn-right') return turn(15);
    if (act === 'north') return map.setBearing(0, { animate: true, duration: 0.3 });
  });

  // Keep the label/total chips from passing taps through to the map.
  for (const el of root.querySelectorAll('.mz-top, .mz-bar, .mz-sheet, .mz-toast, .mz-turn')) {
    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
  }

  load();
  if (areas.length) fit(false);
  paintCompass();
  setMode();
}
