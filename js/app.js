// ─────────────────────────────────────────────────────────────
//  Логика бар-крола. Всё состояние (оценки, посещения, маршрут,
//  таймер) хранится ЛОКАЛЬНО через localStorage — у каждого своё.
// ─────────────────────────────────────────────────────────────

const STORE_KEY = "barcrawl-kitaygorod-v2";

// state = {
//   bars:  { [id]: { rating: 0-5, visited: bool } },
//   route: [ { id, min } ],            // упорядоченный маршрут
//   timer: null | { id, endsAt, paused, leftMs, done }
// }
function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY)) || {};
    return { bars: s.bars || {}, route: Array.isArray(s.route) ? s.route : [], timer: s.timer || null };
  } catch {
    return { bars: {}, route: [], timer: null };
  }
}
function saveState() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
let state = loadState();

// чистим маршрут/таймер от баров, которых больше нет в данных
(function sanitizeState() {
  const ids = new Set(BARS.map((b) => b.id));
  const before = JSON.stringify(state);
  state.route = state.route.filter((r) => ids.has(r.id));
  if (state.timer && !ids.has(state.timer.id)) state.timer = null;
  if (JSON.stringify(state) !== before) saveState();
})();

// ── helpers ──
const $ = (sel, root = document) => root.querySelector(sel);
const barById = (id) => BARS.find((b) => b.id === id);
const barState = (id) => state.bars[id] || { rating: 0, visited: false };
const visitedCount = () => BARS.filter((b) => barState(b.id).visited).length;
const inRoute = (id) => state.route.some((r) => r.id === id);
const stars = (n) => "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);
const monogram = (name) => (name || "?").trim().charAt(0).toUpperCase();

// ── иконки (тонкие линейные SVG, без эмодзи) ──
const ICONS = {
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  location: '<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  play: '<path d="M8 5v14l11-7-11-7Z"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  next: '<path d="M7 5v14l9-7-9-7Z"/><path d="M18 5v14"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="2"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  trash: '<path d="M5 7h14M10 7V5h4v2M7 7l.8 12h8.4L17 7"/>',
  good: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>',
  ban: '<circle cx="12" cy="12" r="8.5"/><path d="M6.5 6.5l11 11"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
  star: '<path d="M12 4l2.3 4.7 5.2.75-3.75 3.66.9 5.15L12 15.9 7.35 18.4l.9-5.15L4.5 9.45l5.2-.75L12 4Z"/>',
  route: '<circle cx="6" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 6h5a4 4 0 0 1 0 8h-3a4 4 0 0 0 0 4h6"/>',
  key: '<circle cx="8" cy="14" r="4"/><path d="M11 11l8-8M16 4l3 3M14.5 5.5l2.5 2.5"/>',
  offline: '<path d="M3 3l18 18M8.8 16.1a4.5 4.5 0 0 1 6.4 0M5 12.5a11 11 0 0 1 3.5-2.3M19 12.5a11 11 0 0 0-4-2.6M2 8.8A16 16 0 0 1 7 6M22 8.8a16 16 0 0 0-6-3M12 20h.01"/>',
};
function svg(name) {
  return `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ""}</svg>`;
}

function setBar(id, patch) {
  state.bars[id] = { ...barState(id), ...patch };
  saveState();
}

function navUrl(bar) {
  const [lat, lng] = bar.coords;
  // Пеший маршрут в Яндекс.Картах от текущего местоположения до бара
  return `https://yandex.ru/maps/?rtext=~${lat},${lng}&rtt=pd`;
}

// ── звук/вибро для таймера ──
let audioCtx = null;
function ensureAudio() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
  } catch { /* без звука */ }
}
function beep() {
  try {
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime;
    [0, 0.25, 0.5].forEach((t) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = "sine"; o.frequency.value = 880;
      o.connect(g); g.connect(audioCtx.destination);
      g.gain.setValueAtTime(0.0001, t0 + t);
      g.gain.exponentialRampToValueAtTime(0.3, t0 + t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + t + 0.18);
      o.start(t0 + t); o.stop(t0 + t + 0.2);
    });
  } catch { /* ignore */ }
}
function buzz() { try { navigator.vibrate && navigator.vibrate([200, 100, 200, 100, 300]); } catch { /* ignore */ } }

