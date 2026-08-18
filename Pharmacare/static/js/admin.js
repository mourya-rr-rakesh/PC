(async () => {
  // No separate auth endpoint — attempt to fetch admin users directly and handle 401/403.
  // If unauthorized (401) redirect to login. If forbidden (403) show not-authorized message.


  const tbody = document.getElementById('adminUsersBody');

  async function loadUsers() {
    try {
      // First, check current user's profile
      const profileRes = await fetch('/profile_api', { credentials: 'include' });
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        console.log('Current user profile:', profileData);
      }
      
      const res = await fetch('/admin/users',{
        credentials: 'include'
      });
      if (res.status === 401) { 
        console.log('Unauthorized - redirecting to login');
        window.location = '/login.html'; 
        return; 
      }
      if (res.status === 403) { 
        console.log('Forbidden - admin access required');
        document.querySelector('main').innerHTML = '<div class="max-w-2xl mx-auto p-6 text-center text-red-600">Admin panel is only available to admins. Your current role does not have admin access.</div>'; 
        return; 
      }
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      console.log('Users loaded:', data);
      renderUsers(data.users || []);
    } catch (err) {
      console.error('Load users error', err);
      tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-red-500">Failed to load users: ' + err.message + '</td></tr>';
    }
  }

  function renderUsers(users) {
    tbody.innerHTML = '';
    if (!users || users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-gray-500">No users found</td></tr>';
      return;
    }
    for (const u of users) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="p-2">${u.name || '-'}</td><td class="p-2">${u.email}</td><td class="p-2">${u.role || 'user'}</td><td class="p-2">${u.subscription ? (u.subscription === 'active' ? 'Active' : u.subscription) : 'None'}</td><td class="p-2">
        <button class="delete-btn px-2 py-1 bg-red-500 text-white rounded" data-email="${u.email}">Delete</button>
        <button class="sub-btn px-2 py-1 bg-yellow-500 text-white rounded" data-email="${u.email}">${u.subscription === 'active' ? 'Pause' : 'Activate'}</button>
      </td>`;
      tbody.appendChild(tr);
    }

    document.querySelectorAll('.delete-btn').forEach(b => b.addEventListener('click', async (e) => {
      const email = e.target.dataset.email;
      if (!confirm('Delete user ' + email + '? This will remove their account and data.')) return;
      try {
        console.log('Attempting to delete user:', email);
        const url = '/admin/users/' + encodeURIComponent(email);
        console.log('DELETE URL:', url);
        const res = await fetch(url, { method: 'DELETE', credentials: 'include' });
        console.log('Response status:', res.status);
        const data = await res.json();
        console.log('Response data:', data);
        if (!res.ok) {
          throw new Error(data.error || `Delete failed with status ${res.status}`);
        }
        alert('User deleted successfully');
        loadUsers();
      } catch (err) {
        console.error('Delete error:', err);
        alert('Failed to delete user: ' + err.message);
      }
    }));

    document.querySelectorAll('.sub-btn').forEach(b => b.addEventListener('click', async (e) => {
      const email = e.target.dataset.email;
      const action = e.target.textContent.trim();
      const newState = action === 'Pause' ? 'paused' : 'active';
      try {
        console.log('Updating subscription for:', email, 'to:', newState);
        const url = '/admin/users/' + encodeURIComponent(email) + '/subscription';
        console.log('POST URL:', url);
        const res = await fetch(url, {
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ subscription: newState }),
          credentials: 'include'
        });
        console.log('Response status:', res.status);
        const data = await res.json();
        console.log('Response data:', data);
        if (!res.ok) {
          throw new Error(data.error || `Update failed with status ${res.status}`);
        }
        alert('Subscription updated successfully');
        loadUsers();
      } catch (err) {
        console.error('Subscription update error:', err);
        alert('Failed to update subscription: ' + err.message);
      }
    }));
  }
  function logout() {
      fetch('/logout', { method: 'POST', credentials: 'include' })
        .then(response => response.json())
        .then(data => {
          console.log('Logout successful:', data);
          localStorage.removeItem('meditrack_logged_in');
          window.location.href = 'login.html';
        })
        .catch(error => {
          console.error('Logout error:', error);
          localStorage.removeItem('meditrack_logged_in');
          window.location.href = 'login.html';
        });
    }

  await loadUsers();

  // Invite admin features
  const inviteEmailEl = document.getElementById('inviteEmail');
  const createInviteBtn = document.getElementById('createInviteBtn');
  const refreshInvitesBtn = document.getElementById('refreshInvitesBtn');
  const inviteListEl = document.getElementById('inviteList');

  async function loadInvites() {
    try {
      const res = await fetch('/admin/invites');
      if (!res.ok) throw new Error('Failed to fetch invites');
      const data = await res.json();
      inviteListEl.innerHTML = '';
      if (!data.invites || data.invites.length === 0) {
        inviteListEl.innerHTML = '<li class="text-gray-500">No active invites</li>';
        return;
      }
      for (const inv of data.invites) {
        const li = document.createElement('li');
        const link = `${location.origin}/accept-invite.html?token=${inv.token}`;
        li.className = 'flex items-center justify-between';
        li.innerHTML = `<div class="truncate">
            <div class="font-semibold">${inv.email}</div>
            <div class="text-xs text-gray-500">Expires: ${new Date(inv.expiresAt).toLocaleString()}</div>
          </div>
          <div class="flex gap-2">
            <button class="copy-btn px-2 py-1 bg-blue-500 text-white rounded" data-link="${link}">Copy Link</button>
            <button class="revoke-btn px-2 py-1 bg-red-500 text-white rounded" data-token="${inv.token}">Revoke</button>
          </div>`;
        inviteListEl.appendChild(li);
      }

      document.querySelectorAll('.copy-btn').forEach(b => b.addEventListener('click', (e) => {
        const link = e.target.dataset.link;
        navigator.clipboard.writeText(link).then(() => alert('Invite link copied to clipboard'));
      }));

      document.querySelectorAll('.revoke-btn').forEach(b => b.addEventListener('click', async (e) => {
        const token = e.target.dataset.token;
        if (!confirm('Revoke this invite?')) return;
        try {
          const res = await fetch('/admin/invites/' + encodeURIComponent(token), { method: 'DELETE' });
          if (!res.ok) throw new Error('Revoke failed');
          alert('Invite revoked');
          loadInvites();
        } catch (err) {
          console.error(err);
          alert('Failed to revoke invite');
        }
      }));
    } catch (err) {
      console.error('Load invites error', err);
      inviteListEl.innerHTML = '<li class="text-red-500">Failed to load invites</li>';
    }
  }

  if (createInviteBtn) createInviteBtn.addEventListener('click', async () => {
    const email = inviteEmailEl.value && inviteEmailEl.value.trim();
    if (!email) return alert('Enter an email to invite');
    try {
      const res = await fetch('/admin/invites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return alert('Failed to create invite: ' + (err.error || res.statusText));
      }
      const data = await res.json();
      navigator.clipboard.writeText(data.link).then(() => alert('Invite created and link copied'));
      inviteEmailEl.value = '';
      loadInvites();
    } catch (err) {
      console.error('Create invite error', err);
      alert('Failed to create invite');
    }
  });

  if (refreshInvitesBtn) refreshInvitesBtn.addEventListener('click', loadInvites);

  // initial load of invites
  loadInvites();
})();









// (async () => {
//   /**
//    * DJANGO-SAFE ADMIN SCRIPT
//    * ------------------------------------
//    * - Session based auth (cookies)
//    * - No localStorage auth
//    * - credentials included everywhere
//    */

//   // ---------- AUTH GUARD ----------
//   try {
//     const authRes = await fetch('/profile', {
//       credentials: 'include'
//     });
//     if (!authRes.ok) {
//       window.location.href = '/login.html';
//       return;
//     }
//   } catch (err) {
//     console.error('Auth check failed', err);
//     window.location.href = '/login.html';
//     return;
//   }

//   const tbody = document.getElementById('adminUsersBody');
//   if (!tbody) {
//     console.error('adminUsersBody not found');
//     return;
//   }

//   // ---------- LOAD USERS ----------
//   async function loadUsers() {
//     try {
//       const res = await fetch('/admin/users', {
//         credentials: 'include'
//       });

//       if (res.status === 401) {
//         window.location.href = '/login.html';
//         return;
//       }

//       if (res.status === 403) {
//         document.querySelector('main').innerHTML = `
//           <div class="max-w-2xl mx-auto p-6 text-center text-red-600 text-lg">
//             Admin panel is only accessible to administrators.
//           </div>`;
//         return;
//       }

//       if (!res.ok) throw new Error('Failed to load users');

//       const data = await res.json();
//       renderUsers(data.users || []);
//     } catch (err) {
//       console.error('Load users error:', err);
//       tbody.innerHTML =
//         '<tr><td colspan="5" class="p-4 text-red-500">Failed to load users</td></tr>';
//     }
//   }

//   // ---------- RENDER USERS ----------
//   function renderUsers(users) {
//     tbody.innerHTML = '';

//     if (!users.length) {
//       tbody.innerHTML =
//         '<tr><td colspan="5" class="p-4 text-gray-500">No users found</td></tr>';
//       return;
//     }

//     users.forEach(u => {
//       const tr = document.createElement('tr');
//       tr.innerHTML = `
//         <td class="p-2">${u.name || '-'}</td>
//         <td class="p-2">${u.email}</td>
//         <td class="p-2">${u.role || 'user'}</td>
//         <td class="p-2">${u.subscription || 'None'}</td>
//         <td class="p-2 space-x-2">
//           <button class="delete-btn px-2 py-1 bg-red-500 text-white rounded"
//             data-email="${u.email}">Delete</button>
//           <button class="sub-btn px-2 py-1 bg-yellow-500 text-white rounded"
//             data-email="${u.email}">
//             ${u.subscription === 'active' ? 'Pause' : 'Activate'}
//           </button>
//         </td>`;
//       tbody.appendChild(tr);
//     });

//     // Delete user
//     document.querySelectorAll('.delete-btn').forEach(btn => {
//       btn.addEventListener('click', async () => {
//         const email = btn.dataset.email;
//         if (!confirm(`Delete user ${email}?`)) return;

//         try {
//           const res = await fetch(`/admin/users/${encodeURIComponent(email)}`, {
//             method: 'DELETE',
//             credentials: 'include'
//           });
//           if (!res.ok) throw new Error('Delete failed');
//           await loadUsers();
//         } catch (err) {
//           console.error(err);
//           alert('Failed to delete user');
//         }
//       });
//     });

//     // Toggle subscription
//     document.querySelectorAll('.sub-btn').forEach(btn => {
//       btn.addEventListener('click', async () => {
//         const email = btn.dataset.email;
//         const nextState =
//           btn.textContent.trim() === 'Pause' ? 'paused' : 'active';

//         try {
//           const res = await fetch(
//             `/admin/users/${encodeURIComponent(email)}/subscription`,
//             {
//               method: 'POST',
//               credentials: 'include',
//               headers: { 'Content-Type': 'application/json' },
//               body: JSON.stringify({ subscription: nextState })
//             }
//           );
//           if (!res.ok) throw new Error('Subscription update failed');
//           await loadUsers();
//         } catch (err) {
//           console.error(err);
//           alert('Failed to update subscription');
//         }
//       });
//     });
//   }

//   // ---------- INVITES ----------
//   const inviteEmailEl = document.getElementById('inviteEmail');
//   const createInviteBtn = document.getElementById('createInviteBtn');
//   const refreshInvitesBtn = document.getElementById('refreshInvitesBtn');
//   const inviteListEl = document.getElementById('inviteList');

//   async function loadInvites() {
//     if (!inviteListEl) return;

//     try {
//       const res = await fetch('/admin/invites', {
//         credentials: 'include'
//       });
//       if (!res.ok) throw new Error('Failed to load invites');

//       const data = await res.json();
//       inviteListEl.innerHTML = '';

//       if (!data.invites || !data.invites.length) {
//         inviteListEl.innerHTML =
//           '<li class="text-gray-500">No active invites</li>';
//         return;
//       }

//       data.invites.forEach(inv => {
//         const li = document.createElement('li');
//         li.className = 'flex items-center justify-between';
//         const link = `${location.origin}/accept-invite.html?token=${inv.token}`;

//         li.innerHTML = `
//           <div>
//             <div class="font-semibold">${inv.email}</div>
//             <div class="text-xs text-gray-500">
//               Expires: ${new Date(inv.expiresAt).toLocaleString()}
//             </div>
//           </div>
//           <div class="flex gap-2">
//             <button class="copy-btn px-2 py-1 bg-blue-500 text-white rounded"
//               data-link="${link}">Copy</button>
//             <button class="revoke-btn px-2 py-1 bg-red-500 text-white rounded"
//               data-token="${inv.token}">Revoke</button>
//           </div>`;
//         inviteListEl.appendChild(li);
//       });

//       document.querySelectorAll('.copy-btn').forEach(btn => {
//         btn.onclick = () =>
//           navigator.clipboard
//             .writeText(btn.dataset.link)
//             .then(() => alert('Invite link copied'));
//       });

//       document.querySelectorAll('.revoke-btn').forEach(btn => {
//         btn.onclick = async () => {
//           if (!confirm('Revoke this invite?')) return;
//           await fetch(`/admin/invites/${btn.dataset.token}`, {
//             method: 'DELETE',
//             credentials: 'include'
//           });
//           loadInvites();
//         };
//       });
//     } catch (err) {
//       console.error(err);
//       inviteListEl.innerHTML =
//         '<li class="text-red-500">Failed to load invites</li>';
//     }
//   }

//   if (createInviteBtn) {
//     createInviteBtn.onclick = async () => {
//       const email = inviteEmailEl.value.trim();
//       if (!email) return alert('Enter an email');

//       try {
//         const res = await fetch('/admin/invites', {
//           method: 'POST',
//           credentials: 'include',
//           headers: { 'Content-Type': 'application/json' },
//           body: JSON.stringify({ email })
//         });
//         if (!res.ok) throw new Error('Invite creation failed');

//         const data = await res.json();
//         navigator.clipboard.writeText(data.link);
//         alert('Invite created & copied');
//         inviteEmailEl.value = '';
//         loadInvites();
//       } catch (err) {
//         console.error(err);
//         alert('Failed to create invite');
//       }
//     };
//   }

//   if (refreshInvitesBtn) refreshInvitesBtn.onclick = loadInvites;

//   // ---------- INITIAL LOAD ----------
//   await loadUsers();
//   await loadInvites();
// })();
