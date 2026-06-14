/* Sber — ТПСО presentation builder (editable .pptx, Sber brand style) */
const pptxgen = require("pptxgenjs");
const path = require("path");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const FA = require("react-icons/fa");

const A = (f) => path.join(__dirname, "assets", f);

// ---------- design tokens ----------
const F = "Calibri";
const FB = "Calibri"; // bold via bold:true
const C = {
  green: "21A038", greenDk: "0E7A2B", greenDkr: "0A5C20",
  ink: "16241C", body: "45554B", muted: "7E8E84",
  card: "F4FAF6", cardTint: "E9F5EC", cardLine: "DBEDE1",
  white: "FFFFFF",
  amber: "B5710A", amberBg: "FBEED7",
  dkText: "FFFFFF", dkMuted: "A9C4B4", dkCard: "11301E", dkCardLine: "21492F",
};
const W = 13.333, H = 7.5, MX = 0.62;
const CW = W - 2 * MX;

// ---------- icon rendering ----------
const ICON = {}; // name -> base64 png (white)
const ICON_G = {}; // name -> base64 png (green)
async function renderIcon(comp, color, size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(comp, { color, size: String(size) })
  );
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + png.toString("base64");
}
const ICONSET = {
  university: FA.FaUniversity, robot: FA.FaRobot, cubes: FA.FaCubes,
  globe: FA.FaGlobeEurope, users: FA.FaUsers, building: FA.FaBuilding,
  landmark: FA.FaLandmark, chartline: FA.FaChartLine, usertie: FA.FaUserTie,
  handshake: FA.FaHandshake, globe2: FA.FaGlobe, eye: FA.FaEye,
  shield: FA.FaShieldAlt, scale: FA.FaBalanceScale, bullhorn: FA.FaBullhorn,
  invoice: FA.FaFileInvoiceDollar, grad: FA.FaGraduationCap, news: FA.FaNewspaper,
  poll: FA.FaPollH, tower: FA.FaBroadcastTower, bulb: FA.FaLightbulb,
  arrow: FA.FaArrowRight, target: FA.FaBullseye, calendar: FA.FaCalendarAlt,
  comments: FA.FaComments, check: FA.FaCheckCircle, warn: FA.FaExclamationTriangle,
  chartbar: FA.FaChartBar, coins: FA.FaCoins, brain: FA.FaBrain,
  layers: FA.FaLayerGroup, flag: FA.FaFlag,
};
async function buildIcons() {
  for (const [k, comp] of Object.entries(ICONSET)) {
    ICON[k] = await renderIcon(comp, "#FFFFFF");
    ICON_G[k] = await renderIcon(comp, "#21A038");
  }
}

// ---------- helpers ----------
let pres;
const sh = () => pres.shapes;
function shadow(col = "1B3A28", op = 0.10) {
  return { type: "outer", color: col, blur: 7, offset: 2, angle: 90, opacity: op };
}
function card(slide, x, y, w, h, o = {}) {
  slide.addShape(sh().ROUNDED_RECTANGLE, {
    x, y, w, h, rectRadius: 0.08,
    fill: { color: o.fill || C.card },
    line: o.line ? { color: o.line, width: 1 } : { type: "none" },
    ...(o.noShadow ? {} : { shadow: shadow(o.shCol, o.shOp) }),
  });
}
function iconCircle(slide, x, y, d, name, o = {}) {
  slide.addShape(sh().OVAL, { x, y, w: d, h: d, fill: { color: o.bg || C.green }, line: { type: "none" } });
  const p = d * 0.27;
  slide.addImage({ data: (o.icon === "green" ? ICON_G : ICON)[name], x: x + p, y: y + p, w: d - 2 * p, h: d - 2 * p });
}
function kicker(slide, text, dark) {
  slide.addText(text.toUpperCase(), {
    x: MX, y: 0.46, w: CW - 1, h: 0.3, fontFace: FB, bold: true, fontSize: 12.5,
    color: C.green, charSpacing: 3, align: "left", margin: 0, valign: "middle",
  });
}
function title(slide, text, dark) {
  slide.addText(text, {
    x: MX, y: 0.78, w: CW - 1.1, h: 0.78, fontFace: FB, bold: true, fontSize: 31,
    color: dark ? C.white : C.ink, align: "left", margin: 0, valign: "top",
  });
}
function corner(slide) {
  slide.addImage({ path: A("sber_mark.png"), x: W - MX - 0.56, y: 0.46, w: 0.56, h: 0.56 });
}
function pager(slide, n, dark) {
  slide.addText("Сбер · Теория и практика связей с общественностью", {
    x: MX, y: 7.06, w: 8, h: 0.3, fontFace: F, fontSize: 9,
    color: dark ? C.dkMuted : C.muted, align: "left", margin: 0, valign: "middle",
  });
  slide.addText(`${n} / 11`, {
    x: W - MX - 1.6, y: 7.06, w: 1.6, h: 0.3, fontFace: F, fontSize: 9,
    color: dark ? C.dkMuted : C.muted, align: "right", margin: 0, valign: "middle",
  });
}
function band(slide, x, y, w, h, name, runs, o = {}) {
  slide.addShape(sh().ROUNDED_RECTANGLE, {
    x, y, w, h, rectRadius: 0.08, fill: { color: o.fill || C.green }, line: { type: "none" },
    shadow: { type: "outer", color: "0A5C20", blur: 8, offset: 2, angle: 90, opacity: 0.18 },
  });
  const d = Math.min(0.6, h * 0.6), iy = y + (h - d) / 2;
  slide.addImage({ data: ICON[name], x: x + 0.34, y: iy, w: d, h: d });
  slide.addText(runs, {
    x: x + 0.34 + d + 0.28, y: y + 0.08, w: w - (0.34 + d + 0.28) - 0.3, h: h - 0.16,
    fontFace: F, fontSize: o.fs || 14, color: "FFFFFF", align: "left", valign: "middle", margin: 0,
  });
}
function content(opts) { // standard light content slide scaffold
  const s = pres.addSlide();
  s.background = { color: C.white };
  kicker(s, opts.kicker);
  title(s, opts.title);
  corner(s);
  pager(s, opts.n);
  return s;
}