// ═════════════════════════ СТАРТОВЫЙ ЭКРАН ═════════════════════════
$("#startBtn").addEventListener("click", () => {
  ensureAudio(); // первый жест — «разрешаем» звук для будущего таймера
  $("#start").hidden = true;
  $("#app").hidden = false;
  switchTo("map");
});

// ═════════════════════════ ВКЛАДКИ ═════════════════════════
function switchTo(view) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("tab--active", t.dataset.view === view));
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("view--active"));
  $("#view-" + view).classList.add("view--active");
  if (view === "map") initMap();
  if (view === "route") renderRoute();
  if (view === "ratings") renderRatings();
  if (view === "passport") renderPassport();
}
document.querySelectorAll(".tab").forEach((tab) =>
  tab.addEventListener("click", () => switchTo(tab.dataset.view))
);

// ═════════════════════════ КАРТА (Яндекс.Карты v3) ═════════════════════════
let map = null, mapInited = false, ymScriptPromise = null, markers = {}, currentZoom = CONFIG.MAP_ZOOM, mapWatchdog = null;

function loadYandex(key) {
  if (window.ymaps3) return Promise.resolve();
  if (ymScriptPromise) return ymScriptPromise;
  ymScriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://api-maps.yandex.ru/v3/?apikey=${encodeURIComponent(key)}&lang=ru_RU`;
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error("Не удалось загрузить скрипт Яндекс.Карт"));
    document.head.appendChild(s);
  });
  return ymScriptPromise;
}

async function initMap() {
  if (mapInited) return;
  const overlay = $("#mapOverlay");
  if (!CONFIG.YANDEX_API_KEY) { showMapOverlay("nokey"); return; }
  overlay.hidden = true;

  // если карта не поднимется за 8 секунд — показываем диагностику
  clearTimeout(mapWatchdog);
  mapWatchdog = setTimeout(() => { if (!mapInited) showMapOverlay("slow"); }, 8000);

  try {
    await loadYandex(CONFIG.YANDEX_API_KEY);
    if (!window.ymaps3) throw new Error("ymaps3 не определён после загрузки скрипта");
    await ymaps3.ready;
    buildMap();
    mapInited = true;
    clearTimeout(mapWatchdog);
    overlay.hidden = true;
  } catch (e) {
    clearTimeout(mapWatchdog);
    console.error("[map]", e);
    showMapOverlay("error", e && e.message);
  }
}

function pinEl(bar, i) {
  const st = barState(bar.id);
  const el = document.createElement("div");
  el.className = "ymap-pin" + (st.visited ? " is-visited" : "") + (inRoute(bar.id) ? " is-route" : "");
  el.innerHTML = `<div class="ymap-pin__body">${st.visited ? svg("check") : `<span>${i + 1}</span>`}</div>`;
  el.addEventListener("click", () => openSheet(bar.id));
  return el;
}

function buildMap() {
  const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapMarker, YMapFeature } = ymaps3;
  const [lat, lng] = CONFIG.MAP_CENTER;

  map = new YMap($("#map"), { location: { center: [lng, lat], zoom: CONFIG.MAP_ZOOM } });
  map.addChild(new YMapDefaultSchemeLayer({ theme: "dark" }));
  map.addChild(new YMapDefaultFeaturesLayer());

  drawRouteLine(YMapFeature);

  BARS.forEach((bar, i) => {
    const el = pinEl(bar, i);
    const marker = new YMapMarker({ coordinates: [bar.coords[1], bar.coords[0]] }, el);
    map.addChild(marker);
    markers[bar.id] = { marker, el, i };
  });
}

