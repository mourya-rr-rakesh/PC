/**
 * medicines/static/medicines/js/ai_search.js
 *
 * Vanilla JS controller for the AI Medicine Search modal.
 * No frameworks, no build step — plain DOM + fetch.
 *
 * ADJUST ME: the one line below (EXISTING_SEARCH_INPUT_ID) needs to
 * match the real id/name of your existing medicine search input.
 */

(function () {
  "use strict";

  // ---------------------------------------------------------------------
  // ADJUST ME: point this at your EXISTING search bar's input element.
  // If it doesn't have an id, add one (id="..." on the <input>), or
  // change this to a querySelector that reliably targets it, e.g.
  // document.querySelector('input[name="q"]').
  // ---------------------------------------------------------------------
  const EXISTING_SEARCH_INPUT_ID = "existing-medicine-search-input";
  const TRIGGER_BUTTON_ID = "ai-search-trigger-btn";

  const els = {}; // populated on DOMContentLoaded

  function qs(id) {
    return document.getElementById(id);
  }

  function getCsrfToken() {
    // Standard Django pattern: read the csrftoken cookie.
    const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);

    // Fallback: a hidden {% csrf_token %} input, if present on the page.
    const input = document.querySelector('input[name="csrfmiddlewaretoken"]');
    return input ? input.value : "";
  }

  function openModal(medicineName) {
    els.medicineNameEl.textContent = medicineName;
    els.overlay.hidden = false;
    // Next frame, so the transition actually runs.
    requestAnimationFrame(() => els.overlay.classList.add("is-open"));

    resetResultState();
    setStatus("Finding medicine information...", true);

    els.closeBtn.focus();
    document.addEventListener("keydown", onKeydown);
  }

  function closeModal() {
    els.overlay.classList.remove("is-open");
    document.removeEventListener("keydown", onKeydown);
    setTimeout(() => {
      els.overlay.hidden = true;
    }, 140);
  }

  function onKeydown(e) {
    if (e.key === "Escape") closeModal();
  }

  function resetResultState() {
    els.result.hidden = true;
    els.error.hidden = true;
    els.error.textContent = "";
    els.compositionSection.hidden = true;
    els.matchesSection.hidden = true;
    els.emptyNotice.hidden = true;
    els.compositionList.innerHTML = "";
    els.matchesList.innerHTML = "";
    els.meta.innerHTML = "";
  }

  function setStatus(text, loading) {
    els.status.hidden = false;
    els.statusText.textContent = text;
    els.status.querySelector(".ai-search-spinner").style.display = loading ? "" : "none";
  }

  function showError(message) {
    els.status.hidden = true;
    els.result.hidden = true;
    els.error.hidden = false;
    els.error.textContent = message;
  }

  function renderComposition(medicine) {
    const composition = medicine.composition || [];

    if (composition.length === 0) {
      return false;
    }

    els.compositionSection.hidden = false;
    composition.forEach((item) => {
      const li = document.createElement("li");

      const nameSpan = document.createElement("span");
      nameSpan.textContent = item.ingredient || "";

      const strengthSpan = document.createElement("span");
      strengthSpan.className = "strength";
      strengthSpan.textContent = item.strength || "";

      li.appendChild(nameSpan);
      li.appendChild(strengthSpan);
      els.compositionList.appendChild(li);
    });

    const metaParts = [];
    if (medicine.description) metaParts.push(`<div>${escapeHtml(medicine.description)}</div>`);
    if (medicine.age) metaParts.push(`<div>Age group: ${escapeHtml(medicine.age)}</div>`);
    els.meta.innerHTML = metaParts.join("");

    return true;
  }

  function badgeClass(percentage) {
    return percentage >= 70 ? "ai-search-badge" : "ai-search-badge ai-search-badge--low";
  }

  function renderMatches(matches) {
    if (!matches || matches.length === 0) {
      return false;
    }

    els.matchesSection.hidden = false;

    matches.forEach((match) => {
      const card = document.createElement("li");
      card.className = "ai-search-match-card";

      const row = document.createElement("div");
      row.className = "ai-search-match-card__row";

      const name = document.createElement("span");
      name.className = "ai-search-match-card__name";
      name.textContent = match.name || "";

      const badge = document.createElement("span");
      badge.className = badgeClass(match.overall_match || 0);
      badge.textContent = `${Math.round(match.overall_match || 0)}%`;

      row.appendChild(name);
      row.appendChild(badge);

      const comp = document.createElement("div");
      comp.className = "ai-search-match-card__composition";
      comp.textContent = match.composition || "";

      card.appendChild(row);
      card.appendChild(comp);
      els.matchesList.appendChild(card);
    });

    return true;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  async function runAiSearch(medicineName) {
    openModal(medicineName);

    let response;
    try {
      response = await fetch(window.AI_SEARCH_CONFIG.endpointUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCsrfToken(),
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({ medicine_name: medicineName }),
      });
    } catch (networkErr) {
      showError("Could not reach the server. Check your connection and try again.");
      return;
    }

    let data;
    try {
      data = await response.json();
    } catch (parseErr) {
      showError("Received an unexpected response from the server.");
      return;
    }

    if (!response.ok || !data.success) {
      showError(data.error || "Something went wrong while searching.");
      return;
    }

    els.status.hidden = true;
    els.result.hidden = false;

    const medicine = data.medicine || {};
    els.medicineNameEl.textContent = medicine.name || medicineName;

    const hasComposition = renderComposition(medicine);
    const hasMatches = renderMatches(data.matches);

    if (!hasMatches) {
      els.emptyNotice.hidden = false;
      els.emptyNotice.textContent =
        data.notice ||
        "No matching medicine was found in the database based on the detected composition.";
    }

    if (!hasComposition && !hasMatches && data.notice) {
      els.emptyNotice.hidden = false;
      els.emptyNotice.textContent = data.notice;
    }
  }

  function init() {
    els.overlay = qs("ai-search-modal-overlay");
    if (!els.overlay) return; // modal partial not included on this page

    els.modal = qs("ai-search-modal");
    els.closeBtn = qs("ai-search-modal-close");
    els.closeBtnFooter = qs("ai-search-modal-close-btn");
    els.medicineNameEl = qs("ai-search-medicine-name");
    els.status = qs("ai-search-status");
    els.statusText = qs("ai-search-status-text");
    els.result = qs("ai-search-result");
    els.error = qs("ai-search-error");
    els.compositionSection = qs("ai-search-composition-section");
    els.compositionList = qs("ai-search-composition-list");
    els.meta = qs("ai-search-meta");
    els.matchesSection = qs("ai-search-matches-section");
    els.matchesList = qs("ai-search-matches-list");
    els.emptyNotice = qs("ai-search-empty-notice");

    els.closeBtn.addEventListener("click", closeModal);
    els.closeBtnFooter.addEventListener("click", closeModal);
    els.overlay.addEventListener("click", (e) => {
      if (e.target === els.overlay) closeModal();
    });

    const triggerBtn = qs(TRIGGER_BUTTON_ID);
    if (!triggerBtn) {
      console.warn(
        `AI Search: trigger button #${TRIGGER_BUTTON_ID} not found. ` +
        "Add the button next to your existing search input — see " +
        "ai_search_modal.html for the markup to copy."
      );
      return;
    }

    triggerBtn.addEventListener("click", () => {
      const input = qs(EXISTING_SEARCH_INPUT_ID);
      if (!input) {
        console.warn(
          `AI Search: existing search input #${EXISTING_SEARCH_INPUT_ID} not found. ` +
          "Update EXISTING_SEARCH_INPUT_ID at the top of ai_search.js."
        );
        return;
      }

      const medicineName = (input.value || "").trim();
      if (!medicineName) {
        alert("Please enter a medicine name first.");
        return;
      }

      runAiSearch(medicineName);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
