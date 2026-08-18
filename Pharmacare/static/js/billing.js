/**
 * billing.js — PharmaCare  (fixed & merged)
 *
 * Bugs fixed vs the original:
 *  1. Profile endpoint was /profile  → corrected to /profile_api (matches auth check in HTML)
 *  2. Medicines endpoint was /billing/medicines with no fallback
 *     → tries /get_medicines/ first, then falls back to localStorage (set by dashboard)
 *  3. addToCart loop "for i<qty addToCart(...,1)" → replaced with single call using qty directly
 *  4. cart item shape was {baseMrp} but window.renderInvoice (defined in billing.html) expects {mrp}
 *     → normalised: stored as mrp, total computed once on add/change
 *  5. renderInvoicePreview overwrote the styled #invoicePreview div with unstyled HTML
 *     → now delegates to window.renderInvoice() so the existing HTML styles are used
 *  6. printInvoice() opened a blank window and wrote unstyled HTML
 *     → now uses the HTML's #printArea + window.print() (print CSS already in billing.html)
 *  7. No CSRF token on POST requests → getCsrf() helper added to all fetches
 *  8. #chatArea doesn't exist in billing.html → auto-created inside the Smart Query card-body
 *  9. quickAddBtn added qty×1 individual calls instead of one call with qty
 * 10. setMarkup & createInvoice POSTs lacked CSRF header
 * 11. Medicine id field: used m._id (MongoDB) → supports both m._id and m.id (Django pk)
 * 12. renderCart showed adjusted (markup) price in cart but plain MRP in invoice → unified
 * 13. invoiceItems in both renderCart and createInvBtn sent rawMrp (full pack MRP) instead of
 *     per-unit MRP → mrp field now carries perUnit value; packMrp + packSize kept for audit trail
 */