let routeLineFeature = null;
function drawRouteLine(YMapFeature) {
  if (!map) return;
  YMapFeature = YMapFeature || (window.ymaps3 && ymaps3.YMapFeature);
  if (!YMapFeature) return;
  if (routeLineFeature) { try { map.removeChild(routeLineFeature); } catch { /* ignore */ } routeLineFeature = null; }
  if (state.route.length < 2) return;
  const coords = state.route.map((r) => { const b = barById(r.id); return [b.coords[1], b.coords[0]]; });
  routeLineFeature = new YMapFeature({
    geometry: { type: "LineString", coordinates: coords },
    style: { stroke: [{ color: "#8f86ff", width: 4, dash: [6, 8] }] },
  });
  map.addChild(routeLineFeature);
}

function refreshMarkers() {
  if (!mapInited) return;
  BARS.forEach((bar, i) => {
    const ref = markers[bar.id];
    if (!ref) return;
    const st = barState(bar.id);
    ref.el.className = "ymap-pin" + (st.visited ? " is-visited" : "") + (inRoute(bar.id) ? " is-route" : "");
    ref.el.querySelector(".ymap-pin__body").innerHTML = st.visited ? svg("check") : `<span>${i + 1}</span>`;
  });
  drawRouteLine();
}

function setZoom(delta) {
  if (!map) return;
  currentZoom = Math.max(10, Math.min(19, currentZoom + delta));
  try {
    const center = map.center || [CONFIG.MAP_CENTER[1], CONFIG.MAP_CENTER[0]];
    map.update({ location: { center, zoom: currentZoom, duration: 200 } });
  } catch (e) { console.warn(e); }
}
$("#zoomIn").addEventListener("click", () => setZoom(1));
$("#zoomOut").addEventListener("click", () => setZoom(-1));

function showMapOverlay(kind, detail) {
  const overlay = $("#mapOverlay");
  const listHtml = `<div class="map-overlay__list">${BARS.map((b) =>
    `<a class="btn btn--nav" href="${navUrl(b)}" target="_blank" rel="noopener">${svg("location")} ${b.name}</a>`
  ).join("")}</div>`;

  if (kind === "nokey") {
    overlay.innerHTML = `
      <span class="brand-mark">${svg("key")}</span>
      <h3>Нужен ключ Яндекс.Карт</h3>
      <p>Вставь бесплатный ключ в <code>js/config.js</code> (поле <code>YANDEX_API_KEY</code>) — инструкция там же. Карта появится автоматически.</p>
      <p style="color:var(--faint)">А пока — список баров с маршрутом в Яндекс.Картах:</p>
      ${listHtml}`;
  } else {
    overlay.innerHTML = `
      <span class="brand-mark">${svg("offline")}</span>
      <h3>${kind === "slow" ? "Карта долго не отвечает" : "Карта не загрузилась"}</h3>
      <ul class="map-overlay__why">
        <li><b>Домен не добавлен в ключ.</b> В кабинете Яндекса в поле <b>HTTP Referer</b> добавь: <code>localhost</code>, <code>127.0.0.1</code> и адрес сайта (для GitHub Pages — <code>45y65kbksk-glitch.github.io</code>).</li>
        <li><b>Ключ ещё активируется</b> — это до 15 минут после создания.</li>
        <li><b>Открыта как файл.</b> Запусти через веб-сервер или по ссылке (не открывай index.html двойным кликом).</li>
      </ul>
      ${detail ? `<p class="map-overlay__detail">Детали: ${detail}</p>` : ""}
      <button class="btn btn--glass" onclick="location.reload()">Обновить</button>
      <p style="color:var(--faint)">Пока — список баров с маршрутом:</p>
      ${listHtml}`;
  }
  overlay.hidden = false;
}

