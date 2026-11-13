// path: public/app.js
// runtime: Browser Client
// description: Authenticated payload distribution controller & KeyAuth management dashboard

(function () {
  // Navigation & Shell Elements
  const topNav = document.querySelector('.top-nav');
  const userNavSection = document.getElementById('userNavSection');
  const navUsername = document.getElementById('navUsername');
  const appBadge = document.getElementById('appBadge');
  const logoutBtn = document.getElementById('logoutBtn');

  const authSection = document.getElementById('authSection');
  const dashboardSection = document.getElementById('dashboardSection');

  // Auth Form Elements
  const tabLoginBtn = document.getElementById('tabLoginBtn');
  const tabRegisterBtn = document.getElementById('tabRegisterBtn');
  const authForm = document.getElementById('authForm');
  const authUsername = document.getElementById('authUsername');
  const authPassword = document.getElementById('authPassword');
  const authSubmitBtn = document.getElementById('authSubmitBtn');
  const authNotice = document.getElementById('authNotice');
  let authMode = 'login'; // 'login' | 'register'

  // Dashboard Sub-Tabs
  const dashTabBtns = document.querySelectorAll('.dash-tab-btn');
  const dashViews = document.querySelectorAll('.dash-view');
  const navLicensesBtn = document.getElementById('navLicensesBtn');

  // Upload Elements
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const progressContainer = document.getElementById('progressContainer');
  const progressBar = document.getElementById('progressBar');
  const statusText = document.getElementById('statusText');
  const percentText = document.getElementById('percentText');
  const resultCard = document.getElementById('resultCard');
  const fileMetaTag = document.getElementById('fileMetaTag');
  const directLinkInput = document.getElementById('directLinkInput');
  const copyBtn = document.getElementById('copyBtn');

  // File Manager Elements
  const refreshFilesBtn = document.getElementById('refreshFilesBtn');
  const filesTableBody = document.getElementById('filesTableBody');

  // License Manager Elements
  const keyPrefix = document.getElementById('keyPrefix');
  const keyDays = document.getElementById('keyDays');
  const keyAmount = document.getElementById('keyAmount');
  const generateKeysBtn = document.getElementById('generateKeysBtn');
  const refreshKeysBtn = document.getElementById('refreshKeysBtn');
  const keysTableBody = document.getElementById('keysTableBody');

  // Settings Elements
  const settingsForm = document.getElementById('settingsForm');
  const setAppName = document.getElementById('setAppName');
  const setAppSecret = document.getElementById('setAppSecret');
  const setNewPassword = document.getElementById('setNewPassword');
  const settingsNotice = document.getElementById('settingsNotice');

  // State
  let authToken = localStorage.getItem('apex_token') || null;
  let currentUser = localStorage.getItem('apex_username') || null;
  let currentRole = localStorage.getItem('apex_role') || null;

  // Initial State Check
  if (authToken && currentUser) {
    showDashboard(currentUser, currentRole);
  } else {
    showAuth();
  }

  // ==================== AUTH CONTROLLER ====================
  tabLoginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    authMode = 'login';
    tabLoginBtn.classList.add('active');
    tabRegisterBtn.classList.remove('active');
    authSubmitBtn.innerText = 'Sign In';
    authNotice.style.display = 'none';
  });

  tabRegisterBtn.addEventListener('click', (e) => {
    e.preventDefault();
    authMode = 'register';
    tabRegisterBtn.classList.add('active');
    tabLoginBtn.classList.remove('active');
    authSubmitBtn.innerText = 'Create Account';
    authNotice.style.display = 'none';
  });

  authForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = authUsername.value.trim();
    const password = authPassword.value;

    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.token) {
          authToken = data.token;
          currentUser = data.username;
          currentRole = data.role;
          localStorage.setItem('apex_token', authToken);
          localStorage.setItem('apex_username', currentUser);
          localStorage.setItem('apex_role', currentRole);
          if (data.appName) appBadge.innerText = data.appName;

          authNotice.style.display = 'none';
          authUsername.value = '';
          authPassword.value = '';
          showDashboard(currentUser, currentRole);
        } else {
          showAuthError(data.message || 'Authentication rejected');
        }
      })
      .catch(() => {
        showAuthError('Failed to communicate with authentication server');
      });
  });

  function showAuthError(msg) {
    authNotice.className = 'auth-notice error';
    authNotice.innerText = msg;
    authNotice.style.display = 'block';
  }

  logoutBtn.addEventListener('click', () => {
    if (authToken) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': authToken }
      }).finally(() => {
        authToken = null;
        currentUser = null;
        currentRole = null;
        localStorage.removeItem('apex_token');
        localStorage.removeItem('apex_username');
        localStorage.removeItem('apex_role');
        showAuth();
      });
    } else {
      showAuth();
    }
  });

  function showAuth() {
    authSection.style.display = 'block';
    dashboardSection.style.display = 'none';
    userNavSection.style.display = 'none';
  }

  function showDashboard(username, role) {
    authSection.style.display = 'none';
    dashboardSection.style.display = 'block';
    userNavSection.style.display = 'flex';
    navUsername.innerText = `${username} (${role})`;

    // Hide license tab from non-admin users
    if (role !== 'admin') {
      if (navLicensesBtn) navLicensesBtn.style.display = 'none';
    } else {
      if (navLicensesBtn) navLicensesBtn.style.display = 'inline-block';
    }

    switchTab('tabUpload');
  }

  // ==================== DASHBOARD NAVIGATION ====================
  dashTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });

  function switchTab(tabId) {
    dashTabBtns.forEach(b => {
      if (b.getAttribute('data-tab') === tabId) b.classList.add('active');
      else b.classList.remove('active');
    });

    dashViews.forEach(v => {
      if (v.id === tabId) v.style.display = 'block';
      else v.style.display = 'none';
    });

    if (tabId === 'tabFiles') loadFiles();
    if (tabId === 'tabLicenses' && currentRole === 'admin') loadLicenses();
  }

  // ==================== UPLOAD PAYLOAD ====================
  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  ['dragleave', 'dragend'].forEach(type => {
    dropZone.addEventListener(type, () => dropZone.classList.remove('dragover'));
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) handleUpload(e.dataTransfer.files[0]);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) handleUpload(fileInput.files[0]);
  });

  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  function handleUpload(file) {
    if (!authToken) {
      alert('Authentication required. Please sign in to upload files.');
      showAuth();
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    progressContainer.style.display = 'block';
    resultCard.style.display = 'none';
    progressBar.style.width = '0%';
    percentText.innerText = '0%';
    statusText.innerText = `Ingesting: ${file.name}`;

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload', true);
    xhr.setRequestHeader('Authorization', authToken);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        progressBar.style.width = `${percent}%`;
        percentText.innerText = `${percent}%`;
        statusText.innerText = `Ingesting: ${file.name} (${formatBytes(e.loaded)} / ${formatBytes(e.total)})`;
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.success && res.directUrl) {
            progressBar.style.width = '100%';
            percentText.innerText = '100%';
            statusText.innerText = 'Payload online. Clean link generated.';
            directLinkInput.value = res.directUrl;
            fileMetaTag.innerText = `${file.name} • ${formatBytes(res.size)}`;
            resultCard.style.display = 'block';
          } else {
            statusText.innerText = 'Upload rejected by server';
          }
        } catch (err) {
          statusText.innerText = 'Response parsing error';
        }
      } else if (xhr.status === 401) {
        statusText.innerText = 'Session expired. Please sign in again.';
        setTimeout(showAuth, 1500);
      } else {
        statusText.innerText = `Transmission error (HTTP ${xhr.status})`;
      }
    };

    xhr.onerror = () => {
      statusText.innerText = 'Network connection dropped';
    };

    xhr.send(formData);
  }

  copyBtn.addEventListener('click', () => {
    directLinkInput.select();
    navigator.clipboard.writeText(directLinkInput.value).then(() => {
      const original = copyBtn.innerText;
      copyBtn.innerText = 'Copied';
      copyBtn.style.background = '#e5e7eb';
      copyBtn.style.color = '#000000';
      setTimeout(() => {
        copyBtn.innerText = original;
        copyBtn.style.background = '';
        copyBtn.style.color = '';
      }, 2000);
    });
  });

  // ==================== FILE MANAGER ====================
  refreshFilesBtn.addEventListener('click', loadFiles);

  function loadFiles() {
    if (!authToken) return;

    fetch('/api/files', {
      headers: { 'Authorization': authToken }
    })
      .then(res => res.json())
      .then(data => {
        if (!data.success || !data.files || data.files.length === 0) {
          filesTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-dim">No hosted payloads found</td></tr>';
          return;
        }

        filesTableBody.innerHTML = data.files.map(f => `
          <tr>
            <td style="color: #fff; font-weight: 500;">${escapeHtml(f.originalName)}</td>
            <td>${formatBytes(f.size)}</td>
            <td style="color: #94a3b8;">${escapeHtml(f.owner || 'admin')}</td>
            <td>${f.downloads || 0}</td>
            <td>
              <a href="${f.directUrl}" target="_blank" style="color: #cbd5e1; text-decoration: none; border-bottom: 1px dotted #64748b;">${f.directUrl}</a>
            </td>
            <td>
              <button class="btn-danger-sm delete-file-btn" data-token="${f.token}">Delete</button>
            </td>
          </tr>
        `).join('');

        document.querySelectorAll('.delete-file-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const token = btn.getAttribute('data-token');
            if (confirm('Permanently delete this payload from the server?')) {
              deleteFile(token);
            }
          });
        });
      })
      .catch(() => {
        filesTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-dim">Failed to load files</td></tr>';
      });
  }

  function deleteFile(token) {
    fetch(`/api/files/${token}`, {
      method: 'DELETE',
      headers: { 'Authorization': authToken }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) loadFiles();
      });
  }

  // ==================== KEYAUTH LICENSES ====================
  refreshKeysBtn.addEventListener('click', loadLicenses);

  generateKeysBtn.addEventListener('click', () => {
    if (currentRole !== 'admin') return;

    const prefix = keyPrefix.value.trim() || 'APEX';
    const days = parseInt(keyDays.value, 10) || 30;
    const amount = parseInt(keyAmount.value, 10) || 1;

    fetch('/api/licenses/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authToken
      },
      body: JSON.stringify({ prefix, days, amount })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          loadLicenses();
        } else {
          alert(data.message || 'Key generation failed');
        }
      });
  });

  function loadLicenses() {
    if (!authToken || currentRole !== 'admin') return;

    fetch('/api/licenses', {
      headers: { 'Authorization': authToken }
    })
      .then(res => res.json())
      .then(data => {
        if (!data.success || !data.licenses || data.licenses.length === 0) {
          keysTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-dim">No license keys registered</td></tr>';
          return;
        }

        keysTableBody.innerHTML = data.licenses.map(k => `
          <tr>
            <td style="color: #fff; font-weight: 600;">${k.key}</td>
            <td>${k.durationDays}d</td>
            <td><span style="color: ${k.status === 'used' ? '#34d399' : '#e2e8f0'}">${k.status.toUpperCase()}</span></td>
            <td>${k.hwid ? escapeHtml(k.hwid.substring(0, 16)) + '...' : 'Unbound'}</td>
            <td>${k.expires ? new Date(k.expires).toLocaleDateString() : 'Inactive'}</td>
            <td>
              <button class="btn-sm reset-hwid-btn" data-key="${k.key}" style="margin-right: 4px;">Reset HWID</button>
              <button class="btn-danger-sm revoke-key-btn" data-key="${k.key}">Revoke</button>
            </td>
          </tr>
        `).join('');

        document.querySelectorAll('.reset-hwid-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const key = btn.getAttribute('data-key');
            fetch(`/api/licenses/${key}/reset-hwid`, {
              method: 'POST',
              headers: { 'Authorization': authToken }
            }).then(() => loadLicenses());
          });
        });

        document.querySelectorAll('.revoke-key-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const key = btn.getAttribute('data-key');
            if (confirm(`Revoke license key ${key}?`)) {
              fetch(`/api/licenses/${key}`, {
                method: 'DELETE',
                headers: { 'Authorization': authToken }
              }).then(() => loadLicenses());
            }
          });
        });
      });
  }

  // ==================== SETTINGS ====================
  settingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (currentRole !== 'admin') {
      alert('Only administrators can modify system settings');
      return;
    }

    const appName = setAppName.value.trim();
    const secret = setAppSecret.value.trim();
    const newPassword = setNewPassword.value;

    fetch('/api/auth/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authToken
      },
      body: JSON.stringify({ appName, secret, newPassword })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          settingsNotice.className = 'auth-notice success';
          settingsNotice.innerText = 'Configuration saved successfully';
          settingsNotice.style.display = 'block';
          if (appName) appBadge.innerText = appName;
          setNewPassword.value = '';
          setTimeout(() => (settingsNotice.style.display = 'none'), 3000);
        } else {
          settingsNotice.className = 'auth-notice error';
          settingsNotice.innerText = data.message || 'Save error';
          settingsNotice.style.display = 'block';
        }
      });
  });

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
})();
