// Local Color Lab - app.js (full replace)

// ---------- Utils ----------
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const pad2 = (n) => n.toString(16).padStart(2, "0");

function toast(msg){
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => t.classList.remove("show"), 900);
}

function shuffle(arr){
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalizeHex(s){
  if (!s) return null;
  s = String(s).trim();
  if (!s) return null;
  if (s[0] !== "#") s = "#" + s;

  if (/^#([0-9a-fA-F]{3})$/.test(s)){
    const m = s.slice(1);
    s = "#" + m.split("").map(ch => ch + ch).join("");
  }
  if (!/^#([0-9a-fA-F]{6})$/.test(s)) return null;
  return "#" + s.slice(1).toUpperCase();
}

function hexToRgb(hex){
  const h = normalizeHex(hex);
  if (!h) return null;
  const x = h.slice(1);
  return {
    r: parseInt(x.slice(0,2), 16),
    g: parseInt(x.slice(2,4), 16),
    b: parseInt(x.slice(4,6), 16),
  };
}

function rgbToHex(r,g,b){
  return ("#" + pad2(r) + pad2(g) + pad2(b)).toUpperCase();
}

function rgbToCmyk(r,g,b){
  const rr=r/255, gg=g/255, bb=b/255;
  const k = 1 - Math.max(rr,gg,bb);
  if (k >= 0.999999) return { c:0, m:0, y:0, k:100 };
  const c = (1 - rr - k) / (1 - k);
  const m = (1 - gg - k) / (1 - k);
  const y = (1 - bb - k) / (1 - k);
  return {
    c: Math.round(clamp(c*100,0,100)),
    m: Math.round(clamp(m*100,0,100)),
    y: Math.round(clamp(y*100,0,100)),
    k: Math.round(clamp(k*100,0,100)),
  };
}

function rgbToHsl(r,g,b){
  r/=255; g/=255; b/=255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b);
  let h=0, s=0;
  const l=(max+min)/2;
  const d=max-min;
  if (d !== 0){
    s = d / (1 - Math.abs(2*l - 1));
    switch(max){
      case r: h = ((g-b)/d) % 6; break;
      case g: h = (b-r)/d + 2; break;
      case b: h = (r-g)/d + 4; break;
    }
    h = Math.round(h*60);
    if (h < 0) h += 360;
  }
  return { h, s: Math.round(s*100), l: Math.round(l*100) };
}

function rgbToHsv(r,g,b){
  r/=255; g/=255; b/=255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b);
  const d=max-min;
  let h=0;
  const v=max;
  const s = max === 0 ? 0 : d/max;
  if (d !== 0){
    switch(max){
      case r: h = ((g-b)/d) % 6; break;
      case g: h = (b-r)/d + 2; break;
      case b: h = (r-g)/d + 4; break;
    }
    h = Math.round(h*60);
    if (h < 0) h += 360;
  }
  return { h, s: Math.round(s*100), v: Math.round(v*100) };
}

function complementHex(hex){
  const rgb = hexToRgb(hex);
  if (!rgb) return "#000000";
  return rgbToHex(255-rgb.r, 255-rgb.g, 255-rgb.b);
}

async function copyText(text){
  try{
    await navigator.clipboard.writeText(text);
    toast("コピーしました");
  }catch{
    const ta=document.createElement("textarea");
    ta.value=text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    toast("コピーしました");
  }
}

function comboToCode(colors){
  return colors.map(normalizeHex).filter(Boolean).slice(0,MAX_COMBO_COLORS).join(",");
}
function codeToCombo(code){
  return String(code || "")
    .split(",")
    .map(x => normalizeHex(x))
    .filter(Boolean)
    .slice(0,MAX_COMBO_COLORS);
}

// ---------- Theme (base themes + custom palette overlay) ----------
const THEME_KEY = "localColorLab.theme";
const THEME_SLOT_DEFAULTS = { light: "#FDFDFF", gray: "#EEF0F3", dark: "#0B0F17" };
const CUSTOM_PALETTE_KEY = "localColorLab.theme_custom_palette";
const CUSTOM_SAVES_KEY = "localColorLab.customSaves.v1";
const MAX_COMBO_COLORS = 8;
const MAX_SAVED_ITEMS = 8;

// 透過/置き換え無しトークン: x〜xxxxxxxx (1〜8)
const REF_TOKEN_RE = /^x{1,8}$/i;
const REF_TOKEN_DISPLAY = "xxxxxxxx";

function isRefToken(token){
  if (token == null) return false;
  return REF_TOKEN_RE.test(String(token).trim());
}

function getInitialTheme(){
  const saved = localStorage.getItem(THEME_KEY);
  return saved || "light";
}

function setTheme(theme){
  document.body.setAttribute("data-theme", theme);
  try{ localStorage.setItem(THEME_KEY, theme); }catch{}

  // active toggle
  document.querySelectorAll("[data-theme-btn]").forEach(btn=>{
    btn.classList.toggle("active", btn.getAttribute("data-theme-btn") === theme);
  });
}

