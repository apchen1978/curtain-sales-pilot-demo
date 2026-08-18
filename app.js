// app.js — 窗簾銷售 Pilot 追蹤器 (DEMO) · vanilla JS, zero deps, localStorage only.
// Demonstrates representative business rules of a real sales-pilot tracker:
//   - Lead pipeline: new → contacted → qualified → measurement_booked → quoted → won|lost
//   - UNKNOWN discipline: missing facts are shown as UNKNOWN, never fabricated
//   - Quote versioning: every quote is a version; owner approval required before counted as "quoted"
// All data is DEMO / SIMULATION. No real customers, no backend.

"use strict";

const STORAGE_KEY = "curtain-pilot-demo:v1";
const STATUSES = ["new", "contacted", "qualified", "measurement_booked", "quoted", "won", "lost"];
const STATUS_LABEL = {
  new: "新進",
  contacted: "已聯繫",
  qualified: "已確認資格",
  measurement_booked: "已安排丈量",
  quoted: "已報價",
  won: "成交",
  lost: "未成交",
};

let leads = [];
let quotes = [];
let storageOk = true;

// ---------- storage ----------
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (Array.isArray(p.leads)) leads = p.leads.filter(isValidLead);
      if (Array.isArray(p.quotes)) quotes = p.quotes.filter(isValidQuote);
    }
  } catch {
    storageOk = false;
  }
}
function saveState() {
  if (!storageOk) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ leads, quotes }));
  } catch {
    storageOk = false;
  }
}

function isValidLead(l) {
  return l && typeof l.id === "string" && typeof l.name === "string" && STATUSES.includes(l.status);
}
function isValidQuote(q) {
  return q && typeof q.id === "string" && typeof q.leadId === "string" && typeof q.version === "number";
}

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function monthOf(s) {
  return s.slice(0, 7);
}
function money(n) {
  return "NT$" + n.toLocaleString("zh-TW");
}

// ---------- rules ----------
const NEXT = {
  new: "contacted",
  contacted: "qualified",
  qualified: "measurement_booked",
  measurement_booked: "quoted",
  quoted: "won",
};
// "quoted" is only reachable when an APPROVED quote exists; the UI enforces this.
function canAdvance(lead) {
  if (lead.status === "won" || lead.status === "lost") return false;
  if (NEXT[lead.status] === "quoted") return hasApprovedQuote(lead.id);
  return true;
}
function nextActionLabel(lead) {
  if (lead.status === "won" || lead.status === "lost") return "";
  if (NEXT[lead.status] === "quoted") return hasApprovedQuote(lead.id) ? "下一步：成交" : "等待 Owner 核准報價";
  const map = {
    new: "24h 內首次聯繫",
    contacted: "確認資格",
    qualified: "安排丈量",
    measurement_booked: "建立報價",
  };
  return map[lead.status] || "";
}
function hasApprovedQuote(leadId) {
  return quotes.some((q) => q.leadId === leadId && q.status === "approved");
}
function quoteVersionCount(leadId) {
  return quotes.filter((q) => q.leadId === leadId).length;
}

// ---------- seed (clearly fake) ----------
const SEED_LEADS = [
  { name: "陳小姐", area: "新莊", source: "LINE", budget: "60000-80000", note: "三房窗簾；主臥高度遮光", status: "new" },
  { name: "李先生", area: "板橋", source: "電話", budget: "", note: "客廳落地窗兩扇", status: "contacted" },
  { name: "王太太", area: "三重", source: "店面", budget: "30000-50000", note: "兩間臥室；一般遮光", status: "qualified" },
  { name: "張先生", area: "蘆洲", source: "轉介", budget: "100000-150000", note: "全室；需要樣布", status: "measurement_booked" },
  { name: "林小姐", area: "中和", source: "LINE", budget: "80000-120000", note: "三房兩廳", status: "quoted" },
];
const SEED_QUOTES = [
  { leadName: "林小姐", version: 1, desc: "客廳三窗 + 主臥遮光布", amount: 96800, status: "approved", approvedBy: "owner (demo)" },
];

function seedDemo() {
  const leadIdMap = {};
  for (const s of SEED_LEADS) {
    const id = makeId();
    leadIdMap[s.name] = id;
    leads.push({ id, name: s.name, area: s.area || "", source: s.source, budget: s.budget || "", note: s.note || "", status: s.status, createdAt: today() });
  }
  for (const q of SEED_QUOTES) {
    const leadId = leadIdMap[q.leadName];
    if (!leadId) continue;
    quotes.push({
      id: makeId(),
      leadId,
      version: q.version,
      desc: q.desc,
      amount: q.amount,
      status: q.status,
      approvedBy: q.approvedBy,
      createdAt: today(),
    });
  }
  saveState();
  renderAll();
}