// ═════════════════════════ КАРТОЧКА БАРА ═════════════════════════
function openSheet(id) {
  const bar = barById(id);
  const st = barState(id);
  const body = $("#modalBody");

  const photo = bar.photo
    ? `<div class="sheet__photo"><img src="${bar.photo}" alt="${bar.name}" loading="lazy" /></div>`
    : `<div class="sheet__photo"><span class="sheet__photo-mono">${monogram(bar.name)}</span></div>`;

  const avoidBlock = (bar.avoid && bar.avoid.length)
    ? `<div class="sheet__block">
         <div class="sheet__label is-bad">${svg("ban")} Что не стоит брать</div>
         <ul class="sheet__order is-bad">${bar.avoid.map((o) => `<li>${o}</li>`).join("")}</ul>
       </div>` : "";

  const toast = bar.toast ? `<p class="toast">${bar.toast}</p>` : "";

  body.innerHTML = `
    ${photo}
    <div class="sheet__head">
      <span class="sheet__mono">${monogram(bar.name)}</span>
      <div>
        <h2 class="sheet__name">${bar.name}</h2>
        <p class="sheet__street">${bar.street}</p>
      </div>
    </div>

    <div class="sheet__block">
      <div class="sheet__label">${svg("info")} Зачем сюда идти</div>
      <p class="sheet__feature">${bar.feature}</p>
    </div>

    <div class="sheet__block">
      <div class="sheet__label is-good">${svg("good")} Что заказать</div>
      <ul class="sheet__order">${bar.order.map((o) => `<li>${o}</li>`).join("")}</ul>
    </div>

    ${avoidBlock}

    <div class="sheet__block">
      <div class="sheet__label is-quest">${svg("target")} Квест от автора</div>
      <div class="sheet__quest">
        <p>${bar.quest}</p>
        ${toast}
      </div>
    </div>

    <div class="sheet__block">
      <div class="sheet__label">${svg("star")} Твоя оценка</div>
      <div class="rating" id="rating">
        ${[1, 2, 3, 4, 5].map((n) => `<span class="rating__star ${n <= st.rating ? "on" : ""}" data-n="${n}">★</span>`).join("")}
        <span class="rating__hint" id="ratingHint">${st.rating ? st.rating + "/5" : "поставь звёзды"}</span>
      </div>
    </div>

    <button class="btn ${st.visited ? "btn--visited" : "btn--primary"}" id="visitBtn">
      ${st.visited ? svg("check") + " Были тут" : "Отметить, что были тут"}
    </button>
    <div class="btn-row">
      <button class="btn ${inRoute(id) ? "btn--glass" : "btn--cool"}" id="routeBtn">
        ${inRoute(id) ? svg("minus") + " Убрать из маршрута" : svg("plus") + " В маршрут"}
      </button>
      <a class="btn btn--nav" href="${navUrl(bar)}" target="_blank" rel="noopener">${svg("location")} Маршрут</a>
    </div>
  `;

  // оценка
  body.querySelectorAll(".rating__star").forEach((star) => {
    star.addEventListener("click", () => {
      const n = +star.dataset.n;
      const cur = barState(id).rating;
      setBar(id, { rating: cur === n ? 0 : n }); // повторный тап по той же звезде — сброс
      openSheet(id);
      renderRatings();
    });
  });

  $("#visitBtn").addEventListener("click", () => {
    setBar(id, { visited: !barState(id).visited });
    openSheet(id);
    renderProgress(); renderRatings(); renderRoute(); refreshMarkers();
  });

  $("#routeBtn").addEventListener("click", () => {
    toggleRoute(id);
    openSheet(id);
  });

  $("#modal").hidden = false;
}

function closeModal() { $("#modal").hidden = true; }
document.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", closeModal));
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
window.openSheet = openSheet;

// ═════════════════════════ МАРШРУТ + ТАЙМЕР ═════════════════════════
function toggleRoute(id) {
  if (inRoute(id)) state.route = state.route.filter((r) => r.id !== id);
  else state.route.push({ id, min: CONFIG.DEFAULT_MINUTES });
  saveState();
  renderRoute(); refreshMarkers();
}
function moveRoute(id, dir) {
  const i = state.route.findIndex((r) => r.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= state.route.length) return;
  [state.route[i], state.route[j]] = [state.route[j], state.route[i]];
  saveState();
  renderRoute(); refreshMarkers();
}
function setRouteMin(id, min) {
  const r = state.route.find((x) => x.id === id);
  if (!r) return;
  r.min = Math.max(5, Math.min(600, min || CONFIG.DEFAULT_MINUTES));
  saveState();
}

