(() => {
  console.log('[total-medicines.js] Script loaded');
  // Simple test to verify script is executing
  const testEl = document.getElementById('totalMedList');
  console.log('[total-medicines.js] Table element found?', !!testEl);

  // DOM helpers
  const $ = id => document.getElementById(id);
  const totalMedListTbody = $('totalMedList');

  let medicines = [];

  // utils
  function escapeHtml(s) { return String(s || '').replaceAll('&', '&amp;').replaceAll('<', '<').replaceAll('>', '>'); }
  function formatDate(dStr) { if (!dStr) return '—'; const d = new Date(dStr); if (isNaN(d)) return '—'; const month = d.toLocaleString('default', { month: 'long' }); const year = d.getFullYear(); return `${month},${year}`; }
  function parsePackQty(pack) {
    if (!pack) return 1;
    const p = String(pack).trim().toLowerCase();
    const stripMatch = p.match(/(\d+)\s*[x×]\s*(\d+)/);
    if (stripMatch) return parseInt(stripMatch[1]) * parseInt(stripMatch[2]);
    if (/\b(ml|l\b|litre|liter|g\b|gram|kg|oz|lb)\b/.test(p)) return 1;
    const countMatch = p.match(/^(\d+)\s*(tab|cap|vial|ampoule|ampule|dose|patch|piece|pc|unit)/);
    if (countMatch) return parseInt(countMatch[1]);
    const soloNum = p.match(/^(\d+)$/);
    if (soloNum) return parseInt(soloNum[1]);
    return 1;
  }

  // Edit medicine - redirect to dashboard with medicine data
  function editMedicine(medicineObj) {
    try {
      if (!medicineObj) {
        console.error('[total-medicines.js] editMedicine: No medicine object');
        alert('Error: Invalid medicine');
        return;
      }
      console.log('[total-medicines.js] editMedicine: medicine =', medicineObj.name);
      localStorage.setItem('edit_medicine', JSON.stringify(medicineObj));
      localStorage.setItem('edit_mode', 'true');
      console.log('[total-medicines.js] editMedicine: Saved to localStorage, redirecting...');
      window.location.href = '/dashboard.html';
    } catch (error) {
      console.error('[total-medicines.js] editMedicine ERROR:', error);
      alert('Error: ' + error.message);
    }
  }

  // Fetch medicines from API
  async function loadMedicines() {
    try {
      console.log('[total-medicines] requesting /medicines');
      const response = await fetch('/medicines', { cache: 'no-store', credentials: 'include' });
      console.log('[total-medicines] response status', response.status);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        console.error('[total-medicines] API error:', errData);
        throw new Error(errData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[total-medicines] Raw API response:', data);

      medicines = (data && data.medicines) ? data.medicines : (Array.isArray(data) ? data : []);
      console.log('[total-medicines] Parsed medicines count:', medicines.length);

      if (medicines.length === 0) {
        console.warn('[total-medicines] No medicines found! Check if you are logged in.');
        alert('No medicines found. Make sure you are logged in.');
      } else {
        console.log('[total-medicines] Sample medicines:', medicines.slice(0, 3).map(m => ({ name: m.name, id: m._id })));
      }

      renderTotalList();
      return medicines;
    } catch (error) {
      console.error('[total-medicines] Error loading medicines:', error.message);
      alert('Failed to load medicines: ' + error.message);
      return [];
    }
  }

  // Filtering
  let currentFilter = '';

  function setFilter(q) {
    currentFilter = (q || '').trim().toLowerCase();
    renderTotalList();
  }

  function matchesFilter(m) {
    if (!currentFilter) return true;
    const fields = [m.name, m.type, m.composition];
    return fields.some(f => (f || '').toString().toLowerCase().includes(currentFilter));
  }

  // render table for all medicines (responsive stacked cards on small screens)
  function renderTotalList() {
    console.log('[renderTotalList] Starting...');
    if (!totalMedListTbody) {
      console.error('[renderTotalList] Table body not found!');
      return;
    }
    totalMedListTbody.innerHTML = '';

    const list = medicines.slice().filter(matchesFilter).sort((a, b) => ((a.name || '').toLowerCase() > (b.name || '').toLowerCase()) ? 1 : -1);
    console.log('[renderTotalList] Rendering', list.length, 'medicines');

    for (const m of list) {
      const tr = document.createElement('tr');
      tr.dataset.id = m._id;

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

      // EDIT BUTTON - using IIFE for proper closure
      const editBtn = document.createElement('button');
      editBtn.className = 'edit-btn bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600 mr-1';
      editBtn.type = 'button';
      editBtn.textContent = 'Edit';
      editBtn.title = `Edit ${m.name}`;
      (function (medicine) {
        editBtn.addEventListener('click', function (e) {
          e.preventDefault();
          console.log('[Edit button] Clicked for:', medicine.name);
          editMedicine(medicine);
        });
      })(m);

      // DELETE BUTTON
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 mr-1';
      deleteBtn.type = 'button';
      deleteBtn.textContent = 'Delete';
      (function (id) {
        deleteBtn.addEventListener('click', (e) => {
          e.preventDefault();
          deleteMedicine(id);
        });
      })(m._id);

      // ORDER BUTTON
      const orderBtn = document.createElement('button');
      orderBtn.className = 'order-btn bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600';
      orderBtn.type = 'button';
      orderBtn.textContent = 'Order';
      (function (id) {
        orderBtn.addEventListener('click', (e) => {
          e.preventDefault();
          const quantity = prompt('Enter quantity:');
          if (quantity && !isNaN(quantity) && quantity > 0) {
            placeOrder(id, parseInt(quantity));
          }
        });
      })(m._id);

      actionsTd.appendChild(editBtn);
      actionsTd.appendChild(deleteBtn);
      actionsTd.appendChild(orderBtn);
      tr.appendChild(actionsTd);

      totalMedListTbody.appendChild(tr);
    }
    console.log('[renderTotalList] Complete! Added', list.length, 'rows');
  }

  // Delete medicine
  async function deleteMedicine(id) {
    if (!confirm('Are you sure you want to delete this medicine?')) return;
    try {
      const response = await fetch(`/medicines/${id}`, { method: 'DELETE', credentials: 'include' });
      if (response.ok) {
        alert('Medicine deleted successfully.');
        await loadMedicines(); // Reload the list
      } else {
        alert('Failed to delete medicine.');
      }
    } catch (error) {
      console.error('Error deleting medicine:', error);
      alert('Error deleting medicine.');
    }
  }

  // Place order
  async function placeOrder(medicineId, quantity) {
    try {
      const response = await fetch('/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medicineId, quantity }),
        credentials: 'include'
      });
      if (response.ok) {
        alert(`Order placed for ${quantity} units.`);
        await loadMedicines(); // Reload to update stock if needed
      } else {
        alert('Failed to place order.');
      }
    } catch (error) {
      console.error('Error placing order:', error);
      alert('Error placing order.');
    }
  }

  // Initialize on DOM ready
  document.addEventListener('DOMContentLoaded', async () => {
    // Load initial medicines
    await loadMedicines();

    // reload when another tab updates medicines via localStorage event
    window.addEventListener('storage', (e) => {
      if (e.key === 'medicines_updated_at') {
        console.log('[total-medicines] storage event - reloading medicines');
        loadMedicines();
      }
    });

    // wire search input
    const searchInput = document.getElementById('totalSearch');
    const clearBtn = document.getElementById('clearSearch');
    if (searchInput) {
      let t;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(t);
        t = setTimeout(() => setFilter(e.target.value), 250);
      });
      // handle enter press to immediately apply
      searchInput.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          setFilter(searchInput.value);
        }
      });
    }
    if (clearBtn && searchInput) {
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        setFilter('');
      });
    }
  });

})();
