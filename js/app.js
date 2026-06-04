// ─────────────────────────────────────────────────────────────
//  Логика бар-крола. Всё состояние (рейтинги, посещения) хранится
//  ЛОКАЛЬНО в браузере через localStorage — у каждого своё.
// ─────────────────────────────────────────────────────────────

const STORE_KEY = "barcrawl-kitaygorod-v1";

// state: { [barId]: { rating: 0-5, visited: bool } }
function loadState() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
  catch { return {}; }
}
function saveState(state) {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}
function barState(id) {
  return state[id] || { rating: 0, visited: false };
}
let state = loadState();

// ── helpers ──
const $ = (sel) => document.querySelector(sel);
const stars = (n) => "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);
const visitedCount = () => BARS.filter((b) => barState(b.id).visited).length;

function navUrl(bar) {
  const [lat, lng] = bar.coords;
  // Универсальная гео-ссылка: телефон сам предложит карты
  return `https://maps.google.com/?q=${lat},${lng}`;
}

// ── рендер списка/маршрута ──
function renderList() {
  const wrap = $("#barList");
  wrap.innerHTML = "";
  BARS.forEach((bar, i) => {
    const st = barState(bar.id);
    const card = document.createElement("div");
    card.className = "bar-card" + (st.visited ? " visited" : "");
    card.innerHTML = `
      <div class="bar-card__num">${st.visited ? "✓" : i + 1}</div>
      <div class="bar-card__main">
        <div class="bar-card__name">${bar.emoji} ${bar.name}</div>
        <div class="bar-card__street">${bar.street}</div>
        <div class="bar-card__stars">${st.rating ? stars(st.rating) : "<span style='color:var(--muted)'>ещё без оценки</span>"}</div>
      </div>
      <div class="bar-card__chev">›</div>
    `;
    card.addEventListener("click", () => openSheet(bar.id));
    wrap.appendChild(card);
  });
}

// ── прогресс в шапке ──
function renderProgress() {
  const done = visitedCount();
  const total = BARS.length;
  $("#progressCount").textContent = `${done}/${total}`;
  $("#progressFill").style.width = (done / total) * 100 + "%";
}

// ── модалка карточки бара ──
function openSheet(id) {
  const bar = BARS.find((b) => b.id === id);
  const st = barState(id);
  const body = $("#modalBody");

  body.innerHTML = `
    <div class="sheet__head">
      <span class="sheet__emoji">${bar.emoji}</span>
      <div>
        <h2 class="sheet__name">${bar.name}</h2>
        <p class="sheet__street">${bar.street}</p>
      </div>
    </div>

    <div class="sheet__block">
      <div class="sheet__label">Зачем сюда идти</div>
      <p class="sheet__feature">${bar.feature}</p>
    </div>

    <div class="sheet__block">
      <div class="sheet__label">Что заказать</div>
      <ul class="sheet__order">${bar.order.map((o) => `<li>${o}</li>`).join("")}</ul>
    </div>

    <div class="sheet__block">
      <div class="sheet__label">Оценка компании</div>
      <div class="rating" id="rating">
        ${[1,2,3,4,5].map((n) => `<span class="rating__star ${n <= st.rating ? "on" : ""}" data-n="${n}">★</span>`).join("")}
        <span class="rating__hint" id="ratingHint">${st.rating ? st.rating + "/5" : "поставь звёзды"}</span>
      </div>
    </div>

    <div class="sheet__block sheet__game">
      <div class="sheet__label" style="color:var(--gold)">🎲 Челлендж точки</div>
      <p>${bar.challenge}</p>
      <p class="toast">🥂 ${bar.toast}</p>
    </div>

    <button class="btn ${st.visited ? "btn--visited" : "btn--primary"}" id="visitBtn">
      ${st.visited ? "✓ Были тут" : "Отметить, что были тут"}
    </button>
    <a class="btn btn--nav" href="${navUrl(bar)}" target="_blank" rel="noopener">📍 Построить маршрут</a>
  `;

  // рейтинг
  body.querySelectorAll(".rating__star").forEach((star) => {
    star.addEventListener("click", () => {
      const n = +star.dataset.n;
      const cur = barState(id).rating;
      const next = cur === n ? 0 : n; // повторный тап по той же — сброс
      setBar(id, { rating: next });
      openSheet(id); // перерисовать
      renderList();
    });
  });

  // отметка посещения
  $("#visitBtn").addEventListener("click", () => {
    setBar(id, { visited: !barState(id).visited });
    openSheet(id);
    renderList();
    renderProgress();
    refreshMarkers();
    renderPassport();
  });

  $("#modal").hidden = false;
}

