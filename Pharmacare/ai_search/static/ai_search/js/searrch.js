/**
 * AI Medicine Search Frontend Handler
 */

async function searchMedicine(query) {
    query = (query || "").trim();

    if (!query) {
        alert("Please enter a medicine name to search.");
        return;
    }

    const searchButton = document.getElementById("search-button");
    const banner = document.getElementById("search-status-banner");
    const externalCard = document.getElementById("external-medicine-card");
    const inventorySection = document.getElementById("inventory-results-section");
    const inventoryTableBody = document.getElementById("medicine-results");

    // Reset view
    if (externalCard) externalCard.style.display = "none";
    if (inventorySection) inventorySection.style.display = "none";
    if (inventoryTableBody) inventoryTableBody.innerHTML = "";

    // Show loading banner
    if (banner) {
        banner.className = "search-status-banner status-loading";
        banner.style.display = "flex";
        banner.innerHTML = `
            <span class="loading-spinner"></span>
            <span>Searching database and researching public web sources for "<strong>${escapeHtml(query)}</strong>"...</span>
        `;
    }

    if (searchButton) {
        searchButton.disabled = true;
    }

    try {
        const response = await fetch(
            `/ai/api/search/?query=${encodeURIComponent(query)}`
        );

        const data = await response.json().catch(() => ({}));

        // Handle HTTP error status (e.g. 500 API / Service error)
        if (!response.ok || data.source === "error") {
            const errorMsg = data.details || data.error || "Medicine information service encountered an error.";
            if (banner) {
                banner.className = "search-status-banner status-error";
                banner.style.display = "block";
                banner.innerHTML = `
                    <strong>Service Error:</strong> ${escapeHtml(errorMsg)}
                `;
            }
            return;
        }

        // =====================================================
        // Case A: Found in Local Inventory
        // =====================================================
        if (data.found_in_inventory && data.inventory_matches && data.inventory_matches.length > 0) {
            if (banner) {
                banner.className = "search-status-banner status-success";
                banner.style.display = "block";
                banner.innerHTML = `
                    <strong>Found in Local Inventory:</strong> ${data.inventory_matches.length} matching medicine(s) found in stock.
                `;
            }

            if (inventoryTableBody && inventorySection) {
                inventoryTableBody.innerHTML = "";
                data.inventory_matches.forEach(function (medicine) {
                    const row = document.createElement("tr");

                    const name = medicine.medicine_name || "-";
                    const composition = medicine.composition || "Not available";
                    const stock = medicine.stock ?? 0;
                    const mrp = Number(medicine.mrp || 0).toFixed(2);

                    row.innerHTML = `
                        <td><span class="medicine-name">${escapeHtml(name)}</span></td>
                        <td>${escapeHtml(composition)}</td>
                        <td><span class="stock-badge ${stock > 0 ? 'stock-in' : 'stock-out'}">${stock}</span></td>
                        <td><span class="mrp-value">₹${mrp}</span></td>
                    `;
                    inventoryTableBody.appendChild(row);
                });
                inventorySection.style.display = "block";
            }

            // If enriched external info is also present
            if (data.external_info && data.external_info.found) {
                renderExternalCard(data.external_info);
            }
            return;
        }

        // =====================================================
        // Case B: Not in Local Inventory, Found via External Research
        // =====================================================
        if (!data.found_in_inventory && data.external_info && data.external_info.found) {
            if (banner) {
                banner.className = "search-status-banner status-external";
                banner.style.display = "block";
                banner.innerHTML = `
                    <strong>Web Research Success:</strong> Medicine is not in local inventory, but verified information was identified from authoritative sources.
                `;
            }

            renderExternalCard(data.external_info);
            return;
        }

        // =====================================================
        // Case C: Medicine Cannot Be Reliably Identified Anywhere
        // =====================================================
        if (banner) {
            banner.className = "search-status-banner status-warning";
            banner.style.display = "block";
            banner.innerHTML = `
                <strong>Not Identified:</strong> Medicine could not be reliably identified from the available sources.
            `;
        }

    } catch (error) {
        console.error("AI Medicine Search Fetch Error:", error);
        if (banner) {
            banner.className = "search-status-banner status-error";
            banner.style.display = "block";
            banner.innerHTML = `
                <strong>Network Error:</strong> Unable to reach medicine search service. Please check your connection.
            `;
        }
    } finally {
        if (searchButton) {
            searchButton.disabled = false;
        }
    }
}


/**
 * Render External Medicine Details Card
 */
function renderExternalCard(info) {
    const card = document.getElementById("external-medicine-card");
    if (!card) return;

    const nameEl = document.getElementById("ext-medicine-name");
    const badgeEl = document.getElementById("ext-source-badge");
    const compEl = document.getElementById("ext-composition");
    const descEl = document.getElementById("ext-description");
    const ageEl = document.getElementById("ext-age-info");
    const sourcesContainer = document.getElementById("ext-sources-container");
    const sourcesList = document.getElementById("ext-sources-list");

    if (nameEl) nameEl.textContent = info.medicine_name || "-";
    if (badgeEl) badgeEl.textContent = info.source || "Gemini + Google Search";
    if (compEl) compEl.textContent = info.composition || "Not available";
    if (descEl) descEl.textContent = info.description || "Not available";
    if (ageEl) ageEl.textContent = info.age_information || "Not available";

    if (sourcesContainer && sourcesList) {
        sourcesList.innerHTML = "";
        const sources = info.sources || [];

        if (sources.length > 0) {
            sources.forEach(function (src) {
                const url = (src.url || "").trim();
                const title = (src.title || url).trim();

                // Safe URL check: only http:// and https:// links allowed
                if (url.startsWith("http://") || url.startsWith("https://")) {
                    const link = document.createElement("a");
                    link.href = url;
                    link.target = "_blank";
                    link.rel = "noopener noreferrer";
                    link.className = "source-link-pill";
                    link.textContent = title;
                    sourcesList.appendChild(link);
                }
            });
            sourcesContainer.style.display = "block";
        } else {
            sourcesContainer.style.display = "none";
        }
    }

    card.style.display = "block";
}


/**
 * Sanitize text to prevent HTML injection (XSS)
 */
function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// Connect search input and button on DOM load
document.addEventListener("DOMContentLoaded", function () {
    const searchInput = document.getElementById("medicine-search");
    const searchButton = document.getElementById("search-button");

    if (searchButton && searchInput) {
        searchButton.addEventListener("click", function () {
            searchMedicine(searchInput.value);
        });

        searchInput.addEventListener("keydown", function (event) {
            if (event.key === "Enter") {
                searchMedicine(searchInput.value);
            }
        });
    }
});