// custom theme overlay keys (inline style vars)
const CUSTOM_KEYS = [
  "--bg","--bg2","--panel","--panel2","--text","--muted",
  "--btn","--btn2","--line","--stripBg","--topbarBg"
];

function clearPaletteTheme(){
  CUSTOM_KEYS.forEach(k => document.body.style.removeProperty(k));
}

function mix(hexA, hexB, t){
  // t=0 => A, t=1 => B
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  if (!a || !b) return normalizeHex(hexA) || normalizeHex(hexB) || "#000000";
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return rgbToHex(r, g, bl);
}

function applyPaletteTheme(palette){
  // palette: ["#xxxxxx", ...] (1〜8要素)
  const p = (palette || []).map(normalizeHex).filter(Boolean);

  // フォールバック（最低限落ちない）
  const c1 = p[0] ?? "#111827";               // header
  const c2 = p[1] ?? "#FFFFFF";               // bg
  const c3 = p[2] ?? (mix(c1, c2, 0.15));     // text
  const c4 = p[3] ?? (mix(c1, c2, 0.50));     // btn base
  const c5 = p[4] ?? c1;                      // card title bg
  const c6 = p[5] ?? (mix(c2, c3, 0.08));     // card bg
  const c7 = p[6] ?? mix(c4, c2, 0.30);       // highlight
  const c8 = p[7] ?? mix(c3, c2, 0.88);       // subtle line/stripe

  // 派生
  const line  = mix(c3, c8, 0.76);
  const muted = mix(c3, c2, 0.55);
  const btn2  = mix(c7, c3, 0.16);
  const strip = mix(c8, c2, 0.70);

  const root = document.body;

  root.style.setProperty("--bg", c2);
  root.style.setProperty("--bg2", mix(c2, c3, 0.04));

  root.style.setProperty("--panel", c6);
  root.style.setProperty("--panel2", c5);

  root.style.setProperty("--text", c3);
  root.style.setProperty("--muted", muted);

  root.style.setProperty("--btn", mix(c4, c2, 0.10));
  root.style.setProperty("--btn2", btn2);

  root.style.setProperty("--line", line);
  root.style.setProperty("--stripBg", strip);

  root.style.setProperty("--topbarBg", c1);
}

function getCurrentPaletteForTheme(){
  // A) comboを最優先
  if (Array.isArray(combo) && combo.length){
    return combo.slice(0, MAX_COMBO_COLORS);
  }

  // B) 現在のスウォッチ + 補色
  const hex  = normalizeHex(hexInput?.value) || "#4F46E5";
  const comp = normalizeHex(compHexEl?.textContent);
  const base = [hex];
  if (comp) base.push(comp);
  return base;
}

function saveCustomPalette(palette){
  try{ localStorage.setItem(CUSTOM_PALETTE_KEY, JSON.stringify(palette)); }catch{}
}

function loadCustomPalette(){
  try{
    const raw = localStorage.getItem(CUSTOM_PALETTE_KEY);
    if (!raw) return null;
    const pal = JSON.parse(raw);
    if (!Array.isArray(pal)) return null;
    return pal.map(normalizeHex).filter(Boolean).slice(0, MAX_COMBO_COLORS);
  }catch{
    return null;
  }
}

function getThemeDefaultHex(){
  const t = document.body.getAttribute("data-theme");
  if (t === "light" || t === "gray" || t === "dark") return THEME_SLOT_DEFAULTS[t];
  const cssBg = normalizeHex(getComputedStyle(document.body).getPropertyValue("--bg"));
  return cssBg || THEME_SLOT_DEFAULTS.light;
}

function normalizeCustomTokens(input){
  const raw = String(input || "").split(",").map(x=>x.trim()).filter(Boolean).slice(0,MAX_COMBO_COLORS);
  const out = [];
  raw.forEach((part)=>{
    if (isRefToken(part)){
      // 表示は入力どおりでもいいが、統一のため小文字に寄せる
      out.push(String(part).toLowerCase());
    }else{
      const hex = normalizeHex(part);
      if (hex) out.push(hex);
    }
  });
  return out;
}

function normalizePlainText(input){
  const text = String(input ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.slice(0, 200);
}

function loadCustomSaves(){
  try{
    const raw = localStorage.getItem(CUSTOM_SAVES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x)=>{
        const tokens = normalizeCustomTokens(Array.isArray(x?.tokens) ? x.tokens.join(",") : x);
        const note = normalizePlainText(x?.note);
        return { tokens, note };
      })
      .filter(item => item.tokens.length > 0);
  }catch{
    return [];
  }
}

function saveCustomSaves(arr){
  try{
    localStorage.setItem(CUSTOM_SAVES_KEY, JSON.stringify(arr));
  }catch{}
}

function customTokensToCode(tokens){
  return (tokens || []).join(",");
}