// =================================================================
function buildDeck() {
  pres = new pptxgen();
  pres.defineLayout({ name: "SBER", width: W, height: H });
  pres.layout = "SBER";
  pres.author = "ТПСО";
  pres.title = "Сбер — стейкхолдеры, коммуникационные проблемы и PR-решения";

  // ---------- SLIDE 1 — Title ----------
  (() => {
    const s = pres.addSlide();
    s.background = { path: A("bg_dark.png") };
    s.addImage({ path: A("sber_mark.png"), x: 8.55, y: 1.62, w: 4.1, h: 4.1 });
    s.addText("ТЕОРИЯ И ПРАКТИКА СВЯЗЕЙ С ОБЩЕСТВЕННОСТЬЮ", {
      x: 0.85, y: 1.05, w: 8.5, h: 0.4, fontFace: FB, bold: true, fontSize: 13,
      color: C.green, charSpacing: 3, margin: 0,
    });
    s.addText("Сбер", {
      x: 0.8, y: 1.5, w: 8, h: 1.7, fontFace: FB, bold: true, fontSize: 96,
      color: C.white, margin: 0, valign: "middle",
    });
    s.addText("Стейкхолдеры, коммуникационные проблемы и PR-решения", {
      x: 0.85, y: 3.35, w: 7.4, h: 1.0, fontFace: F, fontSize: 23,
      color: "E7F2EB", margin: 0, valign: "top", lineSpacingMultiple: 1.05,
    });
    s.addShape(sh().ROUNDED_RECTANGLE, { x: 0.85, y: 4.78, w: 2.78, h: 0.52, rectRadius: 0.26, fill: { color: C.green }, line: { type: "none" } });
    s.addText("Семестровый проект", { x: 0.85, y: 4.78, w: 2.78, h: 0.52, fontFace: FB, bold: true, fontSize: 13.5, color: C.white, align: "center", valign: "middle", margin: 0 });
    s.addText([
      { text: "[ Ваше имя ]", options: { color: C.white, bold: true } },
      { text: "   ·   [ факультет, группа ]   ·   2026", options: { color: C.dkMuted } },
    ], { x: 0.85, y: 6.55, w: 9, h: 0.4, fontFace: F, fontSize: 15, margin: 0, valign: "middle" });
  })();

  // ---------- SLIDE 2 — Сбер сегодня ----------
  (() => {
    const s = content({ kicker: "Контекст", title: "Сбер сегодня", n: 2 });
    const LX = MX, LW = 7.05, tx = LX + 0.74;
    const rows = [
      ["university", "Больше, чем банк", "Крупнейший банк страны и финансово-технологическая группа, а не просто банк."],
      ["brain", "Искусственный интеллект в основе", "Опора новой идентичности — ИИ и собственная модель GigaChat."],
      ["cubes", "Экосистема сервисов", "Финансы, торговля, доставка, здоровье, развлечения, облако, устройства. Цель — около 30% дохода от небанковских сервисов."],
      ["globe", "Под санкциями с 2022 года", "Фокус сместился на внутренний рынок и дружественные страны."],
    ];
    let y = 1.78; const rh = 0.96;
    rows.forEach(([ic, head, desc]) => {
      iconCircle(s, LX, y + 0.04, 0.56, ic);
      s.addText([
        { text: head + "\n", options: { bold: true, color: C.ink, fontSize: 15 } },
        { text: desc, options: { color: C.body, fontSize: 12.5 } },
      ], { x: tx, y: y - 0.02, w: LW - 0.74, h: rh, fontFace: F, align: "left", valign: "top", margin: 0, lineSpacingMultiple: 1.02 });
      y += rh;
    });
    // right stat cards
    const RX = 7.95, RW = W - MX - RX;
    const stat = (yy, big, lab, ic) => {
      card(s, RX, yy, RW, 1.62, { fill: C.cardTint });
      iconCircle(s, RX + RW - 0.86, yy + 0.26, 0.56, ic);
      s.addText(big, { x: RX + 0.3, y: yy + 0.22, w: RW - 1.0, h: 0.7, fontFace: FB, bold: true, fontSize: 42, color: C.green, margin: 0, valign: "middle" });
      s.addText(lab, { x: RX + 0.3, y: yy + 0.95, w: RW - 0.5, h: 0.5, fontFace: F, fontSize: 13.5, color: C.body, margin: 0, valign: "top" });
    };
    stat(1.78, "111 млн", "активных клиентов", "users");
    stat(3.55, "≈ 3,5 млн", "компаний-клиентов", "building");
    // key thought band
    band(s, MX, 5.72, CW, 1.14, "bulb",
      [{ text: "Ключевая мысль:  ", options: { bold: true } },
       { text: "«Сберкасса» осталась в прошлом — сейчас это технологическая платформа. Но восприятие за этим сдвигом не поспевает." }],
      { fs: 14.5 });
  })();

  // ---------- SLIDE 3 — Стейкхолдеры ≠ ЦА ----------
  (() => {
    const s = content({ kicker: "Стейкхолдеры", title: "Стейкхолдеры — это не целевая аудитория", n: 3 });
    s.addText("Различение понятий", { x: MX, y: 1.6, w: 6, h: 0.3, fontFace: FB, bold: true, fontSize: 13, color: C.greenDk, margin: 0 });
    const cw2 = (CW - 0.3) / 2;
    const concept = (x, head, desc) => {
      card(s, x, 1.96, cw2, 1.28, { fill: C.card });
      s.addText(head, { x: x + 0.28, y: 2.1, w: cw2 - 0.5, h: 0.4, fontFace: FB, bold: true, fontSize: 16, color: C.ink, margin: 0 });
      s.addText(desc, { x: x + 0.28, y: 2.52, w: cw2 - 0.5, h: 0.66, fontFace: F, fontSize: 12.5, color: C.body, margin: 0, valign: "top", lineSpacingMultiple: 1.02 });
    };
    concept(MX, "Стейкхолдер", "Тот, кто влияет на компанию или зависит от неё. Критерий — интерес или влияние, а не факт покупки.");
    concept(MX + cw2 + 0.3, "Целевая аудитория", "Адресат конкретного сообщения или кампании.");
    s.addText([
      { text: "Примечание:  ", options: { bold: true, color: C.greenDk } },
      { text: "клиент бывает и тем и другим; регулятор — стейкхолдер, но не ЦА рекламы.", options: { color: C.body } },
    ], { x: MX, y: 3.34, w: CW, h: 0.36, fontFace: F, fontSize: 12, italic: true, margin: 0, valign: "middle" });

    s.addText("Карта стейкхолдеров Сбера", { x: MX, y: 3.86, w: 8, h: 0.32, fontFace: FB, bold: true, fontSize: 13, color: C.greenDk, margin: 0 });
    const map = [
      ["landmark", "Государство и регуляторы", "Банк России, государство-акционер, законодатели"],
      ["chartline", "Инвесторы", "миноритарии, институциональные держатели"],
      ["users", "Клиенты", "розница, малый и средний бизнес, корпорации"],
      ["usertie", "Сотрудники и кадры", "персонал, менеджмент, кандидаты, вузы"],
      ["handshake", "Партнёры", "компании экосистемы, поставщики, технологические партнёры"],
      ["globe2", "Общество и медиа", "регионы, НКО, профессиональное сообщество, СМИ"],
    ];
    const gx0 = MX, gy0 = 4.26, gw = (CW - 2 * 0.3) / 3, gh = 1.2, gapx = 0.3, gapy = 0.26;
    map.forEach((m, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = gx0 + col * (gw + gapx), y = gy0 + row * (gh + gapy);
      card(s, x, y, gw, gh, { fill: C.card });
      iconCircle(s, x + 0.22, y + 0.22, 0.5, m[0]);
      s.addText(m[1], { x: x + 0.84, y: y + 0.18, w: gw - 1.0, h: 0.5, fontFace: FB, bold: true, fontSize: 12.5, color: C.ink, margin: 0, valign: "middle" });
      s.addText(m[2], { x: x + 0.24, y: y + 0.66, w: gw - 0.46, h: 0.46, fontFace: F, fontSize: 10.5, color: C.body, margin: 0, valign: "top", lineSpacingMultiple: 0.98 });
    });
  })();

  // ---------- SLIDE 4 — Чего ждут ключевые группы ----------
  (() => {
    const s = content({ kicker: "Стейкхолдеры", title: "Чего ждут ключевые группы", n: 4 });
    const rows = [
      ["landmark", "Регулятор и государство", "Устойчивость, соблюдение норм, вклад в экономику и технологический суверенитет."],
      ["chartline", "Инвесторы", "Прозрачность, предсказуемость, рост стоимости."],
      ["users", "Клиенты", "Сохранность денег и данных, надёжность, удобство, понятная выгода."],
      ["usertie", "Сотрудники и кандидаты", "Интересные задачи, развитие, репутация работодателя."],
      ["globe2", "Общество", "Безопасность, доступность услуг, ответственность бизнеса."],
    ];
    let y = 1.72; const rh = 0.72, gap = 0.12;
    rows.forEach(([ic, head, desc]) => {
      card(s, MX, y, CW, rh, { fill: C.card });
      iconCircle(s, MX + 0.16, y + (rh - 0.5) / 2, 0.5, ic);
      s.addText(head, { x: MX + 0.82, y, w: 3.5, h: rh, fontFace: FB, bold: true, fontSize: 13.5, color: C.greenDk, margin: 0, valign: "middle" });
      s.addText(desc, { x: MX + 4.45, y, w: CW - 4.45 - 0.3, h: rh, fontFace: F, fontSize: 13, color: C.body, margin: 0, valign: "middle", lineSpacingMultiple: 0.98 });
      y += rh + gap;
    });
    band(s, MX, 5.92, CW, 0.98, "arrow",
      [{ text: "Вывод:  ", options: { bold: true } },
       { text: "интересы расходятся — например, быстрое внедрение ИИ против тревоги за данные. На этих стыках и возникают коммуникационные проблемы." }],
      { fs: 13.5 });
  })();

  // ---------- SLIDE 5 — Три коммуникационные проблемы ----------
  (() => {
    const s = content({ kicker: "Проблемы", title: "Три коммуникационные проблемы", n: 5 });
    const items = [
      ["1", "eye", "Разрыв в восприятии", "«Привычный госбанк» против образа технологического лидера."],
      ["2", "shield", "Доверие и безопасность", "Мошенничество и настороженность к данным и ИИ бьют по доверию."],
      ["3", "scale", "«Госбанк на господдержке»", "Мнение, что успех держится на госстатусе, а не на эффективности."],
    ];
    const cw = (CW - 2 * 0.4) / 3, gap = 0.4; let x = MX;
    const cy = 1.92, ch = 4.45;
    items.forEach(([num, ic, head, desc]) => {
      card(s, x, cy, cw, ch, { fill: C.card });
      s.addText(num, { x: x + 0.3, y: cy + 0.22, w: 1.5, h: 1.1, fontFace: FB, bold: true, fontSize: 60, color: "CFE8D6", margin: 0, valign: "top" });
      iconCircle(s, x + cw - 1.0, cy + 0.42, 0.66, ic);
      s.addText(head, { x: x + 0.32, y: cy + 1.66, w: cw - 0.6, h: 1.1, fontFace: FB, bold: true, fontSize: 19, color: C.ink, margin: 0, valign: "top", lineSpacingMultiple: 1.0 });
      s.addText(desc, { x: x + 0.32, y: cy + 2.66, w: cw - 0.6, h: 1.5, fontFace: F, fontSize: 14, color: C.body, margin: 0, valign: "top", lineSpacingMultiple: 1.05 });
      x += cw + gap;
    });
  })();

  // ---------- SLIDE 6 — Проблемы 1 и 2 ----------
  (() => {
    const s = content({ kicker: "Проблемы · детально", title: "Разрыв в восприятии и доверие", n: 6 });
    const cw = (CW - 0.4) / 2, cy = 1.7, ch = 5.18;
    const colP = [
      { x: MX, num: "01", ic: "eye", head: "Разрыв в восприятии",
        bl: ["Сбер вкладывается в ИИ, но в массовом сознании остаётся «Сбербанком» — банком по привычке.", "Реальная идентичность опережает репутацию."],
        who: "общество, IT-сообщество, инвесторы, кандидаты", risk: "вложения в технологии не превращаются в образ лидера." },
      { x: MX + cw + 0.4, num: "02", ic: "shield", head: "Доверие и безопасность",
        bl: ["Телефонное мошенничество растёт; потеряв деньги, человек нередко винит банк.", "Рядом — тревога вокруг обработки данных и ИИ."],
        who: "розничные клиенты, регулятор, общество", risk: "подрывается главный актив банка — доверие." },
    ];
    colP.forEach((p) => {
      card(s, p.x, cy, cw, ch, { fill: C.card });
      iconCircle(s, p.x + 0.32, cy + 0.34, 0.7, p.ic);
      s.addText(`Проблема ${p.num === "01" ? "1" : "2"}`, { x: p.x + 1.2, y: cy + 0.34, w: cw - 1.4, h: 0.3, fontFace: FB, bold: true, fontSize: 11.5, color: C.green, charSpacing: 1.5, margin: 0 });
      s.addText(p.head, { x: p.x + 1.2, y: cy + 0.62, w: cw - 1.4, h: 0.5, fontFace: FB, bold: true, fontSize: 18, color: C.ink, margin: 0, valign: "middle" });
      s.addText(p.bl.map((t) => ({ text: t, options: { bullet: { indent: 14 }, breakLine: true, paraSpaceAfter: 6 } })),
        { x: p.x + 0.34, y: cy + 1.42, w: cw - 0.66, h: 1.9, fontFace: F, fontSize: 13, color: C.body, margin: 0, valign: "top", lineSpacingMultiple: 1.0 });
      // кого касается
      s.addText([{ text: "Кого касается:  ", options: { bold: true, color: C.greenDk } }, { text: p.who, options: { color: C.body } }],
        { x: p.x + 0.34, y: cy + 3.4, w: cw - 0.66, h: 0.7, fontFace: F, fontSize: 12.5, margin: 0, valign: "top" });
      // риск box
      card(s, p.x + 0.34, cy + 4.12, cw - 0.68, 0.84, { fill: C.amberBg, noShadow: true });
      s.addText([{ text: "Риск:  ", options: { bold: true, color: C.amber } }, { text: p.risk, options: { color: "6B4A12" } }],
        { x: p.x + 0.56, y: cy + 4.18, w: cw - 1.1, h: 0.72, fontFace: F, fontSize: 12.5, margin: 0, valign: "middle" });
    });
  })();

  // ---------- SLIDE 7 — Проблема 3 и решение ----------
  (() => {
    const s = content({ kicker: "Проблема 3 → решение", title: "«Госбанк на господдержке» — и ответ на него", n: 7 });
    const cy = 1.68, ch = 5.2;
    // left problem card
    const LX = MX, LW = 4.35;
    card(s, LX, cy, LW, ch, { fill: C.amberBg, noShadow: true });
    iconCircle(s, LX + 0.3, cy + 0.32, 0.66, "scale", { bg: C.amber });
    s.addText("ПРОБЛЕМА 3", { x: LX + 1.12, y: cy + 0.34, w: LW - 1.3, h: 0.3, fontFace: FB, bold: true, fontSize: 11.5, color: C.amber, charSpacing: 1.5, margin: 0 });
    s.addText("«Госбанк на господдержке»", { x: LX + 1.12, y: cy + 0.62, w: LW - 1.3, h: 0.6, fontFace: FB, bold: true, fontSize: 16, color: C.ink, margin: 0, valign: "top", lineSpacingMultiple: 0.95 });
    s.addText("Мнение: Сбер силён не своей эффективностью, а госстатусом — дешёвым фондированием, системной поддержкой, близостью к власти.",
      { x: LX + 0.32, y: cy + 1.5, w: LW - 0.64, h: 1.6, fontFace: F, fontSize: 13, color: "5A4A2A", margin: 0, valign: "top", lineSpacingMultiple: 1.05 });
    s.addText([{ text: "Кого касается:  ", options: { bold: true, color: C.amber } }, { text: "общество, деловое и экспертное сообщество, инвесторы.", options: { color: "5A4A2A" } }],
      { x: LX + 0.32, y: cy + 3.25, w: LW - 0.64, h: 0.9, fontFace: F, fontSize: 12.5, margin: 0, valign: "top" });
    s.addText([{ text: "Риск:  ", options: { bold: true, color: C.amber } }, { text: "достижения банка обесцениваются как «нерыночные».", options: { color: "5A4A2A" } }],
      { x: LX + 0.32, y: cy + 4.3, w: LW - 0.64, h: 0.8, fontFace: F, fontSize: 12.5, margin: 0, valign: "top" });

    // right solution
    const RX = MX + LW + 0.4, RW = W - MX - RX;
    s.addText([{ text: "Решение: ", options: { bold: true, color: C.greenDk } }, { text: "показать обратный поток ценности", options: { bold: true, color: C.ink } }],
      { x: RX, y: cy, w: RW, h: 0.4, fontFace: FB, fontSize: 16, margin: 0, valign: "middle" });
    // two stat cards
    const sw = (RW - 0.3) / 2;
    const stat = (x, big, lab) => {
      card(s, x, cy + 0.5, sw, 1.15, { fill: C.cardTint });
      s.addText(big, { x: x + 0.26, y: cy + 0.56, w: sw - 0.5, h: 0.62, fontFace: FB, bold: true, fontSize: 30, color: C.green, margin: 0, valign: "middle" });
      s.addText(lab, { x: x + 0.26, y: cy + 1.14, w: sw - 0.5, h: 0.46, fontFace: F, fontSize: 11.5, color: C.body, margin: 0, valign: "top", lineSpacingMultiple: 0.95 });
    };
    stat(RX, "1,3 трлн ₽", "вклад группы Сбер в бюджет за 2025 год");
    stat(RX + sw + 0.3, "543 млрд ₽", "из них налог на прибыль");
    // market success
    s.addText("Рыночный успех, а не только статус:", { x: RX, y: cy + 1.82, w: RW, h: 0.3, fontFace: FB, bold: true, fontSize: 12.5, color: C.ink, margin: 0 });
    s.addText(["самая дорогая компания на бирже", "лидер по внедрению ИИ в России", "одно из лучших соотношений расходов к доходам"]
      .map((t) => ({ text: t, options: { bullet: { indent: 12 }, breakLine: true, paraSpaceAfter: 2 } })),
      { x: RX + 0.05, y: cy + 2.14, w: RW - 0.1, h: 1.0, fontFace: F, fontSize: 12, color: C.body, margin: 0, valign: "top" });
    // main message band
    band(s, RX, cy + 3.2, RW, 0.72, "check",
      [{ text: "Главное: ", options: { bold: true } }, { text: "не государство содержит Сбер — Сбер наполняет бюджет." }], { fs: 13.5 });
    // tools
    s.addText([{ text: "Инструменты:  ", options: { bold: true, color: C.greenDk } },
      { text: "годовой отчёт и раскрытие по МСФО, деловые СМИ, выступления топ-менеджмента, инфографика о вкладе в экономику, IR / GR.", options: { color: C.body } }],
      { x: RX, y: cy + 4.08, w: RW, h: 1.1, fontFace: F, fontSize: 12, margin: 0, valign: "top", lineSpacingMultiple: 1.02 });
  })();

  // ---------- SLIDE 8 — Инструменты под каждую проблему ----------
  (() => {
    const s = content({ kicker: "Инструменты", title: "Инструменты под каждую проблему", n: 8 });
    const cols = [
      ["bullhorn", "Восприятие", ["экспертные публикации и выступления", "профильные СМИ", "конференция AI Journey", "узнаваемые спикеры"]],
      ["shield", "Доверие", ["просвещение по финансовой и цифровой грамотности", "протоколы реагирования на инциденты", "открытый разговор о защите данных", "партнёрство с государством и НКО"]],
      ["invoice", "«Госбанк на господдержке»", ["факты о вкладе в бюджет", "годовой отчёт и МСФО", "деловые СМИ", "инфографика об экономическом вкладе", "IR / GR"]],
    ];
    const cw = (CW - 2 * 0.36) / 3, gap = 0.36, cy = 1.8, ch = 5.05; let x = MX;
    cols.forEach(([ic, head, items]) => {
      card(s, x, cy, cw, ch, { fill: C.card });
      iconCircle(s, x + 0.3, cy + 0.32, 0.62, ic);
      s.addText(head, { x: x + 1.05, y: cy + 0.3, w: cw - 1.25, h: 0.66, fontFace: FB, bold: true, fontSize: 15.5, color: C.ink, margin: 0, valign: "middle", lineSpacingMultiple: 0.92 });
      s.addText(items.map((t) => ({ text: t, options: { bullet: { indent: 13 }, breakLine: true, paraSpaceAfter: 9 } })),
        { x: x + 0.34, y: cy + 1.18, w: cw - 0.64, h: ch - 1.4, fontFace: F, fontSize: 13, color: C.body, margin: 0, valign: "top", lineSpacingMultiple: 1.0 });
      x += cw + gap;
    });
  })();

  // ---------- SLIDE 9 — AI Journey ----------
  (() => {
    const s = content({ kicker: "Флагман 1", title: "Конференция AI Journey", n: 9 });
    const cells = [
      ["calendar", "Формат", "Ежегодная международная конференция по ИИ — научный, деловой и образовательный треки, открытая онлайн-трансляция, конкурсы для разработчиков и исследователей."],
      ["robot", "Роль площадки", "На AI Journey Сбер представляет новые версии GigaChat — событие работает как витрина технологий."],
      ["users", "На кого", "Разработчики и учёные, IT-сообщество, медиа, частично государство и инвесторы."],
      ["target", "Зачем", "Закрепить образ технологического лидера, показать зрелость GigaChat и научной школы, повысить доверие к российскому ИИ."],
    ];
    const cw = (CW - 0.36) / 2, gap = 0.36, ch = 1.72, gy = 0.3, y0 = 1.72;
    cells.forEach((c, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = MX + col * (cw + gap), y = y0 + row * (ch + gy);
      card(s, x, y, cw, ch, { fill: C.card });
      iconCircle(s, x + 0.3, y + 0.28, 0.56, c[0]);
      s.addText(c[1].toUpperCase(), { x: x + 1.0, y: y + 0.3, w: cw - 1.2, h: 0.5, fontFace: FB, bold: true, fontSize: 13, color: C.greenDk, charSpacing: 1.5, margin: 0, valign: "middle" });
      s.addText(c[2], { x: x + 0.32, y: y + 0.86, w: cw - 0.62, h: ch - 0.98, fontFace: F, fontSize: 12.5, color: C.body, margin: 0, valign: "top", lineSpacingMultiple: 1.02 });
    });
    band(s, MX, 5.96, CW, 0.92, "flag",
      [{ text: "Закрывает: ", options: { bold: true } },
       { text: "проблему №1 (восприятие), отчасти №2 (доверие к ИИ); показывает, что Сбер конкурирует на технологиях." }], { fs: 13.5 });
  })();

  // ---------- SLIDE 10 — СберУниверситет ----------
  (() => {
    const s = content({ kicker: "Флагман 2", title: "СберУниверситет", n: 10 });
    const cw = (CW - 0.36) / 2;
    const cardTop = (x, ic, head, txt) => {
      card(s, x, 1.7, cw, 1.18, { fill: C.card });
      iconCircle(s, x + 0.28, 1.92, 0.54, ic);
      s.addText(head.toUpperCase(), { x: x + 0.96, y: 1.84, w: cw - 1.16, h: 0.3, fontFace: FB, bold: true, fontSize: 12, color: C.greenDk, charSpacing: 1.2, margin: 0 });
      s.addText(txt, { x: x + 0.96, y: 2.12, w: cw - 1.16, h: 0.66, fontFace: F, fontSize: 12, color: C.body, margin: 0, valign: "top", lineSpacingMultiple: 1.0 });
    };
    cardTop(MX, "grad", "Формат", "Корпоративный университет с кампусом в Истре — программы для сотрудников и руководителей плюс открытые форматы.");
    cardTop(MX + cw + 0.36, "calendar", "Публичное событие", "Ежегодная конференция «Больше чем обучение».");
    // stats row
    const sw = (CW - 2 * 0.3) / 3, sy = 3.06, sh2 = 1.18;
    const stat = (x, big, lab, ic) => {
      card(s, x, sy, sw, sh2, { fill: C.cardTint });
      iconCircle(s, x + sw - 0.74, sy + 0.2, 0.5, ic);
      s.addText(big, { x: x + 0.26, y: sy + 0.16, w: sw - 0.9, h: 0.62, fontFace: FB, bold: true, fontSize: 30, color: C.green, margin: 0, valign: "middle" });
      s.addText(lab, { x: x + 0.26, y: sy + 0.74, w: sw - 0.5, h: 0.4, fontFace: F, fontSize: 11.5, color: C.body, margin: 0, valign: "top", lineSpacingMultiple: 0.95 });
    };
    stat(MX, "≈ 10 000", "участников очно и онлайн", "users");
    stat(MX + sw + 0.3, "4 млн+", "просмотров трансляции", "tower");
    stat(MX + 2 * (sw + 0.3), "50+", "спикеров", "comments");
    // bottom two cards
    const by = 4.42, bh = 1.34;
    const cardBot = (x, ic, head, txt) => {
      card(s, x, by, cw, bh, { fill: C.card });
      iconCircle(s, x + 0.28, by + 0.26, 0.54, ic);
      s.addText(head.toUpperCase(), { x: x + 0.96, y: by + 0.2, w: cw - 1.16, h: 0.3, fontFace: FB, bold: true, fontSize: 12, color: C.greenDk, charSpacing: 1.2, margin: 0 });
      s.addText(txt, { x: x + 0.96, y: by + 0.5, w: cw - 1.16, h: bh - 0.6, fontFace: F, fontSize: 12, color: C.body, margin: 0, valign: "top", lineSpacingMultiple: 1.0 });
    };
    cardBot(MX, "users", "На кого", "Внутри — сотрудники и менеджмент; снаружи — кандидаты, студенты и вузы, профессиональное сообщество, медиа.");
    cardBot(MX + cw + 0.36, "target", "Зачем", "Усилить репутацию работодателя, показать экспертизу в образовании и управлении.");
    band(s, MX, 5.94, CW, 0.94, "flag",
      [{ text: "Закрывает: ", options: { bold: true } }, { text: "проблему №1 — образ современной, развивающей организации." }], { fs: 13.5 });
  })();

  // ---------- SLIDE 11 — Как измерять результат (dark) ----------
  (() => {
    const s = pres.addSlide();
    s.background = { path: A("bg_dark.png") };
    s.addText("ИЗМЕРЕНИЕ", { x: MX, y: 0.46, w: 6, h: 0.3, fontFace: FB, bold: true, fontSize: 12.5, color: C.green, charSpacing: 3, margin: 0, valign: "middle" });
    s.addText("Как измерять результат", { x: MX, y: 0.78, w: CW - 1, h: 0.78, fontFace: FB, bold: true, fontSize: 31, color: C.white, margin: 0, valign: "top" });
    s.addImage({ path: A("sber_mark.png"), x: W - MX - 0.62, y: 0.5, w: 0.62, h: 0.62 });
    const cells = [
      ["news", "Медиа", "Число и тональность упоминаний; доля «технологического» сюжета в публикациях."],
      ["poll", "Доверие", "Опросы восприятия (банк против техкомпании); динамика темы безопасности."],
      ["scale", "Легитимность", "Доля публикаций, где Сбер показан как вкладчик в бюджет и рыночный игрок."],
      ["tower", "Охваты", "Аудитория ключевых событий — AI Journey и «Больше чем обучение»."],
    ];
    const cw = (CW - 0.4) / 2, gap = 0.4, ch = 2.12, gy = 0.34, y0 = 1.95;
    cells.forEach((c, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = MX + col * (cw + gap), y = y0 + row * (ch + gy);
      s.addShape(sh().ROUNDED_RECTANGLE, { x, y, w: cw, h: ch, rectRadius: 0.08, fill: { color: C.dkCard }, line: { color: C.dkCardLine, width: 1 } });
      iconCircle(s, x + 0.34, y + 0.36, 0.72, c[0]);
      s.addText(c[1], { x: x + 1.3, y: y + 0.42, w: cw - 1.6, h: 0.6, fontFace: FB, bold: true, fontSize: 19, color: C.white, margin: 0, valign: "middle" });
      s.addText(c[2], { x: x + 0.36, y: y + 1.2, w: cw - 0.7, h: ch - 1.4, fontFace: F, fontSize: 14, color: C.dkMuted, margin: 0, valign: "top", lineSpacingMultiple: 1.06 });
    });
    pager(s, 11, true);
  })();

  return pres.writeFile({ fileName: "Сбер_ТПСО_презентация.pptx" });
}

(async () => {
  await buildIcons();
  await buildDeck();
  console.log("OK: Сбер_ТПСО_презентация.pptx");
})();