// ---------- render ----------
const $ = (s) => document.querySelector(s);

function renderAll() {
  renderFunnel();
  renderLeads();
  renderQuoteSelect();
  renderQuotes();
}

function renderFunnel() {
  const counts = {};
  for (const l of leads) counts[l.status] = (counts[l.status] || 0) + 1;
  const max = Math.max(1, ...Object.values(counts));
  const box = $("#funnel");
  box.textContent = "";
  for (const st of STATUSES) {
    const n = counts[st] || 0;
    const row = document.createElement("div");
    row.className = "funnel-row";
    const label = document.createElement("span");
    label.className = "funnel-label";
    label.textContent = STATUS_LABEL[st];
    const barWrap = document.createElement("span");
    barWrap.className = "funnel-bar-wrap";
    const bar = document.createElement("span");
    bar.className = "funnel-bar";
    bar.style.width = Math.max(2, Math.round((n / max) * 100)) + "%";
    barWrap.append(bar);
    const val = document.createElement("span");
    val.className = "funnel-val";
    val.textContent = String(n);
    row.append(label, barWrap, val);
    box.append(row);
  }
  const wonThisMonth = leads
    .filter((l) => l.status === "won" && monthOf(l.createdAt) === monthOf(today()))
    .length;
  const wonValue = quotes.filter((q) => q.status === "approved").reduce((s, q) => s + q.amount, 0);
  const active = leads.filter((l) => !["won", "lost"].includes(l.status)).length;
  const quotable = leads.filter((l) => l.status === "measurement_booked").length;
  $("#kpi-won").textContent = money(wonValue);
  $("#kpi-active").textContent = String(active);
  $("#kpi-quotable").textContent = String(quotable);
  $("#kpi-won").dataset.note = `本月成交 ${wonThisMonth} 件（含已核准報價金額）`;
}

function leadRow(l) {
  const li = document.createElement("li");
  li.className = "lead";
  const head = document.createElement("div");
  head.className = "lead-head";
  const name = document.createElement("strong");
  name.textContent = l.name;
  const chip = document.createElement("span");
  chip.className = "status-chip " + l.status;
  chip.textContent = STATUS_LABEL[l.status];
  head.append(name, chip);
  const meta = document.createElement("div");
  meta.className = "lead-meta";
  const parts = [l.area ? `地區：${l.area}` : "", `來源：${l.source}`, l.budget ? `預算：${l.budget}` : "", l.note ? `備註：${l.note}` : ""].filter(Boolean);
  for (const t of parts) {
    const span = document.createElement("span");
    span.textContent = t;
    meta.append(span);
  }
  // UNKNOWN discipline: show explicitly, never fabricate
  if (!l.area) meta.append(unknownChip("地區 UNKNOWN"));
  if (!l.budget) meta.append(unknownChip("預算 UNKNOWN"));
  if (!l.note) meta.append(unknownChip("需求 UNKNOWN"));
  const action = document.createElement("div");
  action.className = "lead-action";
  const hint = document.createElement("span");
  hint.className = "lead-hint";
  hint.textContent = nextActionLabel(l);
  action.append(hint);
  if (canAdvance(l)) {
    const btn = document.createElement("button");
    btn.className = "secondary";
    btn.type = "button";
    btn.textContent = l.status === "quoted" ? "標記成交" : `下一步 → ${STATUS_LABEL[NEXT[l.status]]}`;
    btn.addEventListener("click", () => {
      l.status = NEXT[l.status];
      saveState();
      renderAll();
    });
    action.append(btn);
  }
  li.append(head, meta, action);
  return li;
}

function unknownChip(text) {
  const span = document.createElement("span");
  span.className = "unknown-chip";
  span.textContent = text;
  return span;
}

function renderLeads() {
  const list = $("#lead-list");
  list.textContent = "";
  for (const l of leads) list.append(leadRow(l));
  const empty = $("#list-empty-leads");
  if (empty) empty.hidden = leads.length > 0;
}

function renderQuoteSelect() {
  const sel = $("#q-lead");
  const prev = sel.value;
  sel.textContent = "";
  const quotableLeads = leads.filter((l) => ["qualified", "measurement_booked", "quoted"].includes(l.status));
  for (const l of quotableLeads) {
    const opt = document.createElement("option");
    opt.value = l.id;
    opt.textContent = `${l.name}（${STATUS_LABEL[l.status]}）`;
    sel.append(opt);
  }
  if (prev && [...sel.options].some((o) => o.value === prev)) sel.value = prev;
}