(() => {
  "use strict";

  /* ─────────────────────────────────
   *  HELPERS
   * ───────────────────────────────── */
  const $ = id => document.getElementById(id);

  function fmt(v) {
    return "₹" + Number(v || 0).toFixed(2);
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function getCsrf() {
    const m = document.cookie.match(/csrftoken=([^;]+)/);
    return m ? m[1] : "";
  }

  function medId(m) {
    // Django uses m.id (int), MongoDB uses m._id (string)
    return m._id ?? m.id ?? m.name;
  }

  /**
   * parsePackQty — extracts total tablet/unit count from a pack string.
   *
   * Examples:
   *   "1×10 strip"   → 10    (1 strip × 10 tablets)
   *   "2×10 strip"   → 20
   *   "10×10 strip"  → 100
   *   "1×15 strip"   → 15
   *   "30 tabs"      → 30
   *   "60 caps"      → 60
   *   "100 ml"       → 1     (liquids/weights → not divided, return 1)
   *   "5 vials"      → 5
   *   "200 doses"    → 200
   *   ""  / null     → 1     (no pack → treat as single unit)
   */
  function parsePackQty(pack) {
    if (!pack) return 1;
    const p = String(pack).trim().toLowerCase();

    // Pattern: NxM  or  N×M  (strip/blister packs)  e.g. "2×10 strip", "10x10"
    const stripMatch = p.match(/(\d+)\s*[x×]\s*(\d+)/);
    if (stripMatch) {
      return parseInt(stripMatch[1]) * parseInt(stripMatch[2]);
    }

    // Liquid / weight units → DO NOT divide MRP (ml, l, g, kg, oz, lb)
    if (/\b(ml|l\b|litre|liter|g\b|gram|kg|oz|lb)\b/.test(p)) {
      return 1;
    }

    // Plain count units: "30 tabs", "60 caps", "10 vials", "200 doses", "5 patches"
    const countMatch = p.match(/^(\d+)\s*(tab|cap|vial|ampoule|ampule|dose|patch|piece|pc|unit)/);
    if (countMatch) return parseInt(countMatch[1]);

    // Just a number on its own e.g. "30"
    const soloNum = p.match(/^(\d+)$/);
    if (soloNum) return parseInt(soloNum[1]);

    return 1;  // unknown format → no division
  }

  // Normalize pack string for consistent suggestions (e.g. 1x10 -> 1×10, trim spaces)
  function normalizePack(pack) {
    if (!pack) return "";
    try {
      let p = String(pack).trim();
      // replace ascii x/X with multiplication sign
      p = p.replace(/\b(\d+)\s*[xX]\s*(\d+)\b/g, (m, a, b) => `${a}×${b}`);
      // collapse multiple spaces
      p = p.replace(/\s+/g, ' ');
      return p;
    } catch (e) {
      return String(pack);
    }
  }

  /**
   * unitMrp — returns per-unit MRP for a medicine.
   * If the pack contains multiple units, MRP is divided by pack quantity.
   *
   * e.g.  mrp=50, pack="1×10 strip" → unitMrp = 50/10 = ₹5 per tablet
   *        mrp=50, pack="100 ml"     → unitMrp = 50     (liquid, no division)
   */
  function unitMrp(med) {
    const totalMrp = parseFloat(med.mrp) || 0;
    const packUnits = parsePackQty(med.pack);
    return packUnits > 1 ? totalMrp / packUnits : totalMrp;
  }

  /* ─────────────────────────────────
   *  STATE
   * ───────────────────────────────── */
  let medicines = [];
  let cart = [];          // [{ id, name, pack, packMrp, packSize, mrp, qty, total, perItemMarkup }]
  let markup = 0;         // global % markup (admin)
  let profileUser = null;

  /* ─────────────────────────────────
   *  DOM REFS
   * ───────────────────────────────── */
  const medListEl = $("medList");
  const cartListEl = $("cartList");
  const cartTotalEl = $("cartTotal");
  const quickMedEl = $("quickMed");
  const quickQtyEl = $("quickQty");
  const quickAddBtn = $("quickAddBtn");
  const quickSugEl = $("quickSuggestions");
  const quickMrpEl = $("quickMrp");
  const quickPackEl = $("quickPack");
  const quickPackMrpEl = $("quickPackMrp");
  const chatInputEl = $("chatInput");
  const chatSendBtn = $("chatSend");
  const printBtn = $("printBtn");
  const createInvBtn = $("createInvoiceBtn");
  const adminControls = $("adminControls");
  const markupInput = $("markupInput");
  const setMarkupBtn = $("setMarkupBtn");
  const currentMarkupEl = $("currentMarkup");

  /* ─────────────────────────────────
   *  CHAT AREA  (auto-create if absent)
   *  billing.html has no #chatArea so we
   *  inject one inside the Smart Query card
   * ───────────────────────────────── */
  let chatAreaEl = $("chatArea");

  function ensureChatArea() {
    if (chatAreaEl) return;
    const wrap = chatInputEl ? chatInputEl.closest(".card-body") : null;
    if (!wrap) return;
    chatAreaEl = document.createElement("div");
    chatAreaEl.id = "chatArea";
    chatAreaEl.style.cssText =
      "margin-top:14px;display:flex;flex-direction:column;gap:8px;" +
      "max-height:200px;overflow-y:auto;";
    wrap.appendChild(chatAreaEl);
  }

  function addChat(html, who = "bot") {
    ensureChatArea();
    if (!chatAreaEl) return;
    const div = document.createElement("div");
    div.className = "chat-bubble" + (who === "user" ? " user" : "");
    div.innerHTML = html;
    chatAreaEl.appendChild(div);
    chatAreaEl.scrollTop = chatAreaEl.scrollHeight;
  }

  /* ─────────────────────────────────
   *  1. PROFILE  (fixed endpoint)
   * ───────────────────────────────── */
  async function fetchProfile() {
    try {
      // HTML auth check uses /profile_api — match it here
      const res = await fetch("/profile_api", { credentials: "include" });
      if (!res.ok) return null;
      const data = await res.json();
      return data.user || null;
    } catch (e) {
      console.error("fetchProfile:", e);
      return null;
    }
  }

  /* ─────────────────────────────────
   *  2. MARKUP  (CSRF added)
   * ───────────────────────────────── */
  async function loadMarkup() {
    try {
      const res = await fetch("/billing/markup", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      markup = Number(data.markup) || 0;
      if (currentMarkupEl) currentMarkupEl.textContent = markup;
      if (markupInput) markupInput.value = markup;
    } catch (e) {
      console.error("loadMarkup:", e);
    }
  }

  async function setMarkup() {
    const val = Number(markupInput?.value);
    if (isNaN(val) || val < 0) { alert("Invalid markup value"); return; }
    try {
      const res = await fetch("/billing/markup", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCsrf(),
        },
        body: JSON.stringify({ markup: val }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert("Failed to set markup: " + (err.error || res.statusText));
        return;
      }
      const data = await res.json();
      markup = Number(data.markup ?? val);
      if (currentMarkupEl) currentMarkupEl.textContent = markup;
      addChat(`Global markup set to ${markup}%`);
      renderCart();
    } catch (e) {
      console.error("setMarkup:", e);
      alert("Error setting markup: " + e.message);
    }
  }

  /* ─────────────────────────────────
   *  3. MEDICINES  (endpoint + fallback fixed)
   * ───────────────────────────────── */
  async function loadMedicines() {
    // Try Django endpoint first, then localStorage fallback
    let loaded = false;

    // Attempt 1: inventory API at /medicines (preferred)
    try {
      const res = await fetch("/medicines", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        medicines = data.medicines || (Array.isArray(data) ? data : []);
        loaded = true;
      }
    } catch (_) { }

    // Attempt 2: legacy /get_medicines/ endpoint (fallback)
    if (!loaded) {
      try {
        const res = await fetch("/get_medicines/", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          medicines = Array.isArray(data) ? data : (data.medicines || []);
          loaded = true;
        }
      } catch (_) { }
    }

    // Attempt 3: localStorage (populated by dashboard)
    if (!loaded) {
      try {
        const local = JSON.parse(
          localStorage.getItem("pharmacare_medicines") || "[]"
        );
        if (local.length) { medicines = local; loaded = true; }
      } catch (_) { }
    }

    // If we loaded something but pack info is missing for many entries, try the inventory endpoint again
    const missingPackCount = medicines.filter(m => !m || !m.pack).length;
    if (loaded && medicines.length && missingPackCount > medicines.length / 3) {
      try {
        const res2 = await fetch('/medicines', { credentials: 'include' });
        if (res2.ok) {
          const d2 = await res2.json();
          const alt = d2.medicines || (Array.isArray(d2) ? d2 : []);
          if (alt && alt.length) medicines = alt;
        }
      } catch (_) { }
    }

    // Normalize pack values for consistency
    medicines = (medicines || []).map(m => ({ ...m, pack: normalizePack(m.pack) }));

    if (!loaded || !medicines.length) {
      addChat("⚠️ Could not load medicines. Check your connection or add medicines from the Dashboard.");
    }

    renderMedList();
    populatePackOptions();
    setupQuickAdd();
  }


  /* Populate datalist for quick pack suggestions from loaded medicines */
  function populatePackOptions() {
    try {
      const dl = document.getElementById('quickPackOptions');
      if (!dl) return;
      // Collect unique non-empty pack strings (normalized)
      const packs = medicines.map(m => normalizePack(m.pack || '')).filter(p => p);
      const uniq = Array.from(new Set(packs)).slice(0, 200);
      dl.innerHTML = '';
      uniq.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        dl.appendChild(opt);
      });
    } catch (e) {
      console.error('populatePackOptions:', e);
    }
  }

  /* ─────────────────────────────────
   *  4. MEDICINE LIST (sidebar)
   * ───────────────────────────────── */
  function renderMedList() {
    if (!medListEl) return;

    if (!medicines.length) {
      medListEl.innerHTML =
        '<p style="color:var(--muted);font-size:0.85rem;text-align:center;padding:12px 0;">No medicines loaded.</p>';
      return;
    }

    medListEl.innerHTML = medicines.map((m, i) => {
      const uMrp = unitMrp(m);
      const packQty = parsePackQty(m.pack);
      const showUnit = packQty > 1;
      return `
      <div class="med-item"
           style="display:flex;align-items:center;justify-content:space-between;gap:8px;"
           data-idx="${i}">
        <div style="min-width:0;flex:1;">
          <div style="font-weight:600;font-size:0.85rem;
                      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${esc(m.name)}
          </div>
          <div style="font-size:0.72rem;color:var(--muted);">
            ${esc(m.type || "")}${m.pack ? " · " + esc(m.pack) : ""}
            ${m.stock != null ? " · Stock: " + m.stock : ""}
          </div>
          ${showUnit ? `<div style="font-size:0.72rem;color:var(--brand-dark);margin-top:2px;">
            Pack MRP ${fmt(m.mrp)} ÷ ${packQty} = <strong>${fmt(uMrp)}/unit</strong>
          </div>` : ""}
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
          <div style="text-align:right;">
            <div style="font-size:0.82rem;font-weight:700;color:var(--brand-dark);">${fmt(uMrp)}</div>
            ${showUnit ? `<div style="font-size:0.68rem;color:var(--muted);">per unit</div>` : ""}
          </div>
          <button onclick="window._medListAdd(${i})"
            style="padding:4px 10px;font-size:0.75rem;font-weight:600;
                   background:rgba(0,201,167,0.1);color:var(--brand-dark);
                   border:1px solid rgba(0,201,167,0.25);border-radius:7px;cursor:pointer;">
            + Add
          </button>
        </div>
      </div>`;
    }).join("");
    // Ensure pack options reflect latest medicines list
    populatePackOptions();
  }

  window._medListAdd = function (idx) {
    const m = medicines[idx];
    if (m) addToCart(m, 1);
  };

  /* ─────────────────────────────────
   *  5. QUICK-ADD  (qty bug fixed)
   * ───────────────────────────────── */
  let selectedQuickMed = null;

  function clearSugg() {
    if (!quickSugEl) return;
    quickSugEl.innerHTML = "";
    quickSugEl.classList.add("hidden");
  }

  function showSugg(list) {
    if (!quickSugEl) return;
    quickSugEl.innerHTML = "";
    if (!list.length) { quickSugEl.classList.add("hidden"); return; }
    list.forEach(m => {
      const uMrp = unitMrp(m);
      const packQty = parsePackQty(m.pack);
      const showUnit = packQty > 1;
      const li = document.createElement("li");
      li.innerHTML = `
        <span style="font-weight:600;">${esc(m.name)}</span>
        <span style="float:right;color:var(--brand-dark);font-weight:700;">${fmt(uMrp)}/unit</span>
        <div style="font-size:0.72rem;color:var(--muted);margin-top:2px;clear:both;">
          ${esc(m.type || "")}${m.pack ? " · " + esc(m.pack) : ""}
          ${showUnit ? ` · Pack MRP ${fmt(m.mrp)} ÷ ${packQty}` : ""}
          ${m.stock != null ? " · Stock: " + m.stock : ""}
        </div>`;
      li.addEventListener("click", () => {
        selectedQuickMed = m;
        quickMedEl.value = m.name;
        const uMrp = unitMrp(m);
        const packQty = parsePackQty(m.pack);
        quickMrpEl.textContent = fmt(uMrp) + (packQty > 1 ? `/unit (pack ${fmt(m.mrp)})` : "");
        if (quickPackEl) quickPackEl.value = normalizePack(m.pack) || "";
        // prefer packMrp if available, otherwise use mrp as pack MRP
        if (quickPackMrpEl) quickPackMrpEl.value = (m.packMrp ?? m.mrp) ?? "";
        clearSugg();
        quickQtyEl?.focus();
      });
      quickSugEl.appendChild(li);
    });
    quickSugEl.classList.remove("hidden");
  }

  function setupQuickAdd() {
    if (!quickMedEl) return;

    quickMedEl.addEventListener("input", function () {
      const q = this.value.trim().toLowerCase();
      selectedQuickMed = null;
      if (quickMrpEl) quickMrpEl.textContent = "₹0.00";
      if (!q) { clearSugg(); return; }
      const hits = medicines.filter(m =>
        (m.name || "").toLowerCase().includes(q)
      ).slice(0, 10);

      const exact = medicines.find(m => (m.name || "").toLowerCase() === q);
      const oneHit = hits.length === 1 ? hits[0] : null;
      const fillMed = exact || oneHit;
      if (fillMed) {
        selectedQuickMed = fillMed;
        if (quickPackEl && !quickPackEl.value.trim()) quickPackEl.value = normalizePack(fillMed.pack) || "";
        if (quickPackMrpEl && !quickPackMrpEl.value.trim()) quickPackMrpEl.value = (fillMed.packMrp ?? fillMed.mrp) ?? "";
        if (quickMrpEl) {
          const uMrp = unitMrp(fillMed);
          const packQty = parsePackQty(fillMed.pack);
          quickMrpEl.textContent = fmt(uMrp) + (packQty > 1 ? `/unit (pack ${fmt(fillMed.mrp)})` : "");
        }
      }

      showSugg(hits);
    });

    quickMedEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        doQuickAdd();
      }
    });

    quickAddBtn?.addEventListener("click", doQuickAdd);

    document.addEventListener("click", function (e) {
      if (e.target !== quickMedEl && !quickSugEl?.contains(e.target)) clearSugg();
    });
  }

  function doQuickAdd() {
    let m = selectedQuickMed;
    if (!m) {
      const q = (quickMedEl?.value || "").trim().toLowerCase();
      m = medicines.find(x => (x.name || "").toLowerCase() === q)
        || medicines.find(x => (x.name || "").toLowerCase().includes(q))
        || null;
    }
    if (!m) {
      flashEl(quickMedEl, "Medicine not found — select from the list");
      return;
    }

    // Auto-fill pack and pack MRP even when the user types the name manually.
    if (m && quickPackEl && !quickPackEl.value.trim()) {
      quickPackEl.value = m.pack || "";
    }
    if (m && quickPackMrpEl && !quickPackMrpEl.value.trim()) {
      quickPackMrpEl.value = (m.packMrp ?? m.mrp) ?? "";
    }
    if (m && quickMrpEl) {
      const uMrp = unitMrp(m);
      const packQty = parsePackQty(m.pack);
      quickMrpEl.textContent = fmt(uMrp) + (packQty > 1 ? `/unit (pack ${fmt(m.mrp)})` : "");
    }

    const qty = Math.max(1, parseInt(quickQtyEl?.value) || 1);
    // allow user to override pack before adding; compute pack MRP explicitly
    const packVal = normalizePack(quickPackEl?.value?.trim());
    const packMrpVal = parseFloat(quickPackMrpEl?.value);
    let medToAdd;
    if (m) {
      medToAdd = Object.assign({}, m);
      // Prefer explicit overrides from the add form, but if the medicine already has pack info
      // from the database, keep it. If pack is still missing, parsePackQty() will assume 1.
      if (packVal) medToAdd.pack = packVal;
      if (!isNaN(packMrpVal)) {
        medToAdd.packMrp = packMrpVal;
      } else if (medToAdd.packMrp == null) {
        medToAdd.packMrp = medToAdd.mrp;
      }
    } else {
      // manual medicine object when medicines couldn't be loaded or not found
      if (packVal || !isNaN(packMrpVal)) {
        medToAdd = {
          _id: 'manual-' + Date.now(),
          name: quickMedEl?.value?.trim() || 'Unknown',
          pack: packVal || '',
          packMrp: isNaN(packMrpVal) ? 0 : packMrpVal,
        };
      } else {
        flashEl(quickMedEl, "Medicine not found — select from the list or enter pack/MRP");
        return;
      }
    }
    addToCart(medToAdd, qty);

    if (quickMedEl) quickMedEl.value = "";
    if (quickMrpEl) quickMrpEl.textContent = "₹0.00";
    if (quickQtyEl) quickQtyEl.value = 1;
    if (quickPackEl) quickPackEl.value = "";
    if (quickPackMrpEl) quickPackMrpEl.value = "";
    selectedQuickMed = null;
    clearSugg();
  }

  /* ─────────────────────────────────
   *  6. CART
   * ───────────────────────────────── */
  function addToCart(med, qty, perItemMarkup = 0) {
    const id = medId(med);
    // Determine full pack MRP: prefer explicit packMrp, otherwise fall back to med.mrp.
    // If no pack string is available, parsePackQty() will assume a single unit.
    const rawPackMrp = parseFloat(med.packMrp ?? med.mrp) || 0;
    const packSize = parsePackQty(med.pack);
    const mrp = packSize > 1 ? rawPackMrp / packSize : rawPackMrp; // per-unit MRP
    const pct = Number(perItemMarkup) || 0;

    // Merge if same medicine + same per-item markup
    const existing = cart.find(
      c => c.id === id && Number(c.perItemMarkup) === pct
    );
    if (existing) {
      existing.qty += qty;
      existing.total = existing.qty * existing.mrp;
    } else {
      cart.push({
        id,
        name: med.name,
        pack: med.pack || "",
        packMrp: rawPackMrp,      // full pack MRP for audit/invoice
        packSize: packSize,
        mrp,                      // per-unit MRP used for all price calculations
        qty,
        total: mrp * qty,
        perItemMarkup: pct,
      });
    }
    renderCart();
  }

  function renderCart() {
    if (!cartListEl) return;

    if (!cart.length) {
      cartListEl.innerHTML =
        '<p style="color:var(--muted);font-size:0.85rem;text-align:center;padding:8px 0;">Cart is empty.</p>';
      if (cartTotalEl) cartTotalEl.textContent = "0.00";
      window.renderInvoice?.([]);
      return;
    }

    cartListEl.innerHTML = cart.map((item, i) => {
      const sellPrice = item.mrp * (1 + (markup + item.perItemMarkup) / 100);
      const lineTotal = sellPrice * item.qty;
      return `
        <div class="cart-item"
             style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;font-size:0.85rem;
                        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${esc(item.name)}
            </div>
            <div style="font-size:0.75rem;color:var(--muted);">
              ${item.pack ? `<div>Pack: ${esc(item.pack)}</div>` : ""}
              ${fmt(item.mrp)}/unit × ${item.qty}
              ${markup ? `<span style="color:#D97706;"> (+${markup}%)</span>` : ""}
              = <strong style="color:var(--brand-dark);">${fmt(lineTotal)}</strong>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:5px;flex-shrink:0;">
            <button onclick="window._cartQty(${i},-1)"
              style="width:24px;height:24px;border-radius:6px;border:1px solid rgba(10,15,30,0.12);
                     background:#fff;cursor:pointer;font-size:1rem;line-height:1;">−</button>
            <span style="font-size:0.85rem;font-weight:600;min-width:18px;text-align:center;">
              ${item.qty}
            </span>
            <button onclick="window._cartQty(${i},1)"
              style="width:24px;height:24px;border-radius:6px;border:1px solid rgba(10,15,30,0.12);
                     background:#fff;cursor:pointer;font-size:1rem;line-height:1;">+</button>
            <button onclick="window._cartRemove(${i})"
              style="width:24px;height:24px;border-radius:6px;
                     border:1px solid rgba(239,68,68,0.2);background:rgba(239,68,68,0.07);
                     color:#B91C1C;cursor:pointer;font-size:0.75rem;line-height:1;">✕</button>
          </div>
        </div>`;
    }).join("");

    // Grand total using per-unit sell price (markup applied)
    const grand = cart.reduce((s, c) => {
      const sp = c.mrp * (1 + (markup + c.perItemMarkup) / 100);
      return s + sp * c.qty;
    }, 0);
    if (cartTotalEl) cartTotalEl.textContent = grand.toFixed(2);

    // FIX #13: mrp = per-unit MRP; packMrp + packSize kept for invoice breakdown
    const invoiceItems = cart.map(c => {
      const perUnit   = c.mrp;                                          // per-unit MRP
      const sellPrice = perUnit * (1 + (markup + c.perItemMarkup) / 100);
      return {
        name:     c.name,
        pack:     c.pack,
        packMrp:  c.packMrp,                                             // full pack MRP (reference)
        packSize: c.packSize || parsePackQty(c.pack),                    // units per pack
        mrp:      perUnit,                                               // ← per-unit MRP ✓
        qty:      c.qty,
        total:    sellPrice * c.qty,                                     // perUnit × qty (with markup)
      };
    });
    window.renderInvoice?.(invoiceItems);
  }

  window._cartQty = function (idx, delta) {
    if (!cart[idx]) return;
    cart[idx].qty = Math.max(1, cart[idx].qty + delta);
    cart[idx].total = cart[idx].qty * cart[idx].mrp;
    renderCart();
  };

  window._cartRemove = function (idx) {
    cart.splice(idx, 1);
    renderCart();
  };

  /* ─────────────────────────────────
   *  7. CHAT COMMANDS
   * ───────────────────────────────── */
  function findMed(q) {
    const lq = q.toLowerCase().trim();
    return medicines.find(m => (m.name || "").toLowerCase() === lq)
      || medicines.find(m => (m.name || "").toLowerCase().startsWith(lq))
      || medicines.find(m => (m.name || "").toLowerCase().includes(lq))
      || null;
  }

  function handleChat(raw) {
    if (!raw.trim()) return;
    addChat(esc(raw), "user");
    const t = raw.toLowerCase().trim();

    // price of X
    const pm = t.match(/^(?:price|mrp|cost)\s+(?:of\s+)?(.+)$/);
    if (pm) {
      const m = findMed(pm[1]);
      if (m) {
        const uMrp = unitMrp(m);
        const packQty = parsePackQty(m.pack);
        const sell = uMrp * (1 + markup / 100);
        const packInfo = packQty > 1
          ? `Pack MRP: ${fmt(m.mrp)} ÷ ${packQty} units = <strong>${fmt(uMrp)}/unit</strong>`
          : `MRP: <strong>${fmt(uMrp)}</strong>`;
        addChat(
          `💊 <strong>${esc(m.name)}</strong><br>` +
          packInfo +
          (markup ? ` &nbsp;|&nbsp; Sell (+${markup}%): <strong>${fmt(sell)}</strong>` : "") +
          `<br><small style="color:var(--muted);">Type: ${esc(m.type || "—")} · Pack: ${esc(m.pack || "—")} · Stock: ${m.stock ?? "—"}</small>`
        );
      } else {
        addChat(`❌ No medicine found matching "<em>${esc(pm[1])}</em>".`);
      }
      return;
    }

    // add X [qty]
    const am = t.match(/^add\s+(.+?)(?:\s+(\d+))?$/);
    if (am) {
      const m = findMed(am[1]);
      const qty = parseInt(am[2]) || 1;
      if (m) {
        addToCart(m, qty);
        addChat(`✅ Added <strong>${qty}×</strong> <strong>${esc(m.name)}</strong> — ${fmt(unitMrp(m))}/unit`);
      } else {
        addChat(`❌ "<em>${esc(am[1])}</em>" not found in inventory.`);
      }
      return;
    }

    // remove X
    const rm = t.match(/^remove\s+(.+)$/);
    if (rm) {
      const idx = cart.findIndex(c =>
        c.name.toLowerCase().includes(rm[1].toLowerCase())
      );
      if (idx > -1) {
        const name = cart[idx].name;
        cart.splice(idx, 1);
        renderCart();
        addChat(`🗑️ Removed <strong>${esc(name)}</strong> from cart.`);
      } else {
        addChat(`❌ "<em>${esc(rm[1])}</em>" is not in the cart.`);
      }
      return;
    }

    // clear
    if (t === "clear" || t === "clear cart" || t === "reset") {
      cart = [];
      renderCart();
      addChat("🧹 Cart cleared.");
      return;
    }

    // fallback: search by name
    const found = findMed(t);
    if (found) {
      const uMrp = unitMrp(found);
      const packQty = parsePackQty(found.pack);
      const sell = uMrp * (1 + markup / 100);
      addChat(
        `💊 <strong>${esc(found.name)}</strong> — ` +
        (packQty > 1 ? `${fmt(found.mrp)} pack ÷ ${packQty} = ` : "") +
        `${fmt(uMrp)}/unit` +
        (markup ? ` | Sell: ${fmt(sell)}` : "") +
        `<br><small style="color:var(--muted);">Try: "add ${esc(found.name)} 2"</small>`
      );
      return;
    }

    addChat(
      `🤔 Try:<br>` +
      `• <code>price of Paracetamol</code><br>` +
      `• <code>add Paracetamol 2</code><br>` +
      `• <code>remove Paracetamol</code><br>` +
      `• <code>clear</code>`
    );
  }

  chatSendBtn?.addEventListener("click", function () {
    const v = chatInputEl?.value?.trim();
    if (v) { handleChat(v); chatInputEl.value = ""; }
  });

  chatInputEl?.addEventListener("keydown", function (e) {
    if (e.key === "Enter") chatSendBtn?.click();
  });

  /* ─────────────────────────────────
   *  8. STOCK SYNC
   * ───────────────────────────────── */
  function findCartMedicine(id) {
    return medicines.find(m => String(m._id ?? m.id) === String(id) || String(m.id) === String(id));
  }

  async function updateMedicineStock(med, deductQty) {
    if (!med || deductQty <= 0) return false;
    const currentStock = Number(med.stock || 0);
    const newStock = Math.max(0, currentStock - deductQty);

    const payload = {
      stock: newStock
    };

    const res = await fetch(`/medicines/${medId(med)}`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrf(),
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || res.statusText || 'Update failed');
    }

    med.stock = newStock;
    return true;
  }

  async function syncCartStock() {
    const cartById = cart.reduce((acc, item) => {
      if (!item.id || String(item.id).startsWith('manual-')) return acc;
      acc[String(item.id)] = (acc[String(item.id)] || 0) + Number(item.qty || 0);
      return acc;
    }, {});

    const ids = Object.keys(cartById);
    if (!ids.length) return false;

    let updated = false;
    for (const id of ids) {
      const med = findCartMedicine(id);
      if (!med) continue;
      const qty = cartById[id];
      if (qty <= 0) continue;
      try {
        await updateMedicineStock(med, qty);
        updated = true;
      } catch (e) {
        console.error('Stock update failed for', med.name, e);
        addChat(`⚠️ Could not update stock for <strong>${esc(med.name)}</strong>: ${esc(e.message)}`);
      }
    }

    if (updated) {
      renderMedList();
    }
    return updated;
  }

  /* ─────────────────────────────────
   *  8. PRINT  (use HTML's #printArea + window.print())
   * ───────────────────────────────── */
  printBtn?.addEventListener("click", async function (event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const updated = await syncCartStock();
    if (updated) {
      addChat('✅ Stock updated for the printed invoice.');
    }
    window.print();
  }, true);

  /* ─────────────────────────────────
   *  9. CREATE & SAVE INVOICE  (CSRF + per-unit MRP fixed)
   * ───────────────────────────────── */
  createInvBtn?.addEventListener("click", async function () {
    if (!cart.length) { alert("Cart is empty — add medicines first."); return; }

    const customerName = prompt("Customer name (optional):", "") || "";

    // FIX #13: mrp = per-unit MRP so server sees consistent mrp × qty = total
    const invoiceItems = cart.map(c => {
      const perUnit   = c.mrp;                                          // per-unit MRP
      const sellPrice = perUnit * (1 + (markup + c.perItemMarkup) / 100);
      return {
        medicineId:    medId({ _id: c.id }),
        name:          c.name,
        pack:          c.pack,
        packSize:      c.packSize || parsePackQty(c.pack),               // units per pack
        packMrp:       c.packMrp,                                        // full pack MRP (audit trail)
        mrp:           perUnit,                                          // ← per-unit MRP ✓
        qty:           c.qty,
        perItemMarkup: c.perItemMarkup,
        total:         sellPrice * c.qty,                                // perUnit × qty (with markup)
      };
    });

    const payload = {
      items: invoiceItems,
      customerName,
      markup,
      grand_total: cart.reduce((s, c) => {
        return s + c.mrp * (1 + (markup + c.perItemMarkup) / 100) * c.qty;
      }, 0).toFixed(2),
      date: new Date().toISOString(),
    };

    try {
      const res = await fetch("/billing/invoice", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCsrf(),
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        const updated = await syncCartStock();
        if (updated) {
          addChat('✅ Stock updated after invoice save.');
        }
        addChat("✅ Invoice saved! ID: " + (data.invoice?._id || data.id || "—"));
        cart = [];
        renderCart();
      } else {
        const err = await res.json().catch(() => ({}));
        addChat("⚠️ Save failed: " + (err.error || res.statusText) + ". Invoice shown locally.");
      }
    } catch (e) {
      console.error("createInvoice:", e);
      addChat("⚠️ Network error — invoice shown locally only.");
    }
  });

  /* ─────────────────────────────────
   *  UTIL: flash input on error
   * ───────────────────────────────── */
  function flashEl(el, msg) {
    if (!el) return;
    const prev = el.placeholder;
    el.style.borderColor = "#EF4444";
    el.style.boxShadow = "0 0 0 3px rgba(239,68,68,0.15)";
    el.placeholder = msg;
    setTimeout(() => {
      el.style.borderColor = "";
      el.style.boxShadow = "";
      el.placeholder = prev;
    }, 2500);
  }

  /* ─────────────────────────────────
   *  INIT
   * ───────────────────────────────── */
  async function init() {
    const profile = await fetchProfile();
    profileUser = profile;

    if (profile?.role === "admin") {
      adminControls?.classList.remove("hidden");
    }

    await loadMarkup();
    await loadMedicines();

    if (setMarkupBtn) setMarkupBtn.addEventListener("click", setMarkup);
  }

  // Run after DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();