function setBar(id, patch) {
  state[id] = { ...barState(id), ...patch };
  saveState(state);
}

function closeModal() { $("#modal").hidden = true; }
document.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", closeModal));
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

// ── вкладки ──
let mapInited = false;
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("tab--active"));
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("view--active"));
    tab.classList.add("tab--active");
    const view = tab.dataset.view;
    $("#view-" + view).classList.add("view--active");
    if (view === "map") initMap();
    if (view === "passport") renderPassport();
  });
});

// ── карта (Leaflet + OpenStreetMap) ──
let map, markers = {};
function initMap() {
  if (mapInited) { setTimeout(() => map.invalidateSize(), 100); return; }
  mapInited = true;

  map = L.map("map", { zoomControl: true }).setView([55.7558, 37.6355], 15);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap",
  }).addTo(map);

  // линия маршрута
  L.polyline(BARS.map((b) => b.coords), {
    color: "#ff7a59", weight: 3, opacity: 0.5, dashArray: "6 8",
  }).addTo(map);

  BARS.forEach((bar, i) => {
    const st = barState(bar.id);
    const icon = L.divIcon({
      className: "",
      html: `<div class="map-pin ${st.visited ? "visited" : ""}"><span>${st.visited ? "✓" : i + 1}</span></div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [0, -28],
    });
    const m = L.marker(bar.coords, { icon }).addTo(map);
    m.bindPopup(
      `<b>${bar.emoji} ${bar.name}</b><br>${bar.street}` +
      `<br><a class="popup-link" href="#" onclick="openSheet('${bar.id}');return false;">Открыть карточку →</a>`
    );
    markers[bar.id] = m;
  });

  const group = L.featureGroup(Object.values(markers));
  map.fitBounds(group.getBounds().pad(0.2));
  setTimeout(() => map.invalidateSize(), 100);
}

function refreshMarkers() {
  if (!mapInited) return;
  BARS.forEach((bar, i) => {
    const st = barState(bar.id);
    const m = markers[bar.id];
    if (!m) return;
    m.setIcon(L.divIcon({
      className: "",
      html: `<div class="map-pin ${st.visited ? "visited" : ""}"><span>${st.visited ? "✓" : i + 1}</span></div>`,
      iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -28],
    }));
  });
}

// ── паспорт ──
const BADGES = [
  { need: 1, label: "🍺 Первый бар" },
  { need: 3, label: "🔥 В деле" },
  { need: 5, label: "⭐ Половина пути" },
  { need: 8, label: "🚀 Марафонец" },
  { need: 10, label: "👑 Король Китай-города" },
];

function renderPassport() {
  const done = visitedCount();
  const total = BARS.length;
  $("#passportBig").textContent = done;
  $("#passportTotal").textContent = "из " + total;
  $(".passport__ring").style.setProperty("--p", (done / total) * 100 + "%");

  let caption;
  if (done === 0) caption = "Маршрут ждёт! Отметь первый бар, и здесь появится прогресс.";
  else if (done < total) caption = `Пройдено ${done} из ${total}. До короны Китай-города осталось ${total - done}!`;
  else caption = "🎉 Весь маршрут пройден! Вы — легенды этого вечера.";
  $("#passportCaption").textContent = caption;

  $("#passportBadges").innerHTML = BADGES.map((b) =>
    `<span class="badge ${done >= b.need ? "earned" : ""}">${b.label}</span>`
  ).join("");
}

$("#resetBtn").addEventListener("click", () => {
  if (!confirm("Сбросить все оценки и отметки? Это действие нельзя отменить.")) return;
  state = {};
  saveState(state);
  renderList(); renderProgress(); renderPassport(); refreshMarkers();
});

// нужно глобально для onclick в попапе карты
window.openSheet = openSheet;

// ── старт ──
renderList();
renderProgress();
renderPassport();

// регистрируем service worker (PWA / офлайн-оболочка)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