function renderRoute() {
  renderTimerPanel();

  const list = $("#routeList");
  const hint = $("#routeHint");
  if (!state.route.length) {
    list.innerHTML = `<div class="empty"><span class="empty__ic">${svg("route")}</span>Маршрут пуст. Добавь бары ниже или из карточки бара — собери план на вечер и поставь таймер на каждую точку.</div>`;
    hint.textContent = "";
  } else {
    const totalMin = state.route.reduce((s, r) => s + (r.min || 0), 0);
    hint.textContent = `${state.route.length} баров · ~${totalMin} мин`;
    list.innerHTML = "";
    state.route.forEach((r, idx) => {
      const bar = barById(r.id);
      const active = state.timer && state.timer.id === r.id;
      const item = document.createElement("div");
      item.className = "route-item" + (active ? " is-active" : "");
      item.innerHTML = `
        <div class="route-item__idx">${idx + 1}</div>
        <div class="route-item__main">
          <div class="route-item__name">${bar.name}</div>
          <div class="route-item__min">
            <input type="number" min="5" max="600" step="5" value="${r.min}" inputmode="numeric" aria-label="минут в баре" />
            <label>мин</label>
          </div>
        </div>
        <div class="route-item__acts">
          <button class="icon-btn" data-act="up" ${idx === 0 ? "disabled" : ""} aria-label="Выше">${svg("up")}</button>
          <button class="icon-btn" data-act="down" ${idx === state.route.length - 1 ? "disabled" : ""} aria-label="Ниже">${svg("down")}</button>
          <button class="icon-btn icon-btn--go" data-act="go" aria-label="Запустить таймер">${svg("play")}</button>
          <button class="icon-btn icon-btn--del" data-act="del" aria-label="Убрать">${svg("trash")}</button>
        </div>`;
      $("input", item).addEventListener("change", (e) => setRouteMin(r.id, parseInt(e.target.value, 10)));
      $('[data-act="up"]', item).addEventListener("click", () => moveRoute(r.id, -1));
      $('[data-act="down"]', item).addEventListener("click", () => moveRoute(r.id, 1));
      $('[data-act="go"]', item).addEventListener("click", () => startTimer(r.id));
      $('[data-act="del"]', item).addEventListener("click", () => toggleRoute(r.id));
      list.appendChild(item);
    });
  }

  const add = $("#routeAdd");
  const rest = BARS.filter((b) => !inRoute(b.id));
  add.innerHTML = rest.length
    ? rest.map((b) => `<button class="chip" data-id="${b.id}">${svg("plus")}<span>${b.name}</span></button>`).join("")
    : `<span class="section-head__hint">Все бары уже в маршруте</span>`;
  add.querySelectorAll(".chip").forEach((chip) =>
    chip.addEventListener("click", () => toggleRoute(chip.dataset.id))
  );
}

