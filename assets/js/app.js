/* Comoros FIM Results Viewer.
   Leaflet map with the pluvial likelihood mosaic of the selected island drawn on a canvas from the
   vote images in assets/layers/<island>/<cycle>_v.png (RGB = votes at 0.10, 0.30, 0.70 m) and
   <cycle>_w.png (votes at 1.00 m), masked with assets/layers/<island>/static.png (overbank bits,
   commune index, store coverage). Interface strings come from window.FIM_STRINGS. */
"use strict";

var S = window.FIM_STRINGS;
var BASE = window.FIM_BASE || "";
var GRID = window.FIM_GRID;
var EVENTS = ["apr2024", "may2025"];
var ISLANDS = ["grande", "anjouan", "moheli"];
var THRESHOLDS = ["10cm", "30cm", "70cm", "100cm"];
var THR_LABEL = { "10cm": "0.10 m", "30cm": "0.30 m", "70cm": "0.70 m", "100cm": "1.00 m" };
var OB_BIT = { "10cm": 1, "30cm": 2, "70cm": 4, "100cm": 8 };
var N_MEMBERS = 50;
var CLASS_RGB = [[141, 198, 63], [255, 242, 0], [247, 148, 29], [237, 28, 36]];

var ev = "apr2024", island = "grande", thr = "30cm", variant = "raw", idx = 0, playing = null, currentBase = "voyager";
var selectedCommune = null;
var tint = true;
function fixName(n) { return S.fixName ? S.fixName(n) : n; }
var KM2_PER_PX = 0.000935;
var TINT_RGB = ["#c6dbef", "#9ecae1", "#6baed6", "#3182bd", "#08519c"];   /* wet area share classes */
function wetShare(pcode) {
  /* share of the commune area with any likelihood at the current threshold and variant, in percent */
  var I = cur().islands[island];
  for (var k in I.sites) {
    var e = I.sites[k];
    if (e.p !== pcode) { continue; }
    if (!e.s) { return 0; }
    var px = variant === "ob" ? e.s[thr][3] : e.s[thr][1];
    var f = window.COMMUNES.features.filter(function (x) { return x.properties.pcode === pcode; })[0];
    var area = f ? f.properties.area_km2 : 0;
    return area ? 100 * px * KM2_PER_PX / area : 0;
  }
  return 0;
}
function shareClass(sh) { return sh <= 0 ? -1 : sh < 0.5 ? 0 : sh < 1 ? 1 : sh < 2 ? 2 : sh < 4 ? 3 : 4; }
function communeStyle(f) {
  var sel = selectedCommune === f.properties.pcode;
  var k = tint ? shareClass(wetShare(f.properties.pcode)) : -1;
  return { color: sel ? "#111" : "#1b2733", weight: sel ? 2.5 : 1, dashArray: sel ? null : "4 4", fill: true,
           fillColor: k >= 0 ? TINT_RGB[k] : "#000", fillOpacity: k >= 0 ? 0.45 : (sel ? 0.06 : 0.0) };
}

function cycles() { return window.FIM_DATA[ev].cycles; }
function cur() { return cycles()[idx]; }
function isl() { return GRID.islands[island]; }

