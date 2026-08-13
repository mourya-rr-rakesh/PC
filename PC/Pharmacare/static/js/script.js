(() => {
  // Early load indicator (helps detect if script.js is even executed)
  try {
    console.log('[script.js] executing top-level');
    const s = document.getElementById('appStatus');
    if (s) { s.textContent = 'JS: loaded'; s.style.background = '#E0F2FE'; s.style.color = '#0C4A6E'; }
  } catch (err) { console.error('[script.js] early init failed', err); }

  const FIVE_MONTHS = 5;

  // DOM helpers
  const $ = id => document.getElementById(id);
  const searchEl = $('search');
  const medListTbody = $('medList');
  const totalCountEl = $('totalCount');
  const soonCountEl = $('soonCount');
  const lastUpdatedEl = $('lastUpdated');

  let medicines = [];
  let showOnlySoon = false;
  let sortColumn = 'expDate';
  let sortDirection = 'asc';

  // utils
  function escapeHtml(s) { return String(s || '').replaceAll('&', '&amp;').replaceAll('<', '<').replaceAll('>', '>'); }
  function formatDate(dStr) { if (!dStr) return '—'; const d = new Date(dStr); if (isNaN(d)) return '—'; const month = d.toLocaleString('default', { month: 'long' }); const year = d.getFullYear(); return `${month},${year}`; }
  function isExpired(expiry) {
    if (!expiry) return false;
    const e = new Date(expiry); e.setHours(0, 0, 0, 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return e < today;
  }
  function withinMonths(expiry, months) {
    if (!expiry) return false;
    const e = new Date(expiry); e.setHours(0, 0, 0, 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const threshold = new Date(today); threshold.setMonth(threshold.getMonth() + months);
    return e >= today && e <= threshold;
  }

  function parsePackQty(pack) {
    if (!pack) return 1;
    const p = String(pack).trim().toLowerCase();
    const stripMatch = p.match(/(\d+)\s*[x×]\s*(\d+)/);
    if (stripMatch) {
      return parseInt(stripMatch[1]) * parseInt(stripMatch[2]);
    }
    if (/\b(ml|l\b|litre|liter|g\b|gram|kg|oz|lb)\b/.test(p)) {
      return 1;
    }
    const countMatch = p.match(/^(\d+)\s*(tab|cap|vial|ampoule|ampule|dose|patch|piece|pc|unit)/);
    if (countMatch) return parseInt(countMatch[1]);
    const soloNum = p.match(/^(\d+)$/);
    if (soloNum) return parseInt(soloNum[1]);
    return 1;
  }

  // Global error & promise handlers (show in-page) for easier debugging
  window.addEventListener('error', function (ev) {
    try {
      console.error('[window.error]', ev.message, ev.error);
      const s = document.getElementById('appStatus');
      if (s) {
        s.textContent = 'JS ERROR: ' + (ev && ev.message ? ev.message : 'unknown');
        s.style.background = '#FECACA'; s.style.color = '#7F1D1D';
      }
    } catch (e) { /* ignore */ }
  });
  window.addEventListener('unhandledrejection', function (ev) {
    console.error('[unhandledrejection]', ev.reason);
    const s = document.getElementById('appStatus');
    if (s) {
      s.textContent = 'Promise Rejection: ' + (ev.reason && ev.reason.message ? ev.reason.message : String(ev.reason));
      s.style.background = '#FECACA'; s.style.color = '#7F1D1D';
    }
  });

  // Try to infer creation time from common fields (createdAt or Mongo ObjectId)
  function getCreatedAt(m) {
    if (!m) return 0;
    // Prefer explicit createdAt if available
    if (m.createdAt) {
      const t = Date.parse(m.createdAt);
      if (!isNaN(t)) return t;
    }

    // Handle string ObjectId (first 8 chars are unix timestamp in hex)
    try {
      let id = m._id;
      if (!id && m._id && m._id.$oid) id = m._id.$oid;
      if (typeof id === 'object' && id.toString) id = id.toString();
      if (typeof id === 'string' && id.length >= 8) {
        const ts = parseInt(id.substr(0, 8), 16);
        if (!isNaN(ts)) return ts * 1000; // convert to ms
      }
    } catch (e) {
      // ignore
    }

    // Fallbacks
    if (m.mfgDate) {
      const t = Date.parse(m.mfgDate);
      if (!isNaN(t)) return t;
    }
    if (m.expDate) {
      const t = Date.parse(m.expDate);
      if (!isNaN(t)) return t;
    }
    return 0;
  }

  // Get last used time from medicine object
  function getLastUsed(m) {
    if (!m) return 0;
    if (m.used_at) {
      const t = Date.parse(m.used_at);
      if (!isNaN(t)) return t;
    }
    if (m.lastUsed) {
      const t = Date.parse(m.lastUsed);
      if (!isNaN(t)) return t;
    }
    // Fallback to createdAt if lastUsed not available
    return getCreatedAt(m);
  }

  // Fetch medicines from API
  async function loadMedicines() {
    try {
      console.log('[loadMedicines] requesting /medicines');
      const response = await fetch('/medicines', { cache: 'no-store', credentials: 'include' });
      console.log('[loadMedicines] response status', response.status);
      if (response.status === 401) {
        // User not authenticated, redirect to login
        window.location.href = '/login.html';
        return [];
      }
      if (!response.ok) throw new Error('Failed to fetch medicines');
      const data = await response.json();
      medicines = (data && data.medicines) ? data.medicines : (Array.isArray(data) ? data : (data && data.medicines) ? data.medicines : []);
      console.log('[loadMedicines] loaded medicines:', medicines.length, 'sample:', medicines[0] || {});
      return medicines;
    } catch (error) {
      console.error('Error loading medicines:', error);
      alert('Failed to load medicines. Please try again.');
      return [];
    }
  }

  // Add medicine
  async function addMedicine(medicineData) {
    try {
      const response = await fetch('/medicines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(medicineData),
        credentials: 'include'
      });
      if (!response.ok) {
        let errorMessage = 'Failed to add medicine';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch (e) {
          // If response body is empty or invalid JSON, use default message
          console.error('Failed to parse error response:', e);
        }
        throw new Error(errorMessage);
      }
      const data = await response.json();
      alert('Medicine added successfully!');
      // notify other tabs/pages that medicines changed
      try { localStorage.setItem('medicines_updated_at', Date.now()); } catch (e) { console.warn('localStorage not available', e); }
      await loadMedicines(); // Refresh the list
      renderList();
      updateDashboard();
      return data;
    } catch (error) {
      console.error('Error adding medicine:', error);
      alert('Failed to add medicine: ' + error.message);
    }
  }

  // Update medicine
  async function updateMedicine(id, medicineData) {
    try {
      console.log('[updateMedicine] Updating medicine with id:', id, 'Data:', medicineData);
      // Add lastUsed timestamp for update
      medicineData.lastUsed = new Date().toISOString();
      const response = await fetch(`/medicines/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(medicineData),
        credentials: 'include'
      });
      if (!response.ok) {
        let errorMessage = 'Failed to update medicine';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch (e) {
          console.error('Failed to parse error response:', e);
        }
        throw new Error(errorMessage);
      }
      const result = await response.json();
      console.log('[updateMedicine] Success response:', result);
      alert('Medicine updated successfully!');
      await loadMedicines(); // Refresh the list
      renderList();

      // Reset save button state
      const saveBtn = $('saveBtn');
      if (saveBtn && saveBtn.dataset.editId === id) {
        delete saveBtn.dataset.editId;
        saveBtn.textContent = '💾 Save Medicine';
      }
    } catch (error) {
      console.error('Error updating medicine:', error);
      alert('Failed to update medicine: ' + error.message);
    }
  }

  // Delete medicine
  async function deleteMedicine(id) {
    if (!confirm('Are you sure you want to delete this medicine?')) return;
    try {
      const response = await fetch(`/medicines/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!response.ok) {
        let errorMessage = 'Failed to delete medicine';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch (e) {
          console.error('Failed to parse error response:', e);
        }
        throw new Error(errorMessage);
      }
      alert('Medicine deleted successfully!');
      await loadMedicines(); // Refresh the list
      renderList();
    } catch (error) {
      console.error('Error deleting medicine:', error);
      alert('Failed to delete medicine: ' + error.message);
    }
  }

  // Search medicines
  async function searchMedicines(query) {
    try {
      const response = await fetch(`/medicines/search?q=${encodeURIComponent(query)}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        let errorMessage = 'Failed to search medicines';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch (e) {
          console.error('Failed to parse error response:', e);
        }
        throw new Error(errorMessage);
      }
      const data = await response.json();
      medicines = data.medicines || [];
      renderList();
    } catch (error) {
      console.error('Error searching medicines:', error);
      alert('Failed to search medicines. Please try again.');
    }
  }

  // Export medicines
  function exportMedicines() {
    window.open('/medicines/export', '_blank');
  }

  // Check for expiry alerts
  function checkExpiryAlerts() {
    const soonExpiring = medicines.filter(m => !isExpired(m.expDate) && withinMonths(m.expDate, FIVE_MONTHS));
    if (soonExpiring.length > 0) {
      const names = soonExpiring.map(m => m.name).join(', ');
      alert(`🔔 Warning: Some medicines will expire soon!\n\n${names}`);
    }
  }


  // Place order
  async function placeOrder(medicineId, quantity) {
    try {
      const response = await fetch('/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medicineId, quantity })
      });
      if (!response.ok) {
        let errorMessage = 'Failed to place order';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch (e) {
          console.error('Failed to parse error response:', e);
        }
        throw new Error(errorMessage);
      }
      const data = await response.json();
      alert('Order placed successfully!');
      return data;
    } catch (error) {
      console.error('Error placing order:', error);
      alert('Failed to place order: ' + error.message);
    }
  }

  // render table
  function renderList(filterText = '') {
    console.log('[renderList] Called with filterText:', filterText);
    let list = medicines.slice();

    // If we're on the dashboard page, show most recently used medicines and limit to 10
    const isDashboard = window.location.pathname && window.location.pathname.toLowerCase().includes('dashboard.html');
    if (isDashboard) {
      list.sort((a, b) => getLastUsed(b) - getLastUsed(a));
    } else {
      // Default: sort by expiry (soonest first)
      list.sort((a, b) => {
        const A = a.expDate ? new Date(a.expDate).getTime() : Infinity;
        const B = b.expDate ? new Date(b.expDate).getTime() : Infinity;
        return A - B;
      });
    }

    if (filterText) {
      const q = filterText.toLowerCase();
      list = list.filter(m => (m.name || '').toLowerCase().includes(q) || (m.composition || '').toLowerCase().includes(q));
    }

    if (showOnlySoon) {
      list = list.filter(m => !isExpired(m.expDate) && withinMonths(m.expDate, FIVE_MONTHS));
    }

    // If dashboard, limit to latest 10 and update the registered note
    if (isDashboard) {
      const totalCount = medicines.length; // use full dataset count
      list = list.slice(0, 10);
      const regNote = document.getElementById('registeredNote');
      if (regNote) {
        regNote.innerHTML = `Showing <strong>${list.length}</strong> of <strong>${totalCount}</strong> medicines (latest). <a href="total-medicines.html" class="text-green-600 hover:underline">View all</a>`;
      }
    }

    if (!medListTbody) {
      console.error('[renderList] medListTbody not found in DOM');
      return;
    }

    medListTbody.innerHTML = '';
    console.log('[renderList] Rendering', list.length, 'medicines');

    for (const m of list) {
      const tr = document.createElement('tr');
      tr.dataset.id = String(m._id.$oid || m._id);
      if (isExpired(m.expDate)) tr.classList.add('expired');
      else if (withinMonths(m.expDate, FIVE_MONTHS)) tr.classList.add('soon');

      const packQty = parsePackQty(m.pack);
      const totalUnits = (m.stock != null ? m.stock : 0) * packQty;
      const stockDisplay = packQty > 1 ? `${m.stock} packs<br><small style="color:var(--muted);">(${totalUnits} units)</small>` : `${m.stock}`;

      const cells = [
        { label: 'Name', value: escapeHtml(m.name) },
        { label: 'Type', value: escapeHtml(m.type || '—') },
        { label: 'Composition', value: escapeHtml(m.composition || '—') },
        { label: 'Pack', value: escapeHtml(m.pack || '—') },
        { label: 'Mfg Date', value: formatDate(m.mfgDate) },
        { label: 'Exp Date', value: formatDate(m.expDate) },
        { label: 'MRP', value: m.mrp != null ? Number(m.mrp).toFixed(2) : '—' },
        { label: 'Buy Price', value: m.buyPrice != null ? Number(m.buyPrice).toFixed(2) : '—' },
        { label: 'Sell Price', value: m.sellPrice != null ? Number(m.sellPrice).toFixed(2) : '—' },
        { label: 'Stock', value: stockDisplay }
      ];

      for (const c of cells) {
        const td = document.createElement('td');
        td.setAttribute('data-label', c.label);
        td.className = 'px-4 py-2 align-top';
        const span = document.createElement('span');
        span.innerHTML = c.value;
        td.appendChild(span);
        tr.appendChild(td);
      }

      // Actions cell
      const actionsTd = document.createElement('td');
      actionsTd.setAttribute('data-label', 'Actions');
      actionsTd.className = 'px-4 py-2 align-top';

      const editBtn = document.createElement('button');
      editBtn.className = 'edit-btn bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600 mr-1';
      editBtn.style.display = 'inline-flex';
      editBtn.style.marginRight = '8px';
      editBtn.id = `edit-btn-${m._id}`;
      editBtn.type = 'button';
      editBtn.textContent = 'Edit';
      editBtn.title = `Edit ${m.name}`;
      // Attach edit handler with closure over medicine object
      editBtn.addEventListener('click', function (e) {
        console.log('[script.js] Edit button event triggered for medicine:', m.name);
        console.log('[script.js] Medicine object:', m);
        console.log('[script.js] Medicine._id:', m._id);
        console.log('[script.js] Event target:', e.target);
        editMedicine(m);
      });
      console.log('[renderList] Created edit button for:', m.name);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 mr-1';
      deleteBtn.style.display = 'inline-flex';
      deleteBtn.style.marginRight = '8px';
      deleteBtn.dataset.id = m._id;
      deleteBtn.type = 'button';
      deleteBtn.textContent = 'Delete';
      // Attach delete handler
      deleteBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        deleteMedicine(m._id);
      });

      const orderBtn = document.createElement('button');
      orderBtn.className = 'order-btn bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600';
      orderBtn.style.display = 'inline-flex';
      orderBtn.style.marginRight = '8px';
      orderBtn.type = 'button';
      orderBtn.dataset.id = m._id;
      orderBtn.textContent = 'Order';
      // Attach order handler
      orderBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const quantity = prompt('Enter quantity:');
        if (quantity && !isNaN(quantity) && quantity > 0) {
          placeOrder(m._id, parseInt(quantity));
        }
      });

      actionsTd.appendChild(editBtn);
      actionsTd.appendChild(deleteBtn);
      actionsTd.appendChild(orderBtn);
      tr.appendChild(actionsTd);

      medListTbody.appendChild(tr);
    }

    console.log('[renderList] Finished rendering. Added', list.length, 'rows with edit buttons to table');
    updateDashboard();
  }

  // Edit medicine - redirect to dashboard with medicine data or populate form
  function editMedicine(medicine) {
    console.log('[editMedicine] Called with medicine:', medicine);

    if (!medicine) {
      console.error('[editMedicine] No medicine object provided');
      alert('Error: No medicine data found');
      return;
    }

    // Check if we're on dashboard (has form) or another page (needs redirect)
    const nameInput = $('name');
    if (!nameInput) {
      console.log('[editMedicine] Form not found, redirecting to dashboard');
      // Store medicine data in localStorage for dashboard to pick up
      localStorage.setItem('edit_medicine', JSON.stringify(medicine));
      localStorage.setItem('edit_mode', 'true');
      window.location.href = '/dashboard.html';
      return;
    }

    // We're on dashboard, populate the form
    console.log('[editMedicine] Populating form with medicine:', medicine);
    console.log('[editMedicine] Medicine._id:', medicine._id);
    console.log('[editMedicine] Medicine.name:', medicine.name);

    nameInput.value = medicine.name || '';
    console.log('[editMedicine] Set nameInput.value:', nameInput.value);

    $('composition').value = medicine.composition || '';
    console.log('[editMedicine] Set composition:', medicine.composition);

    $('mfgDate').value = medicine.mfgDate ? new Date(medicine.mfgDate).toISOString().slice(0, 7) : '';
    console.log('[editMedicine] Set mfgDate:', $('mfgDate').value);

    $('expDate').value = medicine.expDate ? new Date(medicine.expDate).toISOString().slice(0, 7) : '';
    console.log('[editMedicine] Set expDate:', $('expDate').value);

    $('mrp').value = medicine.mrp || '';
    console.log('[editMedicine] Set mrp:', medicine.mrp);

    $('buyPrice').value = medicine.buyPrice || '';
    console.log('[editMedicine] Set buyPrice:', medicine.buyPrice);

    $('sellPrice').value = medicine.sellPrice || '';
    console.log('[editMedicine] Set sellPrice:', medicine.sellPrice);

    $('type').value = medicine.type || '';
    console.log('[editMedicine] Set type:', medicine.type);

    if (medicine.type) {
      updatePackOptions();
    }

    const packEl = $('pack');
    if (packEl) {
      packEl.value = medicine.pack || '';
      console.log('[editMedicine] Set pack:', medicine.pack);
    }

    const placeEl = $('place');
    if (placeEl) {
      placeEl.value = medicine.place || '';
      console.log('[editMedicine] Set place:', medicine.place);
    }

    const stockEl = $('stock');
    if (stockEl) {
      stockEl.value = medicine.stock || '';
      console.log('[editMedicine] Set stock:', medicine.stock);
    }

    // Change save button to update
    const saveBtn = $('saveBtn');
    if (!saveBtn) {
      console.error('[editMedicine] saveBtn not found in DOM');
      return;
    }

    saveBtn.textContent = '💾 Update Medicine';
    saveBtn.dataset.editId = medicine._id;
    console.log('[editMedicine] Set editId on button:', medicine._id);
    console.log('[editMedicine] Button text changed to:', saveBtn.textContent);

    // Scroll to form
    const medForm = document.getElementById('medForm');
    if (medForm) {
      medForm.scrollIntoView({ behavior: 'smooth' });
      console.log('[editMedicine] Scrolled to form');
    }
  }

  function updateDashboard() {
    const totalCountLocal = document.getElementById('totalCount');
    if (totalCountLocal) totalCountLocal.textContent = (medicines && medicines.length) ? medicines.length : 0;

    const soonCountLocal = document.getElementById('soonCount');
    if (soonCountLocal) soonCountLocal.textContent = medicines.filter(m => !isExpired(m.expDate) && withinMonths(m.expDate, FIVE_MONTHS)).length;

    const lastUpdatedLocal = document.getElementById('lastUpdated');
    if (lastUpdatedLocal) lastUpdatedLocal.textContent = new Date().toLocaleString();

    // Calculate total profit
    const totalProfit = medicines.reduce((sum, m) => {
      if (m.sellPrice && m.buyPrice && m.stock) {
        return sum + ((m.sellPrice - m.buyPrice) * m.stock);
      }
      return sum;
    }, 0);
    const profitEl = document.getElementById('totalProfit');
    if (profitEl) profitEl.textContent = `₹${totalProfit.toFixed(2)}`;
  }

  // events
  if (searchEl) {
    searchEl.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      if (query) {
        searchMedicines(query);
      } else {
        renderList();
      }
    });
  }

  // Import sample data
  async function importSampleData() {
    if (!confirm('This will DELETE all existing medicines for your account and import sample data. Proceed?')) return;
    try {
      // Clear existing medicines for this user (delete each by id)
      const ids = medicines.map(m => {
        if (!m || !m._id) return null;
        if (typeof m._id === 'string') return m._id;
        if (m._id.$oid) return m._id.$oid;
        try { return m._id.toString(); } catch (e) { return null; }
      }).filter(Boolean);

      if (ids.length > 0) {
        await Promise.all(ids.map(id => fetch(`/medicines/${id}`, { method: 'DELETE', credentials: 'include' })));
      }

      // Prepare sample medicines for current user
      const sampleMedicines = [
        { name: 'Aspirin', composition: 'Pain reliever', mfgDate: '2023-01-01', expDate: '2025-12-31', mrp: 5.99, buyPrice: 4.79, sellPrice: 7.19, stock: 100 },
        { name: 'Ibuprofen', composition: 'Anti-inflammatory', mfgDate: '2023-01-01', expDate: '2025-12-31', mrp: 7.49, buyPrice: 5.99, sellPrice: 8.99, stock: 50 },
        { name: 'Paracetamol', composition: 'Fever reducer', mfgDate: '2023-01-01', expDate: '2025-12-31', mrp: 4.99, buyPrice: 3.99, sellPrice: 5.99, stock: 200 }
      ];

      // Bulk import into per-user medicines collection
      const res = await fetch('/medicines/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medicines: sampleMedicines })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert('Failed to import sample data: ' + (err.error || res.statusText));
        return;
      }

      alert('Sample data imported successfully.');
      await loadMedicines();
      renderList();
    } catch (error) {
      console.error('Error importing sample data:', error);
      alert('Failed to import sample data: ' + (error && error.message ? error.message : error));
    }
  }

  // Import from Excel/CSV file
  async function importFromFile(file) {
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/medicines/import', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert('Failed to import file: ' + (err.error || res.statusText));
        return;
      }
      const data = await res.json();
      alert(data.message);
      await loadMedicines();
      renderList();
    } catch (err) {
      console.error('Failed to import file', err);
      alert('Failed to import file: ' + err.message);
    }
  }

  // Create datalists for autocomplete
  function createDatalists() {
    try {
      const medicineNamesDatalist = document.getElementById('medicineNames');

      if (medicineNamesDatalist && window.medicineNames && Array.isArray(window.medicineNames)) {
        window.medicineNames.forEach(name => {
          const option = document.createElement('option');
          option.value = name;
          medicineNamesDatalist.appendChild(option);
        });
      }
    } catch (err) {
      console.warn('[createDatalists] error:', err);
    }
  }

  // Multi-value autocomplete for composition
  function setupCompositionAutocomplete() {
    try {
      const compositionInput = $('composition');
      const suggestionsDiv = $('compositionSuggestions');

      if (!compositionInput || !suggestionsDiv || !window.compositionNames) return;

      let currentFocus = -1;

      function showSuggestions(val, currentPart) {
        closeAllLists();

        let suggestions;
        if (currentPart) {
          suggestions = window.compositionNames.filter(comp =>
            comp.toLowerCase().includes(currentPart.toLowerCase())
          ).slice(0, 10);
        } else {
          suggestions = window.compositionNames.slice(0, 10);
        }

        if (suggestions.length === 0) return false;

        suggestionsDiv.innerHTML = '';
        suggestionsDiv.classList.remove('hidden');

        suggestions.forEach((suggestion) => {
          const div = document.createElement('div');
          if (currentPart) {
            div.innerHTML = `<strong>${suggestion.substr(0, currentPart.length)}</strong>${suggestion.substr(currentPart.length)}`;
          } else {
            div.innerHTML = suggestion;
          }
          div.className = 'px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600';
          div.addEventListener('click', function () {
            const lastCommaIndex = val.lastIndexOf(',');
            let newValue;
            if (lastCommaIndex === -1) {
              newValue = suggestion;
            } else {
              newValue = val.substring(0, lastCommaIndex + 1) + ' ' + suggestion;
            }
            compositionInput.value = newValue + ', ';
            closeAllLists();
            compositionInput.focus();
          });
          suggestionsDiv.appendChild(div);
        });
      }

      compositionInput.addEventListener('focus', function () {
        const val = this.value;
        const lastCommaIndex = val.lastIndexOf(',');
        const currentPart = lastCommaIndex === -1 ? val : val.substring(lastCommaIndex + 1).trim();
        if (!val.trim()) {
          showSuggestions(val, currentPart);
        }
      });

      compositionInput.addEventListener('input', function (e) {
        const val = this.value;
        const lastCommaIndex = val.lastIndexOf(',');
        const currentPart = lastCommaIndex === -1 ? val : val.substring(lastCommaIndex + 1).trim();
        if (currentPart.length >= 0) {
          showSuggestions(val, currentPart);
        }
      });

      compositionInput.addEventListener('keydown', function (e) {
        const items = suggestionsDiv.getElementsByTagName('div');
        if (e.keyCode === 40) {
          currentFocus++;
          addActive(items);
        } else if (e.keyCode === 38) {
          currentFocus--;
          addActive(items);
        } else if (e.keyCode === 13) {
          e.preventDefault();
          if (currentFocus > -1 && items[currentFocus]) {
            items[currentFocus].click();
          }
        }
      });

      function addActive(items) {
        if (!items) return false;
        removeActive(items);
        if (currentFocus >= items.length) currentFocus = 0;
        if (currentFocus < 0) currentFocus = items.length - 1;
        items[currentFocus].classList.add('bg-gray-100', 'dark:bg-gray-600');
      }

      function removeActive(items) {
        for (let i = 0; i < items.length; i++) {
          items[i].classList.remove('bg-gray-100', 'dark:bg-gray-600');
        }
      }

      function closeAllLists() {
        suggestionsDiv.classList.add('hidden');
        currentFocus = -1;
      }

      document.addEventListener('click', function (e) {
        if (e.target !== compositionInput) {
          closeAllLists();
        }
      });
    } catch (err) {
      console.warn('[setupCompositionAutocomplete] error:', err);
    }
  }



  // Medicine form handler
  function handleSaveMedicine() {
    try {
      const saveBtn = $('saveBtn');
      if (!saveBtn) {
        console.warn('[handleSaveMedicine] saveBtn not found');
        return;
      }

      saveBtn.addEventListener('click', async () => {
        const stockEl = $('stock');

        // Convert month format (YYYY-MM) to date format (YYYY-MM-01)
        const mfgMonthVal = $('mfgDate').value;
        const expMonthVal = $('expDate').value;
        const mfgDateStr = mfgMonthVal ? mfgMonthVal + '-01' : '';
        const expDateStr = expMonthVal ? expMonthVal + '-01' : '';

        const medicineData = {
          name: $('name').value.trim(),
          composition: $('composition').value.trim(),
          type: $('type').value.trim(),
          pack: $('pack') ? $('pack').value.trim() : '',
          place: $('place') ? $('place').value.trim() : '',
          mfgDate: mfgDateStr,
          expDate: expDateStr,
          mrp: parseFloat($('mrp').value) || 0,
          buyPrice: parseFloat($('buyPrice').value) || 0,
          sellPrice: parseFloat($('sellPrice').value) || 0,
          stock: stockEl ? parseInt(stockEl.value) || 0 : 0,
          lastUsed: new Date().toISOString()
        };

        console.debug('Save Medicine clicked. Data:', medicineData);

        // Basic validation
        if (!medicineData.name || !medicineData.expDate) {
          alert('Name and expiry date are required!');
          console.warn('Validation failed: name or expDate missing');
          return;
        }

        // Validate dates - they should be in YYYY-MM-DD format
        if (medicineData.mfgDate) {
          const mfgDateObj = new Date(medicineData.mfgDate);
          if (isNaN(mfgDateObj.getTime())) {
            alert('Invalid manufacture date!');
            console.warn('Validation failed: invalid mfgDate', medicineData.mfgDate);
            return;
          }
        }

        const expDateObj = new Date(medicineData.expDate);
        if (isNaN(expDateObj.getTime())) {
          alert('Invalid expiry date!');
          console.warn('Validation failed: invalid expDate', medicineData.expDate);
          return;
        }

        // Additional date validations
        const mfgDate = medicineData.mfgDate ? new Date(medicineData.mfgDate) : null;
        const expDate = new Date(medicineData.expDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (mfgDate) {
          mfgDate.setHours(0, 0, 0, 0);
          if (mfgDate >= expDate) {
            alert('Manufacturing date must be before expiry date!');
            return;
          }
        }

        expDate.setHours(0, 0, 0, 0);
        if (expDate <= today) {
          alert('Expiry date must be in the future!');
          return;
        }

        try {
          const editId = saveBtn.dataset.editId;
          console.log('[handleSaveMedicine] saveBtn.dataset.editId:', editId);

          if (editId) {
            // Update existing medicine
            console.log('Updating medicine with id:', editId);
            await updateMedicine(editId, medicineData);
            delete saveBtn.dataset.editId;
            saveBtn.textContent = '💾 Save Medicine';
          } else {
            // Add new medicine
            console.log('Adding new medicine');
            await addMedicine(medicineData);
          }

          // Clear form after save
          console.log('Clearing form inputs after save');
          $('name').value = '';
          $('composition').value = '';
          $('type').value = '';
          if ($('pack')) {
            $('pack').value = '';
          }
          $('buyPrice').value = '';
          $('sellPrice').value = '';
          if (stockEl) stockEl.value = '';

          // Scroll back to top or list
          medListTbody.scrollIntoView({ behavior: 'smooth' });
        } catch (error) {
          console.error('Error saving medicine:', error);
          alert('An error occurred while saving the medicine. Please check console for details.');
        }
      });
    } catch (err) {
      console.error('[handleSaveMedicine] initialization error:', err);
    }
  }

  // Reset form handler
  function handleResetForm() {
    try {
      const resetBtn = $('resetBtn');
      if (!resetBtn) {
        console.warn('[handleResetForm] resetBtn not found');
        return;
      }

      resetBtn.addEventListener('click', () => {
        $('name').value = '';
        $('composition').value = '';
        $('type').value = '';
        if ($('pack')) {
          $('pack').value = '';
        }
        if ($('place')) {
          $('place').value = '';
        }
        $('mfgDate').value = '';
        $('expDate').value = '';
        $('mrp').value = '';
        $('buyPrice').value = '';
        $('sellPrice').value = '';
        const stockEl = $('stock');
        if (stockEl) stockEl.value = '';

        const saveBtn = $('saveBtn');
        if (saveBtn && saveBtn.dataset.editId) {
          delete saveBtn.dataset.editId;
          saveBtn.textContent = '💾 Save Medicine';
        }
      });
    } catch (err) {
      console.error('[handleResetForm] initialization error:', err);
    }
  }

  // Toggle view to show only soon expiring medicines
  function toggleSoonView() {
    showOnlySoon = !showOnlySoon;
    renderList();
  }

  // Sorting helper: sorts medicines by the given column and toggles direction
  function sortMedicines(column) {
    if (!column) return;
    if (sortColumn === column) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = column;
      sortDirection = 'asc';
    }

    medicines.sort((a, b) => {
      const A = a[column] != null ? (typeof a[column] === 'string' ? a[column].toLowerCase() : a[column]) : '';
      const B = b[column] != null ? (typeof b[column] === 'string' ? b[column].toLowerCase() : b[column]) : '';

      if (column === 'expDate' || column === 'mfgDate') {
        const ta = a[column] ? new Date(a[column]).getTime() : 0;
        const tb = b[column] ? new Date(b[column]).getTime() : 0;
        return sortDirection === 'asc' ? ta - tb : tb - ta;
      }

      if (A < B) return sortDirection === 'asc' ? -1 : 1;
      if (A > B) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    renderList();
  }

  // Make toggleSoonView and sortMedicines global
  window.toggleSoonView = toggleSoonView;
  window.sortMedicines = sortMedicines;

  // Initialize app: wire UI handlers and load data. Made robust to run even if DOMContentLoaded already fired.
  async function initApp() {
    try {
      console.log('[initApp] starting initialization');

      // Setup handlers with individual error handling
      try {
        createDatalists();
      } catch (err) {
        console.error('[initApp] createDatalists failed:', err);
      }

      try {
        setupCompositionAutocomplete();
      } catch (err) {
        console.error('[initApp] setupCompositionAutocomplete failed:', err);
      }

      try {
        handleSaveMedicine();
      } catch (err) {
        console.error('[initApp] handleSaveMedicine failed:', err);
      }

      try {
        handleResetForm();
      } catch (err) {
        console.error('[initApp] handleResetForm failed:', err);
      }

      console.log('[initApp] handlers wired: saveBtn?', !!document.getElementById('saveBtn'), 'resetBtn?', !!document.getElementById('resetBtn'));
      // Update in-page status
      try {
        const s = document.getElementById('appStatus');
        if (s) { s.textContent = 'JS: init OK'; s.style.background = '#DCFCE7'; s.style.color = '#064E3B'; }
      } catch (e) { /* ignore */ }

      // Global click debugging: shows last clicked element id/tag in the status area and logs to console
      document.addEventListener('click', (e) => {
        try {
          const id = (e.target && e.target.id) ? e.target.id : (e.target && e.target.tagName) ? e.target.tagName : 'unknown';
          console.log('[global click]', id, e.target);
          const s = document.getElementById('appStatus');
          if (s) s.textContent = 'Last click: ' + id;
        } catch (err) { console.error('click-debug failed', err); }
      });


      // Prevent accidental form submit (Enter key) from reloading the page
      const medForm = document.getElementById('medForm');
      if (medForm) {
        medForm.addEventListener('submit', (e) => {
          e.preventDefault();
        });
      }

      // file import wiring
      const importFileBtn = document.getElementById('importFileBtn');
      const importFileInput = document.getElementById('importFileInput');
      if (importFileBtn && importFileInput) {
        importFileBtn.addEventListener('click', () => importFileInput.click());
        importFileInput.addEventListener('change', (e) => {
          const f = e.target.files && e.target.files[0];
          if (f) importFromFile(f);
          // clear input value so same file can be selected again
          importFileInput.value = '';
        });
      }

      const exportBtnEl = document.getElementById('exportBtn');
      if (exportBtnEl) exportBtnEl.addEventListener('click', () => {
        try { exportBtnEl.disabled = true; exportMedicines(); } catch (e) { console.error('Export failed', e); } finally { exportBtnEl.disabled = false; }
      });

      const clearBtnEl = document.getElementById('clearBtn');
      if (clearBtnEl) clearBtnEl.addEventListener('click', async () => {
        // Clear all medicines by deleting each entry via API
        if (!confirm('Are you sure you want to clear ALL medicines? This cannot be undone.')) return;
        try {
          clearBtnEl.disabled = true;
          // Build a list of ids safely
          const ids = medicines.map(m => {
            if (!m || !m._id) return null;
            if (typeof m._id === 'string') return m._id;
            if (m._id.$oid) return m._id.$oid;
            try { return m._id.toString(); } catch (e) { return null; }
          }).filter(Boolean);

          if (ids.length === 0) {
            alert('No medicines found to clear.');
            return;
          }

          await Promise.all(ids.map(id => fetch(`/medicines/${id}`, { method: 'DELETE', credentials: 'include' })));
          alert('All medicines cleared');
          await loadMedicines();
          renderList();
        } catch (err) {
          console.error('Error clearing medicines:', err);
          alert('Failed to clear medicines. See console for details.');
        } finally {
          clearBtnEl.disabled = false;
        }
      });

      const sellAllBtnEl = document.getElementById('sellAllBtn');
      if (sellAllBtnEl) sellAllBtnEl.addEventListener('click', async () => {
        if (medicines.length === 0) {
          alert('No medicines available to sell.');
          return;
        }

        try {
          sellAllBtnEl.disabled = true;

          // Calculate total sale amount
          let totalAmount = 0;
          let totalItems = 0;
          const receipt = [];

          for (const medicine of medicines) {
            const quantity = medicine.stock || 0;
            const sellPrice = medicine.sellPrice || 0;
            const itemTotal = quantity * sellPrice;

            totalAmount += itemTotal;
            totalItems += quantity;

            receipt.push({
              name: medicine.name,
              quantity: quantity,
              price: sellPrice,
              total: itemTotal
            });
          }

          // Generate receipt
          let receiptText = `========== SALE RECEIPT ==========\n`;
          receiptText += `Date: ${new Date().toLocaleString()}\n`;
          receiptText += `\n--- Items Sold ---\n`;

          for (const item of receipt) {
            receiptText += `${item.name}\n`;
            receiptText += `  Qty: ${item.quantity} × ₹${item.price.toFixed(2)} = ₹${item.total.toFixed(2)}\n`;
          }

          receiptText += `\n--- Summary ---\n`;
          receiptText += `Total Items: ${totalItems}\n`;
          receiptText += `Total Amount: ₹${totalAmount.toFixed(2)}\n`;
          receiptText += `================================\n`;

          // Show receipt in prompt
          alert(receiptText);

          // Ask if user wants to proceed with clearing
          if (confirm('Print receipt? (Stock will be cleared after printing)\n\nClick OK to proceed with clearing stock')) {
            // Clear all medicines (set stock to 0 or delete)
            const ids = medicines.map(m => {
              if (!m || !m._id) return null;
              if (typeof m._id === 'string') return m._id;
              if (m._id.$oid) return m._id.$oid;
              try { return m._id.toString(); } catch (e) { return null; }
            }).filter(Boolean);

            await Promise.all(ids.map(id => fetch(`/medicines/${id}`, { method: 'DELETE', credentials: 'include' })));

            // Download receipt as text file
            const element = document.createElement('a');
            element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(receiptText));
            element.setAttribute('download', `receipt_${new Date().toISOString().split('T')[0]}.txt`);
            element.style.display = 'none';
            document.body.appendChild(element);
            element.click();
            document.body.removeChild(element);

            alert('All medicines sold and cleared successfully!');
            await loadMedicines();
            renderList();
          }
        } catch (err) {
          console.error('Error processing sale:', err);
          alert('Failed to process sale. See console for details.');
        } finally {
          sellAllBtnEl.disabled = false;
        }
      });

      const resetSearchBtnEl = document.getElementById('resetSearchBtn');
      if (resetSearchBtnEl) resetSearchBtnEl.addEventListener('click', () => {
        if (searchEl) searchEl.value = '';
        renderList();
      });

      // Try to load medicines and render
      console.log('[script.js] Loading medicines...');
      await loadMedicines();
      console.log('[script.js] Medicines loaded. Count:', medicines.length);

      renderList();
      console.log('[script.js] List rendered');

      // Check if there's an edit request from another page
      const editData = localStorage.getItem('edit_medicine');
      console.log('[script.js] Checking localStorage for edit_medicine:', editData ? 'Found' : 'Not found');

      if (editData) {
        try {
          const medicine = JSON.parse(editData);
          console.log('[script.js] Parsed medicine from localStorage:', medicine.name);
          editMedicine(medicine);
          localStorage.removeItem('edit_medicine'); // Clear it
          console.log('[script.js] Cleared localStorage');
        } catch (e) {
          console.error('Failed to parse edit_medicine:', e);
        }
      }
    } catch (err) {
      console.error('initApp failed:', err);
    }
  }

  // Run initApp immediately if DOM is already ready, otherwise wait for DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    // DOM already parsed
    initApp();
  }
})();