// ── таймер ──
let tickHandle = null;
function startTicking() { stopTicking(); tickHandle = setInterval(tick, 1000); tick(); }
function stopTicking() { if (tickHandle) { clearInterval(tickHandle); tickHandle = null; } }
function fmt(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
function timerLeft() {
  if (!state.timer) return 0;
  return state.timer.paused ? state.timer.leftMs : Math.max(0, state.timer.endsAt - Date.now());
}

function startTimer(id) {
  const r = state.route.find((x) => x.id === id) || { id, min: CONFIG.DEFAULT_MINUTES };
  const ms = (r.min || CONFIG.DEFAULT_MINUTES) * 60000;
  ensureAudio();
  state.timer = { id, endsAt: Date.now() + ms, paused: false, leftMs: ms, done: false };
  saveState();
  startTicking();
  switchTo("route");
}
function pauseTimer() {
  if (!state.timer || state.timer.paused) return;
  state.timer.leftMs = timerLeft();
  state.timer.paused = true;
  saveState(); stopTicking(); renderTimerPanel();
}
function resumeTimer() {
  if (!state.timer) return;
  state.timer.endsAt = Date.now() + (state.timer.leftMs || 0);
  state.timer.paused = false; state.timer.done = false;
  saveState(); startTicking(); renderTimerPanel();
}
function addTime(min) {
  if (!state.timer) return;
  const add = min * 60000;
  if (state.timer.done) { state.timer = { ...state.timer, endsAt: Date.now() + add, leftMs: add, paused: false, done: false }; }
  else if (state.timer.paused) { state.timer.leftMs += add; }
  else { state.timer.endsAt += add; }
  saveState();
  if (!state.timer.paused) startTicking();
  renderTimerPanel();
}
function stopTimer() { state.timer = null; saveState(); stopTicking(); renderRoute(); }
function nextBar() {
  if (!state.timer) return;
  const i = state.route.findIndex((r) => r.id === state.timer.id);
  const next = state.route[i + 1];
  if (next) startTimer(next.id);
  else { stopTimer(); }
}
function onTimerDone() {
  stopTicking();
  state.timer.paused = true; state.timer.leftMs = 0; state.timer.done = true;
  saveState();
  beep(); buzz();
  renderTimerPanel();
}

function tick() {
  if (!state.timer || state.timer.paused) return;
  const left = timerLeft();
  if (left <= 0) { onTimerDone(); return; }
  const el = $("#timerPanel .timer__time");
  if (el) el.textContent = fmt(left);
}

function renderTimerPanel() {
  const panel = $("#timerPanel");
  if (!state.timer) { panel.hidden = true; panel.innerHTML = ""; return; }
  const bar = barById(state.timer.id);
  if (!bar) { stopTimer(); return; }
  const done = state.timer.done;
  panel.hidden = false;
  panel.classList.toggle("is-done", !!done);

  panel.innerHTML = `
    <div class="timer__label">${done ? "Время вышло" : "Сейчас в баре"}</div>
    <div class="timer__bar">${bar.name}</div>
    <div class="timer__time">${done ? "00:00" : fmt(timerLeft())}</div>
    <div class="timer__ctrls">
      ${done
        ? `<button class="btn btn--cool" data-t="next">${svg("next")} Следующий бар</button>
           <button class="btn btn--glass" data-t="add5">+5 мин</button>
           <button class="btn btn--ghost" data-t="stop">Стоп</button>`
        : `<button class="btn btn--glass" data-t="${state.timer.paused ? "resume" : "pause"}">${state.timer.paused ? svg("play") + " Продолжить" : svg("pause") + " Пауза"}</button>
           <button class="btn btn--glass" data-t="add5">+5 мин</button>
           <button class="btn btn--cool" data-t="next" aria-label="Следующий бар">${svg("next")}</button>`}
    </div>
    ${done ? `<button class="btn btn--visited" data-t="visit" style="margin-top:10px">${svg("check")} Отметить, что были тут</button>` : ""}
  `;

  const actions = { pause: pauseTimer, resume: resumeTimer, add5: () => addTime(5), next: nextBar, stop: stopTimer };
  panel.querySelectorAll("[data-t]").forEach((btn) => {
    const act = btn.dataset.t;
    btn.addEventListener("click", () => {
      if (act === "visit") {
        setBar(state.timer.id, { visited: true });
        renderProgress(); refreshMarkers(); renderTimerPanel();
      } else if (actions[act]) actions[act]();
    });
  });
}

// ═════════════════════════ МОИ ОЦЕНКИ ═════════════════════════
function renderRatings() {
  const wrap = $("#ratingsList");
  const rated = BARS.filter((b) => barState(b.id).rating > 0)
    .sort((a, b) => barState(b.id).rating - barState(a.id).rating);

  const avg = rated.length
    ? (rated.reduce((s, b) => s + barState(b.id).rating, 0) / rated.length).toFixed(1)
    : null;
  $("#ratingsAvg").textContent = avg ? `средняя ${avg} · ${rated.length}` : "";

  if (!rated.length) {
    wrap.innerHTML = `<div class="empty"><span class="empty__ic">${svg("star")}</span>Пока нет оценок. Открой бар на карте и поставь ему звёзды — он появится здесь.</div>`;
    return;
  }
  wrap.innerHTML = "";
  rated.forEach((bar) => {
    const st = barState(bar.id);
    const card = document.createElement("div");
    card.className = "bar-card" + (st.visited ? " visited" : "");
    card.innerHTML = `
      <div class="bar-card__num">${st.rating}</div>
      <div class="bar-card__main">
        <div class="bar-card__name">${bar.name}</div>
        <div class="bar-card__street">${bar.street}</div>
        <div class="bar-card__stars">${stars(st.rating)}</div>
      </div>
      <div class="bar-card__chev">${svg("chevron")}</div>`;
    card.addEventListener("click", () => openSheet(bar.id));
    wrap.appendChild(card);
  });
}

// ═════════════════════════ ПАСПОРТ ═════════════════════════
const BADGES = [
  { need: 1, label: "Первый бар" },
  { need: 3, label: "В деле" },
  { need: 5, label: "Половина пути" },
  { need: 8, label: "Марафонец" },
  { need: 10, label: "Король Китай-города" },
];

function rankFor(done, total) {
  if (done >= total && total > 0) return { title: "Легенда Китай-города", caption: "Весь маршрут пройден. Ты — легенда этого вечера!" };
  const ranks = [
    { n: 0, title: "Трезвенник-теоретик", caption: "Маршрут ещё не начат. Отметь первый бар!" },
    { n: 1, title: "Робкий новичок", caption: "Первый бар взят — лиха беда начало." },
    { n: 2, title: "Уже не дома", caption: "Разогрелся. Так держать!" },
    { n: 3, title: "Свой человек", caption: "Тебя уже узнают бармены." },
    { n: 5, title: "Завсегдатай Китай-города", caption: "Половина пути позади." },
    { n: 7, title: "Барный навигатор", caption: "Ты знаешь тут каждый подвал." },
    { n: 9, title: "Гранд-мастер бар-крола", caption: "Финиш совсем близко!" },
  ];
  let r = ranks[0];
  for (const cand of ranks) if (done >= cand.n) r = cand;
  return r;
}

function renderProgress() {
  const done = visitedCount(), total = BARS.length;
  $("#progressCount").textContent = `${done}/${total}`;
  $("#progressFill").style.width = (total ? (done / total) * 100 : 0) + "%";
}

function renderPassport() {
  const done = visitedCount(), total = BARS.length;
  $("#passportBig").textContent = done;
  $("#passportTotal").textContent = "из " + total;
  $(".passport__ring").style.setProperty("--p", (total ? (done / total) * 100 : 0) + "%");

  const rank = rankFor(done, total);
  $("#passportRank").textContent = rank.title;
  $("#passportCaption").textContent = rank.caption;

  const level = total ? Math.max(0, Math.min(5, Math.round((done / total) * 5))) : 0;
  $("#passportStars").textContent = stars(level);

  $("#passportBadges").innerHTML = BADGES.map((b) =>
    `<span class="badge ${done >= b.need ? "earned" : ""}">${b.label}</span>`
  ).join("");

  renderProgress();
}

$("#resetBtn").addEventListener("click", () => {
  if (!confirm("Сбросить все оценки, отметки и маршрут? Это нельзя отменить.")) return;
  state = { bars: {}, route: [], timer: null };
  saveState(); stopTicking();
  renderProgress(); renderPassport(); renderRatings(); renderRoute(); refreshMarkers();
});

// ═════════════════════════ СТАРТ ═════════════════════════
renderProgress();
if (state.timer && !state.timer.paused && !state.timer.done) {
  if (timerLeft() <= 0) { state.timer.done = true; state.timer.paused = true; state.timer.leftMs = 0; saveState(); }
  else startTicking();
}

// service worker (PWA / офлайн-оболочка)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
