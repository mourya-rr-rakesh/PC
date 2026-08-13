(() => {
  const FIVE_MONTHS = 5;

  // DOM helpers
  const $ = id => document.getElementById(id);
  const soonMedListTbody = $('soonMedList');
  const noSoonDataEl = $('noSoonData');

  let medicines = [];

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

  // Fetch medicines from API
  async function loadMedicines() {
    try {
      console.log('[soon-expiring] requesting /medicines');
      const response = await fetch('/medicines', { cache: 'no-store', credentials: 'include' });
      console.log('[soon-expiring] response status', response.status);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        console.error('[soon-expiring] API error:', errData);
        throw new Error(errData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[soon-expiring] Raw API response:', data);

      medicines = data.medicines || [];
      console.log('[soon-expiring] Parsed medicines count:', medicines.length);

      if (medicines.length === 0) {
        console.warn('[soon-expiring] No medicines found! Check if you are logged in.');
        alert('No medicines found. Make sure you are logged in.');
      } else {
        console.log('[soon-expiring] Sample medicines:', medicines.slice(0, 3).map(m => ({ name: m.name, id: m._id })));
        console.log('[soon-expiring] Sample packs:', medicines.slice(0, 5).map(m => ({ id: m._id, name: m.name, pack: m.pack })));
      }

      renderSoonList();
      return medicines;
    } catch (error) {
      console.error('[soon-expiring] Error loading medicines:', error.message);
      alert('Failed to load medicines: ' + error.message);
      return [];
    }
  }

  // render table for soon expiring medicines
  function renderSoonList() {
    let list = medicines.filter(m => !isExpired(m.expDate) && withinMonths(m.expDate, FIVE_MONTHS));
    list.sort((a, b) => {
      const A = a.expDate ? new Date(a.expDate).getTime() : Infinity;
      const B = b.expDate ? new Date(b.expDate).getTime() : Infinity;
      return A - B;
    });

    if (!soonMedListTbody) return;
    soonMedListTbody.innerHTML = '';

    if (list.length === 0) {
      if (noSoonDataEl) noSoonDataEl.style.display = 'block';
      return;
    } else {
      if (noSoonDataEl) noSoonDataEl.style.display = 'none';
    }

    for (const m of list) {
      const tr = document.createElement('tr');
      tr.dataset.id = m._id;
      tr.classList.add('soon'); // Highlight as soon expiring

      // Create cells with data-label attributes so mobile CSS can show labels
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
          { label: 'Stock', value: m.stock != null ? m.stock : 0 }
        ];

      for (const c of cells) {
        const td = document.createElement('td');
        td.setAttribute('data-label', c.label);
        td.className = 'px-4 py-2 align-top';
        // Wrap the actual value in a span so mobile CSS can align it to the right
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
      editBtn.id = `soon-edit-btn-${m._id}`;
      editBtn.type = 'button';
      editBtn.textContent = 'Edit';
      // Attach edit handler with IIFE closure
      (function (medicine) {
        editBtn.addEventListener('click', function (e) {
          e.preventDefault();
          console.log('[soon-expiring.js] Edit clicked for:', medicine.name);
          editMedicine(medicine);
        });
      })(m);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 mr-1';
      deleteBtn.dataset.id = m._id;
      deleteBtn.textContent = 'Delete';
      // Attach delete handler
      deleteBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        deleteMedicine(m._id);
      });

      const orderBtn = document.createElement('button');
      orderBtn.className = 'order-btn bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600';
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

      soonMedListTbody.appendChild(tr);
    }
  }

  // Edit medicine - redirect to dashboard with medicine data
  function editMedicine(medicineObj) {
    try {
      if (!medicineObj) {
        console.error('[soon-expiring.js] editMedicine: No medicine object');
        alert('Error: Invalid medicine');
        return;
      }
      console.log('[soon-expiring.js] editMedicine: medicine =', medicineObj.name);
      localStorage.setItem('edit_medicine', JSON.stringify(medicineObj));
      localStorage.setItem('edit_mode', 'true');
      console.log('[soon-expiring.js] editMedicine: Saved to localStorage, redirecting...');
      window.location.href = '/dashboard.html';
    } catch (error) {
      console.error('[soon-expiring.js] editMedicine ERROR:', error);
      alert('Error: ' + error.message);
    }
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
  });

})();