function renderQuotes() {
  const list = $("#quote-list");
  list.textContent = "";
  const sorted = [...quotes].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  if (sorted.length === 0) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "尚無報價。先建立報價，再讓 Owner 核准（DEMO）。";
    list.append(p);
    return;
  }
  for (const q of sorted) {
    const lead = leads.find((l) => l.id === q.leadId);
    const li = document.createElement("li");
    li.className = "quote";
    const left = document.createElement("div");
    const head = document.createElement("div");
    head.className = "quote-head";
    const who = document.createElement("strong");
    who.textContent = `${lead ? lead.name : "(已刪除客戶)"} · v${q.version}`;
    const chip = document.createElement("span");
    chip.className = "status-chip " + q.status;
    chip.textContent = q.status === "approved" ? "已核准" : q.status === "draft" ? "草稿" : q.status;
    head.append(who, chip);
    const desc = document.createElement("p");
    desc.className = "quote-desc";
    desc.textContent = q.desc;
    left.append(head, desc);
    const right = document.createElement("div");
    right.className = "quote-right";
    const amt = document.createElement("strong");
    amt.textContent = money(q.amount);
    right.append(amt);
    if (q.status === "approved") {
      const by = document.createElement("small");
      by.textContent = `核准：${q.approvedBy || "owner"} · ${q.createdAt}`;
      right.append(by);
    }
    li.append(left, right);
    list.append(li);
  }
}

// ---------- tabs ----------
function initTabs() {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((b) => {
        b.classList.toggle("active", b === btn);
        b.setAttribute("aria-selected", String(b === btn));
      });
      for (const id of ["tab-dashboard", "tab-leads", "tab-quotes"]) {
        $(`#${id}`).hidden = id !== `tab-${btn.dataset.tab}`;
      }
    });
  });
}

// ---------- events ----------
function initForms() {
  $("#lead-form").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const name = $("#l-name").value.trim();
    if (!name) return;
    leads.push({
      id: makeId(),
      name,
      area: $("#l-area").value.trim(),
      source: $("#l-source").value,
      budget: $("#l-budget").value.trim(),
      note: $("#l-note").value.trim().slice(0, 120),
      status: "new",
      createdAt: today(),
    });
    saveState();
    renderAll();
    $("#lead-form").reset();
    $("#l-name").focus();
  });

  $("#quote-form").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const leadId = $("#q-lead").value;
    const desc = $("#q-desc").value.trim();
    const amount = Number($("#q-amount").value);
    if (!leadId || !desc || !Number.isFinite(amount) || amount <= 0) return;
    quotes.push({
      id: makeId(),
      leadId,
      version: quoteVersionCount(leadId) + 1,
      desc,
      amount: Math.round(amount),
      status: "draft",
      createdAt: today(),
    });
    saveState();
    renderAll();
    $("#quote-form").reset();
    // keep the same lead selected so the Owner-approval step flows naturally
    if (leadId && [...$("#q-lead").options].some((o) => o.value === leadId)) $("#q-lead").value = leadId;
    showNotice(`已建立報價 v${quoteVersionCount(leadId)}（草稿）——等待 Owner 核准。`);
  });

  $("#q-approve").addEventListener("click", () => {
    const leadId = $("#q-lead").value;
    const latest = quotes
      .filter((q) => q.leadId === leadId)
      .sort((a, b) => b.version - a.version)[0];
    if (!latest) {
      showNotice("此客戶尚無報價可核准——請先建立報價。", true);
      return;
    }
    latest.status = "approved";
    latest.approvedBy = "owner (demo)";
    // approved quote unlocks the quoted status on the lead
    const lead = leads.find((l) => l.id === leadId);
    if (lead && lead.status === "measurement_booked") lead.status = "quoted";
    saveState();
    renderAll();
    showNotice(`已核准 v${latest.version}（${latest.desc}）——客戶狀態已解鎖「已報價」。`);
  });

  function showNotice(text, isError = false) {
    let el = $("#quote-notice");
    if (!el) {
      el = document.createElement("p");
      el.id = "quote-notice";
      el.className = "notice";
      document.querySelector(".quote-actions").prepend(el);
    }
    el.textContent = text;
    el.classList.toggle("error", isError);
  }

  $("#btn-seed").addEventListener("click", seedDemo);
  $("#btn-clear").addEventListener("click", () => {
    if (confirm("確定清除全部測試資料？此動作無法復原。")) {
      leads = [];
      quotes = [];
      saveState();
      renderAll();
    }
  });
}

// ---------- boot ----------
document.addEventListener("DOMContentLoaded", () => {
  loadState();
  initTabs();
  initForms();
  if (!storageOk) {
    const w = document.createElement("p");
    w.className = "storage-warning";
    w.textContent = "警告：此瀏覽器無法使用 localStorage，資料不會保存。";
    document.querySelector(".app").prepend(w);
  }
  renderAll();
});