/* ---------- map ---------- */
var map = L.map("map", { zoomControl: false, attributionControl: false });
L.control.zoom({ position: "topleft", zoomInText: "+", zoomOutText: "-" }).addTo(map);
L.control.attribution({ prefix: false }).addTo(map);
var CARTO_KEY = "cb1_2hul_1_d1beea1581cc2f8c94ba52d4";
function carto(style) {
  return L.tileLayer("https://basemaps.cartocdn.com/rastertiles/" + style + "/{z}/{x}/{y}{r}.png?key=" + CARTO_KEY,
    { maxZoom: 20, detectRetina: false, r: "", attribution: "CARTO, OpenStreetMap" });
}
var basemaps = { voyager: carto("voyager"), positron: carto("light_all"),
  sat: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Esri World Imagery" }) };

var overlay = null;           /* L.imageOverlay of the rendered canvas */
var frame = null;             /* dashed rectangle of the island grid */
var communeLayer = null, reportLayer = null;
var staticCache = {};         /* island -> {ob, unit, cover, w, h} */
var imgCache = {};            /* url -> ImageData */
var pending = 0;

function bounds() { var b = isl().bounds_4326; return [[b[1], b[0]], [b[3], b[2]]]; }

function loadImage(url) {
  return new Promise(function (resolve, reject) {
    if (imgCache[url]) { resolve(imgCache[url]); return; }
    var im = new Image();
    im.onload = function () {
      var c = document.createElement("canvas"); c.width = im.width; c.height = im.height;
      var g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(im, 0, 0);
      var d = g.getImageData(0, 0, im.width, im.height);
      imgCache[url] = d; resolve(d);
    };
    im.onerror = function () { reject(url); };
    im.src = url;
  });
}

function renderLayer() {
  var c = cur(); var g = isl();
  var base = BASE + "assets/layers/" + island + "/";
  var token = ++pending;
  Promise.all([loadImage(base + "static.png"), loadImage(base + c.cycle + "_v.png"), loadImage(base + c.cycle + "_w.png")]).then(function (r) {
    if (token !== pending) { return; }
    var st = r[0].data, v = r[1].data, w = r[2].data, n = r[0].width * r[0].height;
    var out = new Uint8ClampedArray(n * 4);
    var ch = { "10cm": 0, "30cm": 1, "70cm": 2 }[thr];
    var bit = OB_BIT[thr];
    for (var i = 0; i < n; i++) {
      var votes = (ch === undefined) ? w[i * 4] : v[i * 4 + ch];
      if (!votes) { continue; }
      if (!st[i * 4 + 2]) { continue; }                       /* outside store coverage */
      if (variant === "ob" && (st[i * 4] & bit)) { continue; } /* wet in the reference scenario */
      var p = votes / N_MEMBERS;
      var k = p >= 0.6 ? 3 : p >= 0.4 ? 2 : p >= 0.2 ? 1 : 0;
      var col = CLASS_RGB[k];
      out[i * 4] = col[0]; out[i * 4 + 1] = col[1]; out[i * 4 + 2] = col[2]; out[i * 4 + 3] = 215;
    }
    var cv = document.createElement("canvas"); cv.width = r[0].width; cv.height = r[0].height;
    cv.getContext("2d").putImageData(new ImageData(out, cv.width, cv.height), 0, 0);
    var url = cv.toDataURL("image/png");
    if (overlay) { overlay.setUrl(url); overlay.setBounds(bounds()); } else { overlay = L.imageOverlay(url, bounds(), { opacity: 1, interactive: false }).addTo(map); }
    overlay.bringToFront();
    document.getElementById("overlaymsg").classList.remove("show");
  }).catch(function () {
    var m = document.getElementById("overlaymsg"); m.textContent = S.layerMissing; m.classList.add("show");
  });
}

/* ---------- commune polygons and reports ---------- */
function drawCommunes() {
  if (communeLayer) { map.removeLayer(communeLayer); }
  var feats = window.COMMUNES.features.filter(function (f) { return f.properties.island === island; });
  communeLayer = L.geoJSON({ type: "FeatureCollection", features: feats }, {
    style: communeStyle,
    onEachFeature: function (f, l) {
      l.on("click", function () { selectedCommune = (selectedCommune === f.properties.pcode) ? null : f.properties.pcode; draw(); });
      l.bindTooltip(fixName(f.properties.name), { sticky: true, direction: "top" });
    }
  }).addTo(map);
  if (overlay) { overlay.bringToFront(); }
}
function drawReports() {
  if (reportLayer) { map.removeLayer(reportLayer); }
  var pts = window.REPORTS.filter(function (r) { return r.event === ev; });
  reportLayer = L.layerGroup(pts.map(function (r) {
    var m = L.circleMarker([r.lat, r.lon], { radius: 6, color: "#111", weight: 2, fillColor: "#fff", fillOpacity: 0.9 });
    m.bindPopup("<b>" + fixName(r.name) + "</b><br>" + S.reportedImpact + ", " + r.start + " " + S.toWord + " " + r.end +
      "<br>" + S.scaleWord + ": " + r.scale + (r.infrastructure ? "<br>" + S.infraWord + ": " + r.infrastructure : "") +
      (r.dynamics ? "<br>" + S.dynamicsWord + ": " + r.dynamics : "") + "<br><span class=\"src\">" + S.reportSource + "</span>");
    return m;
  })).addTo(map);
}

/* ---------- state in the address ---------- */
function readHash() {
  var h = new URLSearchParams(location.hash.slice(1));
  if (EVENTS.indexOf(h.get("e")) >= 0) { ev = h.get("e"); }
  if (ISLANDS.indexOf(h.get("i")) >= 0) { island = h.get("i"); }
  if (THRESHOLDS.indexOf(h.get("t")) >= 0) { thr = h.get("t"); }
  if (h.get("ob") === "1") { variant = "ob"; }
  if (["voyager", "positron", "sat"].indexOf(h.get("b")) >= 0) { currentBase = h.get("b"); }
  var c = h.get("c");
  if (c) { cycles().forEach(function (x, k) { if (x.cycle === c) { idx = k; } }); }
  else { cycles().forEach(function (x, k) { if (x.peak) { idx = k; } }); }
  if (h.get("u")) { selectedCommune = h.get("u"); }
  if (h.get("tint") === "0") { tint = false; }
}
function writeHash() {
  var h = new URLSearchParams();
  h.set("e", ev); h.set("i", island); h.set("c", cur().cycle); h.set("t", thr);
  if (variant === "ob") { h.set("ob", "1"); }
  if (currentBase !== "voyager") { h.set("b", currentBase); }
  if (selectedCommune) { h.set("u", selectedCommune); }
  if (!tint) { h.set("tint", "0"); }
  history.replaceState(null, "", "#" + h.toString());
}

/* ---------- controls ---------- */
var sel = document.getElementById("cycsel");
function fillCycleSelect() {
  sel.innerHTML = "";
  cycles().forEach(function (c, i) { var o = document.createElement("option"); o.value = i; o.textContent = S.fixLabel(c.label) + (c.peak ? " *" : ""); sel.appendChild(o); });
}
sel.addEventListener("change", function () { idx = +sel.value; draw(); });
document.getElementById("prev").addEventListener("click", function () { step(-1); });
document.getElementById("next").addEventListener("click", function () { step(1); });
document.getElementById("play").addEventListener("click", togglePlay);
document.getElementById("obtoggle").addEventListener("click", function () { variant = (variant === "ob") ? "raw" : "ob"; draw(); });
document.getElementById("tinttoggle").addEventListener("click", function () { tint = !tint; draw(); });
function segHandler(id, key, fn) {
  [].forEach.call(document.querySelectorAll("#" + id + " button"), function (b) {
    b.addEventListener("click", function () { fn(b.dataset[key]); });
  });
}
segHandler("seg-event", "e", function (v) { if (v === ev) { return; } ev = v; idx = Math.min(idx, cycles().length - 1); fillCycleSelect(); buildStrip(); drawReports(); draw(); });
segHandler("seg-island", "i", function (v) { if (v === island) { return; } island = v; selectedCommune = null; map.fitBounds(bounds()); drawFrame(); drawCommunes(); buildStrip(); draw(); });
segHandler("seg-thr", "t", function (v) { thr = v; draw(); });
segHandler("seg-base", "b", function (v) { if (v === currentBase) { return; } map.removeLayer(basemaps[currentBase]); currentBase = v; basemaps[v].addTo(map); draw(); });
document.getElementById("zoomisland").addEventListener("click", function () { selectedCommune = null; map.fitBounds(bounds()); draw(); });
document.addEventListener("keydown", function (e) { if (e.key === "ArrowLeft") { step(-1); } else if (e.key === "ArrowRight") { step(1); } });
function step(d) { idx = Math.min(cycles().length - 1, Math.max(0, idx + d)); draw(); }
function togglePlay() {
  var btn = document.getElementById("play");
  if (playing) { clearInterval(playing); playing = null; btn.textContent = S.play; btn.classList.remove("on"); return; }
  btn.textContent = S.pause; btn.classList.add("on");
  playing = setInterval(function () { idx = (idx + 1) % cycles().length; draw(); }, 900);
}
function drawFrame() {
  if (frame) { map.removeLayer(frame); }
  frame = L.rectangle(bounds(), { color: "#1b2733", weight: 1.2, fill: false, dashArray: "6 5" }).addTo(map);
}

/* ---------- the event strip: island maximum unit streamflow per cycle ---------- */
var strip = document.getElementById("strip"), tip = document.getElementById("tip");
var STRIP_W = 1000, STRIP_H = 120, PAD_L = 42, PAD_R = 12, PAD_T = 12, PAD_B = 26;
function islMax(c) { var v = c.islands[island].max_uq; return v === null ? 0 : v; }
function buildStrip() {
  var C = cycles(); var maxv = 1;
  C.forEach(function (c) { maxv = Math.max(maxv, islMax(c)); }); maxv = Math.ceil(maxv);
  var iw = STRIP_W - PAD_L - PAD_R, ih = STRIP_H - PAD_T - PAD_B;
  var x = function (i) { return PAD_L + iw * i / (C.length - 1); };
  var y = function (v) { return PAD_T + ih * (1 - v / maxv); };
  var parts = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + STRIP_W + " " + STRIP_H + '" preserveAspectRatio="none">'];
  parts.push('<rect x="0" y="0" width="' + STRIP_W + '" height="' + STRIP_H + '" fill="#fff"/>');
  [0, maxv / 2, maxv].forEach(function (v) {
    parts.push('<line x1="' + PAD_L + '" y1="' + y(v) + '" x2="' + (STRIP_W - PAD_R) + '" y2="' + y(v) + '" stroke="#e6eaee"/>');
    parts.push('<text x="' + (PAD_L - 6) + '" y="' + (y(v) + 4) + '" font-size="10" fill="#65727f" text-anchor="end">' + v + "</text>");
  });
  parts.push('<line x1="' + PAD_L + '" y1="' + y(1) + '" x2="' + (STRIP_W - PAD_R) + '" y2="' + y(1) + '" stroke="#c0392b" stroke-dasharray="5 4"/>');
  var d = C.map(function (c, i) { return (i ? "L" : "M") + x(i) + " " + y(islMax(c)); }).join(" ");
  parts.push('<path d="' + d + '" fill="none" stroke="#2b6ca3" stroke-width="2"/>');
  C.forEach(function (c, i) {
    if (c.cycle.slice(9, 11) === "00") {
      parts.push('<line x1="' + x(i) + '" y1="' + PAD_T + '" x2="' + x(i) + '" y2="' + (STRIP_H - PAD_B) + '" stroke="#cfd6dd"/>');
      parts.push('<text x="' + (x(i) + 4) + '" y="' + (STRIP_H - PAD_B + 14) + '" font-size="10.5" fill="#65727f">' + S.dayLabel(c.cycle) + "</text>");
    }
  });
  parts.push('<line id="cursor" x1="0" y1="' + PAD_T + '" x2="0" y2="' + (STRIP_H - PAD_B) + '" stroke="#111" stroke-width="2"/>');
  parts.push("</svg>");
  strip.outerHTML = parts.join("");
  strip = document.querySelector(".stripwrap svg"); strip.id = "strip";
  function idxAt(ev2) { var r = strip.getBoundingClientRect(); var f = (ev2.clientX - r.left) / r.width * STRIP_W; return Math.min(C.length - 1, Math.max(0, Math.round((f - PAD_L) / (STRIP_W - PAD_L - PAD_R) * (C.length - 1)))); }
  strip.addEventListener("click", function (e) { idx = idxAt(e); draw(); });
  strip.addEventListener("mousemove", function (e) {
    var i = idxAt(e); var r = strip.getBoundingClientRect();
    tip.style.display = "block"; tip.style.left = (e.clientX - r.left) + "px"; tip.style.top = "0px";
    tip.textContent = S.fixLabel(C[i].label) + "  " + S.maxUqLower + " " + islMax(C[i]);
  });
  strip.addEventListener("mouseleave", function () { tip.style.display = "none"; });
  moveCursor();
}
function moveCursor() {
  var c = document.getElementById("cursor"); if (!c) { return; }
  var xx = PAD_L + (STRIP_W - PAD_L - PAD_R) * idx / (cycles().length - 1);
  c.setAttribute("x1", xx); c.setAttribute("x2", xx);
}