function resolveCustomTokens(tokens){
  // comboが空でも落ちないように安全化
  const base = Array.isArray(combo) ? combo.slice(0, MAX_COMBO_COLORS) : [];
  const fallback = getThemeDefaultHex();

  const maxLen = Math.min(MAX_COMBO_COLORS, Math.max(base.length, (tokens || []).length));
  const resolved = [];

  for (let i=0; i<maxLen; i++){
    const token = (tokens || [])[i];

    if (typeof token === "undefined"){
      if (base[i]) resolved.push(base[i]);
      continue;
    }

    if (isRefToken(token)){
      resolved.push(base[i] || fallback);
      continue;
    }

    resolved.push(token);
  }

  return resolved.slice(0,MAX_COMBO_COLORS);
}

// ---------- Data: presets ----------
let PRESETS = [];

async function loadPresets(){
  try{
    const res = await fetch("./presets.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("presets.json is not an array");

    PRESETS = data
      .filter(x => Array.isArray(x) && x.length >= 2)
      .map(([name, hex]) => [String(name), normalizeHex(hex)])
      .filter(([,hex]) => !!hex)
      .map(([name, hex]) => [name, hex]);

  }catch(e){
    PRESETS = [];
    console.warn("Failed to load presets.json:", e);
  }
}

// ---------- Data: sets from sets.json ----------
let PALETTE_SETS = [];
async function loadPaletteSets(){
  try{
    const res = await fetch("./sets.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("sets.json is not an array");
    PALETTE_SETS = data
      .filter(x => x && typeof x.title === "string" && Array.isArray(x.tags) && Array.isArray(x.colors))
      .map(x => ({
        title: x.title,
        tags: x.tags.map(String),
        colors: x.colors.map(String)
      }));
  }catch(e){
    PALETTE_SETS = [];
    console.warn("Failed to load sets.json:", e);
  }
}

// ---------- State ----------
let currentHex = "#4F46E5";
let combo = [];
let favorites = loadFavorites(); // v2
let customSaves = loadCustomSaves();
let setQuery = "";

// ---------- Elements ----------
const picker = document.getElementById("picker");
const hexInput = document.getElementById("hexInput");
const swatch = document.getElementById("swatch");
const outputsSlim = document.getElementById("outputsSlim");
const compSwatch = document.getElementById("compSwatch");
const compHexEl = document.getElementById("compHex");

const comboStrip = document.getElementById("comboStrip");
const comboGradient = document.getElementById("comboGradient");
const comboItems = document.getElementById("comboItems");
const comboComplements = document.getElementById("comboComplements");

const presetGrid = document.getElementById("presetGrid");
const presetSearch = document.getElementById("presetSearch");

const favoritesEl = document.getElementById("favorites");
const setSearch = document.getElementById("setSearch");
const setSearchBtn = document.getElementById("setSearchBtn");
const setShuffleBtn = document.getElementById("setShuffleBtn");
const setQuickTagBtns = Array.from(document.querySelectorAll("[data-set-tag]"));

const autoScrollTrack = document.getElementById("autoScrollTrack");
const leftScroll = document.querySelector(".side--left .side__scroll");

const importSetInput = document.getElementById("importSetInput");
const saveComboBtn = document.getElementById("saveComboBtn");
const importSetBtn = document.getElementById("importSetBtn");
const copyComboCodeBtn = document.getElementById("copyComboCodeBtn");
const comboInsertIndex = document.getElementById("comboInsertIndex");
const comboInsertBtn = document.getElementById("comboInsertBtn");
const customSaveInput = document.getElementById("customSaveInput");
const customSaveNoteInput = document.getElementById("customSaveNoteInput");
const customSaveAddBtn = document.getElementById("customSaveAddBtn");
const customSavesEl = document.getElementById("customSaves");

// ---------- Favorites persistence ----------
function loadFavorites(){
  try{
    const raw = localStorage.getItem("localColorLab.favorites.v2");
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map(item=>{
      if (item && item.type === "set" && Array.isArray(item.colors)){
        const colors = item.colors.map(normalizeHex).filter(Boolean).slice(0,MAX_COMBO_COLORS);
        const note = normalizePlainText(item.note);
        if (colors.length) return { type:"set", colors, note };
      }
      if (item && item.type === "color" && item.value){
        const v = normalizeHex(item.value);
        if (v) return { type:"color", value:v };
      }
      return null;
    }).filter(Boolean);
  }catch{
    try{
      const rawOld = localStorage.getItem("localColorLab.favorites");
      if (!rawOld) return [];
      const arrOld = JSON.parse(rawOld);
      if (!Array.isArray(arrOld)) return [];
      const migrated = arrOld.map(normalizeHex).filter(Boolean).map(v=>({type:"color", value:v}));
      localStorage.setItem("localColorLab.favorites.v2", JSON.stringify(migrated));
      return migrated;
    }catch{
      return [];
    }
  }
}

function saveFavorites(arr){
  try{
    localStorage.setItem("localColorLab.favorites.v2", JSON.stringify(arr));
  }catch{}
}

// ---------- Render: slim outputs ----------
function renderOutputsSlim(hex){
  if (!outputsSlim) return;

  const rgb = hexToRgb(hex);
  if (!rgb) return;

  const {r,g,b} = rgb;
  const cmyk = rgbToCmyk(r,g,b);
  const hsl = rgbToHsl(r,g,b);
  const hsv = rgbToHsv(r,g,b);

  const rows = [
    ["HEX", hex],
    ["RGB", `rgb(${r}, ${g}, ${b})`],
    ["CMYK", `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`],
    ["HSL", `hsl(${hsl.h}°, ${hsl.s}%, ${hsl.l}%)`],
    ["HSV", `hsv(${hsv.h}°, ${hsv.s}%, ${hsv.v}%)`],
  ];

  outputsSlim.innerHTML = "";
  rows.forEach(([k,v])=>{
    const row = document.createElement("div");
    row.className = "slimRow";
    row.innerHTML = `
      <div class="slimKey">${k}</div>
      <div class="slimVal">${v}</div>
      <button class="slimCopy" title="Copy">Copy</button>
    `;
    row.querySelector("button").addEventListener("click", ()=>copyText(v));
    outputsSlim.appendChild(row);
  });
}

// ---------- Set color ----------
function setColor(hex){
  const n = normalizeHex(hex);
  if (!n) return;
  currentHex = n;

  if (picker) picker.value = n;
  if (hexInput) hexInput.value = n;
  if (swatch) swatch.style.background = n;

  const c = complementHex(n);
  if (compSwatch) compSwatch.style.background = c;
  if (compHexEl) compHexEl.textContent = c;

  renderOutputsSlim(n);
}

// ---------- Render: presets ----------
function renderPresets(filter=""){
  if (!presetGrid) return [];

  const q = filter.trim().toLowerCase();
  presetGrid.innerHTML = "";

  const list = PRESETS.filter(([name, hex])=>{
    if (!q) return true;
    return name.toLowerCase().includes(q) || hex.toLowerCase().includes(q);
  });

  list.forEach(([name, hex])=>{
    const el = document.createElement("div");
    el.className = "preset";
    el.innerHTML = `
      <div class="preset__c" style="background:${hex}"></div>
      <div class="preset__t"><span>${name}</span><span>${hex.toUpperCase()}</span></div>
    `;
    el.addEventListener("click", ()=>setColor(hex));
    presetGrid.appendChild(el);
  });

  return list;
}

// ---------- Favorites UI ----------
function onTap(el, fn){
  el.addEventListener("pointerup", (e)=>{
    e.preventDefault();
    e.stopPropagation();
    fn();
  });
  el.addEventListener("click", (e)=>{
    e.preventDefault();
    e.stopPropagation();
    fn();
  });
}

function buildTokenPreview(tokens, resolvedTokens){
  const wrap = document.createElement("div");
  wrap.className = "tokenPreview";

  const resolved = Array.isArray(resolvedTokens) ? resolvedTokens : resolveCustomTokens(tokens);

  tokens.forEach((token, idx)=>{
    const dot = document.createElement("div");
    dot.className = "tokenDot";

    if (isRefToken(token)){
      dot.classList.add("tokenDot--ref");
      dot.title = String(token || REF_TOKEN_DISPLAY);
      // 透過枠をタップしたら、その枠が解決される色をUse
      onTap(dot, ()=>{
        const h = normalizeHex(resolved[idx]);
        if (h) setColor(h);
      });
    }else{
      dot.style.background = token;
      dot.title = token;
      onTap(dot, ()=> setColor(token));
    }

    wrap.appendChild(dot);
  });

  return wrap;
}

function arraysEqual(a, b){
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++){
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function buildSetMini(colors){
  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.gap = "6px";
  wrap.style.alignItems = "center";
  colors.forEach(c=>{
    const s = document.createElement("div");
    s.className = "favSw";
    s.style.background = c;
    s.style.width = "30px";
    s.style.height = "30px";
    s.style.borderRadius = "999px";
    // ★ 追加: セット内の●をタップでUse
    onTap(s, ()=> setColor(c));
    wrap.appendChild(s);
  });
  return wrap;
}

function renderFavorites(){
  if (!favoritesEl) return;

  favoritesEl.innerHTML = "";
  if (favorites.length === 0) return;

  favorites.forEach((item, idx)=>{
    const card = document.createElement("div");
    card.className = "favItem";
    const itemNote = normalizePlainText(item?.note);
    if (itemNote){
      card.classList.add("favItem--hasNote");
      card.setAttribute("data-note", itemNote);
    }

    if (item.type === "color"){
      const hex = item.value;

      card.innerHTML = `
        <div class="favTop">
          <div class="favSw favSw--big" style="background:${hex}"></div>
        </div>

        <div class="favMid">
          <div class="favHex">${hex}</div>
        </div>

        <div class="favBtns favBtns--row3">
          <button class="btn btn--tiny">Use</button>
          <button class="btn btn--tiny">Copy</button>
          <button class="btn btn--tiny">Del</button>
        </div>
      `;

      const swEl = card.querySelector(".favSw--big");
      // ★ 追加: ●タップでUse
      if (swEl) onTap(swEl, ()=> setColor(hex));

      const [useBtn, copyBtn, delBtn] = card.querySelectorAll("button");
      useBtn.addEventListener("click", ()=>setColor(hex));
      copyBtn.addEventListener("click", ()=>copyText(hex));
      delBtn.addEventListener("click", ()=>{
        favorites.splice(idx,1);
        saveFavorites(favorites);
        renderFavorites();
      });

      favoritesEl.appendChild(card);
      return;
    }

    // set
    const code = comboToCode(item.colors);

    card.innerHTML = `
      <div class="favTop"></div>

      <div class="favMid">
        <div class="favHex">${code}</div>
      </div>

      <div class="favBtns favBtns--row3">
        <button class="btn btn--tiny">Use</button>
        <button class="btn btn--tiny">Copy</button>
        <button class="btn btn--tiny">Del</button>
      </div>
    `;

    const top = card.querySelector(".favTop");
    top.appendChild(buildSetMini(item.colors));

    const [useBtn, copyBtn, delBtn] = card.querySelectorAll("button");

    useBtn.addEventListener("click", ()=>{
      combo = item.colors.slice(0,MAX_COMBO_COLORS);
      renderCombo();
      if (combo[0]) setColor(combo[0]);
    });
    copyBtn.addEventListener("click", ()=>copyText(code));
    delBtn.addEventListener("click", ()=>{
      favorites.splice(idx,1);
      saveFavorites(favorites);
      renderFavorites();
    });

    favoritesEl.appendChild(card);
  });
}

function renderCustomSaves(){
  if (!customSavesEl) return;
  customSavesEl.innerHTML = "";
  if (customSaves.length === 0) return;

  customSaves.forEach((item, idx)=>{
    const card = document.createElement("div");
    card.className = "customItem";

    const codeEl = document.createElement("div");
    codeEl.className = "customItem__code";
    codeEl.textContent = customTokensToCode(item.tokens);

    const resolved = resolveCustomTokens(item.tokens);
    const preview = buildTokenPreview(item.tokens, resolved);

    const note = normalizePlainText(item.note);
    const noteEl = document.createElement("div");
    noteEl.className = "customItem__note";
    if (note){
      noteEl.textContent = `説明: ${note}`;
    }

    const btns = document.createElement("div");
    btns.className = "customItem__btns";

    const useBtn = document.createElement("button");
    useBtn.className = "btn btn--tiny";
    useBtn.textContent = "Use";
    const copyBtn = document.createElement("button");
    copyBtn.className = "btn btn--tiny";
    copyBtn.textContent = "Copy";
    const delBtn = document.createElement("button");
    delBtn.className = "btn btn--tiny";
    delBtn.textContent = "Del";

    btns.append(useBtn, copyBtn, delBtn);
    card.append(codeEl, preview);
    if (note) card.appendChild(noteEl);
    card.appendChild(btns);

    useBtn.addEventListener("click", ()=>{
      const resolved2 = resolveCustomTokens(item.tokens);
      if (!resolved2.length) return;
      combo = resolved2;
      renderCombo();
      setColor(combo[0]);
    });
    copyBtn.addEventListener("click", ()=>copyText(customTokensToCode(item.tokens)));
    delBtn.addEventListener("click", ()=>{
      customSaves.splice(idx, 1);
      saveCustomSaves(customSaves);
      renderCustomSaves();
    });
    customSavesEl.appendChild(card);
  });
}

function refreshComboInsertOptions(){
  if (!comboInsertIndex) return;
  const previous = comboInsertIndex.value;
  comboInsertIndex.innerHTML = '<option value="">番号</option>';
  for (let i=1; i<=MAX_COMBO_COLORS; i++){
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = `${i}番目`;
    comboInsertIndex.appendChild(opt);
  }
  if (previous && Number(previous) >= 1 && Number(previous) <= MAX_COMBO_COLORS){
    comboInsertIndex.value = previous;
  }
}

// ---------- Render: combo ----------
function swapInArray(arr, i, j){
  if (!Array.isArray(arr)) return;
  if (i < 0 || j < 0) return;
  if (i >= arr.length || j >= arr.length) return;
  if (i === j) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
}

function buildComboChip(hex, idx){
  const chip = document.createElement("div");
  chip.className = "comboChip";
  chip.innerHTML = `
    <div class="comboChip__sw" style="background:${hex}"></div>
    <div class="comboChip__hex">${hex}</div>

    <button class="comboChip__btn comboMoveL" title="左へ">←</button>
    <button class="comboChip__btn comboMoveR" title="右へ">→</button>

    <button class="comboChip__btn comboUseBtn">Use</button>
    <button class="comboChip__btn comboDelBtn">✕</button>
  `;

  const leftBtn  = chip.querySelector(".comboMoveL");
  const rightBtn = chip.querySelector(".comboMoveR");
  const useBtn   = chip.querySelector(".comboUseBtn");
  const delBtn   = chip.querySelector(".comboDelBtn");

  // 左へ
  leftBtn.disabled = (idx === 0);
  leftBtn.addEventListener("click", ()=>{
    if (idx <= 0) return;
    swapInArray(combo, idx, idx - 1);
    renderCombo();
  });

  // 右へ
  rightBtn.disabled = (idx >= combo.length - 1);
  rightBtn.addEventListener("click", ()=>{
    if (idx >= combo.length - 1) return;
    swapInArray(combo, idx, idx + 1);
    renderCombo();
  });

  // Use / Delete
  useBtn.addEventListener("click", ()=> setColor(hex));
  delBtn.addEventListener("click", ()=>{
    combo.splice(idx, 1);
    renderCombo();
  });

  return chip;
}

function renderCombo(){
  comboStrip.innerHTML = "";

  if (combo.length === 0){
    comboStrip.style.background = "var(--stripBg)";
    comboGradient.style.background = "var(--stripBg)";
  }else{
    combo.forEach((hex)=>{
      const seg = document.createElement("div");
      seg.className = "segc";
      seg.style.background = hex;
      comboStrip.appendChild(seg);
    });
    comboGradient.style.background = `linear-gradient(90deg, ${combo.join(", ")})`;
  }

  // --- items（ここが並び替え対応版）---
  comboItems.innerHTML = "";
  combo.forEach((hex, idx)=>{
    comboItems.appendChild(buildComboChip(hex, idx));
  });

  refreshComboInsertOptions();
}

// ---------- Left: query parser (AND default, OR/NOT supported) ----------
function tokenizeQuery(q){
  const s = (q || "").replace(/\|/g, " OR ").trim();
  if (!s) return [];
  const re = /"([^"]+)"|(\S+)/g;
  const out = [];
  let m;
  while ((m = re.exec(s))){
    out.push((m[1] ?? m[2]).trim());
  }
  return out.filter(Boolean);
}

function parseQuery(q){
  const normalized = String(q || "").replace(/：/g, ":");
  const toks = tokenizeQuery(normalized);
  const groups = [[]]; // OR groups of AND terms
  for (const raw of toks){
    const upper = raw.toUpperCase();
    if (upper === "OR"){
      if (groups[groups.length-1].length === 0) continue;
      groups.push([]);
      continue;
    }
    let neg = false;
    let t = raw;
    if (t.startsWith("-") || t.startsWith("!")){
      neg = true;
      t = t.slice(1);
    }
    t = t.trim();
    if (!t) continue;

    let field = "any";
    const idx = t.indexOf(":");
    if (idx > 0){
      const head = t.slice(0, idx).toLowerCase();
      const tail = t.slice(idx + 1);
      if (head === "tag" || head === "title"){
        field = head;
        t = tail;
      }
    }

    if (t.startsWith("#")){
      field = "tag";
      t = t.slice(1);
    }

    t = t.toLowerCase();
    if (!t) continue;

    groups[groups.length-1].push({ neg, field, term: t });
  }

  return groups.filter(g => g.length > 0);
}

function matchSetByQuery(setObj, parsed){
  if (parsed.length === 0) return true;

  const title = String(setObj.title || "").toLowerCase();
  const tags = Array.isArray(setObj.tags) ? setObj.tags.map(x=>String(x).toLowerCase()) : [];
  const hayAny = (title + " " + tags.join(" ")).trim();

  for (const group of parsed){
    let ok = true;
    for (const {neg, field, term} of group){
      let hit = false;
      if (field === "title") hit = title.includes(term);
      else if (field === "tag") hit = tags.some(t => t.includes(term));
      else hit = hayAny.includes(term);

      if (!neg && !hit){ ok = false; break; }
      if (neg && hit){ ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

// ---------- Left: Gacha list (20 items) + Search shows all ----------
const GACHA_SIZE = 20;

function buildSetRow(setObj){
  const colors = (setObj.colors || []).map(normalizeHex).filter(Boolean).slice(0,MAX_COMBO_COLORS);

  const row = document.createElement("div");
  row.className = "setRow";

  const top = document.createElement("div");
  top.className = "setTop";

  const handle = document.createElement("div");
  handle.className = "setHandle";
  handle.textContent = "Use";
  handle.setAttribute("role", "button");
  handle.setAttribute("aria-label", "Use this set");
  onTap(handle, ()=>{
    combo = colors.slice(0,MAX_COMBO_COLORS);
    renderCombo();
    if (combo[0]) setColor(combo[0]);
  });

  const setColors = document.createElement("div");
  setColors.className = "setColors";

  colors.forEach((hex)=>{
    const wrap = document.createElement("div");
    wrap.className = "setDotWrap";
    wrap.innerHTML = `
      <div class="setDot" style="background:${hex}"></div>
      <div class="setHex">${hex}</div>
    `;
    onTap(wrap, ()=>setColor(hex));
    setColors.appendChild(wrap);
  });

  top.appendChild(handle);
  top.appendChild(setColors);

  const tags = document.createElement("div");
  tags.className = "setTags";
  (setObj.tags || []).forEach(tag=>{
    const chip = document.createElement("div");
    chip.className = "tagChip";
    chip.textContent = `#${tag}`;
    onTap(chip, ()=>{
      if (setSearch) setSearch.value = tag;
      setQuery = setSearch?.value || "";
      applyLeftFilter();
    });
    tags.appendChild(chip);
  });

  row.appendChild(top);
  row.appendChild(tags);
  return row;
}

function renderLeftList(list){
  if (!autoScrollTrack) return;
  autoScrollTrack.innerHTML = "";

  if (!list || list.length === 0){
    const empty = document.createElement("div");
    empty.style.padding = "12px";
    empty.style.color = "var(--muted)";
    empty.textContent = "該当するセットがありません";
    autoScrollTrack.appendChild(empty);
    return;
  }

  list.forEach(setObj=>{
    autoScrollTrack.appendChild(buildSetRow(setObj));
  });

  if (leftScroll) leftScroll.scrollTop = 0;
}

function applyLeftFilter(){
  const parsed = parseQuery(setQuery);
  const base = PALETTE_SETS.filter(s => matchSetByQuery(s, parsed));
  const isSearching = setQuery.trim().length > 0;

  if (isSearching){
    renderLeftList(base);
  }else{
    const pick = shuffle(base).slice(0, GACHA_SIZE);
    renderLeftList(pick);
  }
}

// ---------- Tabs ----------
function initTabs(){
  const tabs = document.querySelectorAll(".tab");
  const panels = document.querySelectorAll("[data-tab-panel]");
  tabs.forEach(tab=>{
    tab.addEventListener("click", ()=>{
      const key = tab.getAttribute("data-tab");
      tabs.forEach(t => t.classList.toggle("active", t === tab));
      panels.forEach(p => p.classList.toggle("hidden", p.getAttribute("data-tab-panel") !== key));
    });
  });
}

// ---------- Events (core) ----------
const applyBtn = document.getElementById("applyBtn");
if (applyBtn) applyBtn.addEventListener("click", ()=> setColor(hexInput?.value));

if (hexInput){
  hexInput.addEventListener("keydown", (e)=>{ if (e.key === "Enter") setColor(hexInput.value); });
}
if (picker){
  picker.addEventListener("input", (e)=> setColor(e.target.value));
}

const randomBtn = document.getElementById("randomBtn");
if (randomBtn){
  randomBtn.addEventListener("click", ()=>{
    const r = Math.floor(Math.random()*256);
    const g = Math.floor(Math.random()*256);
    const b = Math.floor(Math.random()*256);
    setColor(rgbToHex(r,g,b));
  });
}

const copyCompBtn = document.getElementById("copyCompBtn");
if (copyCompBtn) copyCompBtn.addEventListener("click", ()=> copyText(compHexEl?.textContent || ""));

const useCompBtn = document.getElementById("useCompBtn");
if (useCompBtn) useCompBtn.addEventListener("click", ()=> setColor(compHexEl?.textContent || ""));

const comboAddBtn = document.getElementById("comboAddBtn");
if (comboAddBtn){
  comboAddBtn.addEventListener("click", ()=>{
    const h = normalizeHex(currentHex);
    if (!h) return;
    combo.push(h);
    if (combo.length > MAX_COMBO_COLORS) combo = combo.slice(combo.length - MAX_COMBO_COLORS);
    renderCombo();
  });
}

if (comboInsertBtn){
  comboInsertBtn.addEventListener("click", ()=>{
    const h = normalizeHex(currentHex);
    if (!h) return;
    const idx = Number(comboInsertIndex?.value || 0) - 1;
    if (idx < 0 || idx >= MAX_COMBO_COLORS) return;
    combo.splice(idx, 0, h);
    combo = combo.slice(0, MAX_COMBO_COLORS);
    renderCombo();
  });
}

const comboClearBtn = document.getElementById("comboClearBtn");
if (comboClearBtn){
  comboClearBtn.addEventListener("click", ()=>{
    combo = [];
    renderCombo();
  });
}

const favAddBtn = document.getElementById("favAddBtn");
if (favAddBtn){
  favAddBtn.addEventListener("click", ()=>{
    const h = normalizeHex(currentHex);
    if (!h) return;
    const exists = favorites.some(x => x.type==="color" && x.value===h);
    if (!exists){
      favorites.unshift({ type:"color", value:h });
      if (favorites.length > MAX_SAVED_ITEMS) favorites = favorites.slice(0,MAX_SAVED_ITEMS);
      saveFavorites(favorites);
      renderFavorites();
    }
  });
}

const favClearBtn = document.getElementById("favClearBtn");
if (favClearBtn){
  favClearBtn.addEventListener("click", ()=>{
    favorites = [];
    saveFavorites(favorites);
    renderFavorites();
  });
}

if (presetSearch){
  presetSearch.addEventListener("input", ()=> renderPresets(presetSearch.value));
}

const presetFillBtn = document.getElementById("presetFillBtn");
if (presetFillBtn){
  presetFillBtn.addEventListener("click", ()=>{
    const shown = renderPresets(presetSearch?.value || "");
    if (shown.length === 0) return;
    const count = Math.random() < 0.5 ? 3 : 4;
    const picks = [];
    for (let i=0; i<count; i++){
      const [, hex] = shown[Math.floor(Math.random()*shown.length)];
      picks.push(normalizeHex(hex));
    }
    combo = picks.filter(Boolean).slice(0,MAX_COMBO_COLORS);
    renderCombo();
    if (combo[0]) setColor(combo[0]);
  });
}

if (saveComboBtn){
  saveComboBtn.addEventListener("click", ()=>{
    if (combo.length === 0) return;
    const code = comboToCode(combo);
    const matchedCustom = customSaves.find((entry)=> arraysEqual(resolveCustomTokens(entry.tokens), combo.slice(0,MAX_COMBO_COLORS)));
    const note = normalizePlainText(matchedCustom?.note);
    const exists = favorites.some(x => x.type==="set" && comboToCode(x.colors) === code && normalizePlainText(x.note) === note);
    if (!exists){
      favorites.unshift({ type:"set", colors: combo.slice(0,MAX_COMBO_COLORS), note });
      if (favorites.length > MAX_SAVED_ITEMS) favorites = favorites.slice(0,MAX_SAVED_ITEMS);
      saveFavorites(favorites);
      renderFavorites();
    }
  });
}

if (copyComboCodeBtn){
  copyComboCodeBtn.addEventListener("click", ()=>{
    if (combo.length === 0) return;
    copyText(comboToCode(combo));
  });
}

if (customSaveAddBtn){
  customSaveAddBtn.addEventListener("click", ()=>{
    const tokens = normalizeCustomTokens(customSaveInput?.value);
    if (!tokens.length) return;
    const note = normalizePlainText(customSaveNoteInput?.value);
    const code = customTokensToCode(tokens);
    const exists = customSaves.some(x => customTokensToCode(x.tokens) === code && normalizePlainText(x.note) === note);
    if (!exists){
      customSaves.unshift({ tokens, note });
      if (customSaves.length > MAX_SAVED_ITEMS) customSaves = customSaves.slice(0, MAX_SAVED_ITEMS);
      saveCustomSaves(customSaves);
      renderCustomSaves();
    }
    if (customSaveInput) customSaveInput.value = "";
    if (customSaveNoteInput) customSaveNoteInput.value = "";
  });
}

if (customSaveInput){
  customSaveInput.addEventListener("keydown", (e)=>{
    if (e.key === "Enter") customSaveAddBtn?.click();
  });
}

if (customSaveNoteInput){
  customSaveNoteInput.addEventListener("keydown", (e)=>{
    if (e.key === "Enter") customSaveAddBtn?.click();
  });
}

if (importSetBtn){
  importSetBtn.addEventListener("click", ()=>{
    const colors = codeToCombo(importSetInput?.value);
    if (colors.length === 0) return;
    combo = colors;
    renderCombo();
    setColor(combo[0]);
  });
}

// left search
if (setSearch){
  setSearch.addEventListener("input", ()=>{
    setQuery = setSearch.value;
    applyLeftFilter();
  });

  setSearch.addEventListener("keydown", (e)=>{
    if (e.key !== "Enter") return;
    setQuery = setSearch.value;
    applyLeftFilter();
  });
}

if (setSearchBtn){
  setSearchBtn.addEventListener("click", ()=>{
    setQuery = setSearch?.value || "";
    applyLeftFilter();
  });
}

setQuickTagBtns.forEach((btn)=>{
  btn.addEventListener("click", ()=>{
    const tag = btn.getAttribute("data-set-tag");
    if (!tag) return;
    if (setSearch) setSearch.value = tag;
    setQuery = tag;
    applyLeftFilter();
  });
});

// left gacha button
if (setShuffleBtn){
  setShuffleBtn.addEventListener("click", ()=>{
    if (setQuery.trim().length > 0) return;
    applyLeftFilter();
  });
}

// ---------- Theme buttons (light/gray/dark/custom) ----------
document.querySelectorAll("[data-theme-btn]").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    const t = btn.getAttribute("data-theme-btn");

    if (t === "custom"){
      const palette = getCurrentPaletteForTheme();
      clearPaletteTheme();
      applyPaletteTheme(palette);
      saveCustomPalette(palette);
      setTheme("custom");
      return;
    }

    // built-in theme: remove custom overlay first
    clearPaletteTheme();
    setTheme(t);
  });
});

// ---------- Init ----------
(async function init(){
  const initial = getInitialTheme();
  setTheme(initial);

  initTabs();
  renderFavorites();
  renderCustomSaves();

  await loadPresets();
  renderPresets("");

  await loadPaletteSets();

  // left init
  setQuery = setSearch?.value || "";
  applyLeftFilter();

  // start
  setColor("#4F46E5");
  renderCombo();

  // restore custom palette if theme=custom
  if (initial === "custom"){
    const pal = loadCustomPalette();
    if (pal && pal.length){
      clearPaletteTheme();
      applyPaletteTheme(pal);
    }else{
      // 何も保存がなければ最低限のpaletteを適用
      const fallback = getCurrentPaletteForTheme();
      clearPaletteTheme();
      applyPaletteTheme(fallback);
      saveCustomPalette(fallback);
    }
  }
})();