/* ---------- draw ---------- */
function fmtInt(v) { return (v === null || v === undefined) ? "-" : String(v).replace(/\B(?=(\d{3})+(?!\d))/g, " "); }
function pct(p) { return (p === null || p === undefined) ? "-" : Math.round(p * 100) + " %"; }
function row(k, v) { return "<dt>" + k + "</dt><dd>" + v + "</dd>"; }
function draw() {
  var c = cur(); var I = c.islands[island]; var g = isl();
  sel.value = idx;
  ["seg-event", "seg-island", "seg-thr", "seg-base"].forEach(function (id) {
    var key = { "seg-event": ["e", ev], "seg-island": ["i", island], "seg-thr": ["t", thr], "seg-base": ["b", currentBase] }[id];
    [].forEach.call(document.querySelectorAll("#" + id + " button"), function (b) { b.classList.toggle("on", b.dataset[key[0]] === key[1]); });
  });
  document.getElementById("obtoggle").classList.toggle("on", variant === "ob");
  renderLayer();
  if (communeLayer) { communeLayer.setStyle(communeStyle); }
  document.getElementById("tinttoggle").classList.toggle("on", tint);

  document.getElementById("cyctitle").textContent = S.cycleWord + " " + S.fixLabel(c.label) + " UTC";
  var badge = document.getElementById("badge");
  badge.textContent = I.ntrig + " " + S.ofWord + " " + I.nsites + " " + S.sitesTriggered;
  badge.className = "badge" + (I.ntrig ? "" : " quiet");
  var st = I.stats[thr]; var sv = variant === "ob" ? [st[2], st[3]] : [st[0], st[1]];
  document.getElementById("kv").innerHTML =
    row(S.kvIsland, fixName(g.name)) +
    row(S.kvMaxUq, (I.max_uq === null ? "-" : I.max_uq) + " m3/s/km2") +
    row(S.kvRain, I.rain ? I.rain[0] + " " + S.toWord + " " + I.rain[1] + " mm" : "-") +
    row(S.kvMaxP, pct(sv[0])) +
    row(S.kvPixels, fmtInt(sv[1]) + " (" + (sv[1] * 0.000935).toFixed(1) + " km2)") +
    row(S.kvView, THR_LABEL[thr] + (variant === "ob" ? ", " + S.overbankLower : ""));

  var rows = ["<thead><tr><th>" + S.tblCommune + "</th><th>" + S.tblStatus + "</th><th>" + S.tblUq + "</th><th>" + S.tblMaxP + "</th><th>" + S.tblPixels + "</th><th>" + S.tblShare + "</th></tr></thead><tbody>"];
  var list = Object.keys(I.sites).map(function (k) { var e = I.sites[k]; e._k = k; return e; });
  list.sort(function (a, b) {
    var pa = a.s ? wetShare(a.p) : -1, pb = b.s ? wetShare(b.p) : -1;
    return (pb - pa) || ((b.uq || 0) - (a.uq || 0)) || a.n.localeCompare(b.n);
  });
  list.forEach(function (e) {
    var s = e.s ? e.s[thr] : null; var mp = s ? (variant === "ob" ? s[2] : s[0]) : null; var px = s ? (variant === "ob" ? s[3] : s[1]) : null;
    var cls = (e.st === "t" ? "" : "na") + (selectedCommune === e.p ? " sel" : "");
    rows.push('<tr class="' + cls + '" data-p="' + e.p + '"><td>' + fixName(e.n) + "</td><td>" + (e.st === "t" ? S.triggered : S.quietWord) + "</td><td>" + (e.uq === null ? "-" : e.uq) + "</td><td>" + (mp === null ? "-" : pct(mp)) + "</td><td>" + (px === null ? "-" : fmtInt(px)) + "</td><td>" + (px === null ? "-" : wetShare(e.p).toFixed(1) + " %") + "</td></tr>");
  });
  rows.push("</tbody>");
  var t = document.getElementById("sttable"); t.innerHTML = rows.join("");
  [].forEach.call(t.querySelectorAll("tr[data-p]"), function (tr) {
    tr.addEventListener("click", function () {
      var p = tr.dataset.p; selectedCommune = (selectedCommune === p) ? null : p;
      if (selectedCommune) { var f = window.COMMUNES.features.filter(function (x) { return x.properties.pcode === p; })[0]; if (f) { map.fitBounds(L.geoJSON(f).getBounds()); } }
      draw();
    });
  });
  moveCursor(); writeHash();
}

/* ---------- go ---------- */
readHash();
basemaps[currentBase].addTo(map);
map.fitBounds(bounds());
if (selectedCommune) {
  var f0 = window.COMMUNES.features.filter(function (x) { return x.properties.pcode === selectedCommune; })[0];
  if (f0) { map.fitBounds(L.geoJSON(f0).getBounds()); }
}
drawFrame(); drawCommunes(); drawReports(); fillCycleSelect(); buildStrip(); draw();
