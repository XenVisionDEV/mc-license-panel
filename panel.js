const LICENSES_KEY = 'licenses_list';

function getLicenses() {
  return JSON.parse(localStorage.getItem(LICENSES_KEY) || '[]');
}

function saveLicenses(licenses) {
  localStorage.setItem(LICENSES_KEY, JSON.stringify(licenses));
}

function addLicense() {
  const keyInput = document.getElementById('new-key');
  const key = keyInput.value.trim();
  if (!key) return;
  const licenses = getLicenses();
  if (licenses.some(l => l.key === key)) {
    alert('Такой ключ уже существует');
    return;
  }
  licenses.push({ key, active: true });
  saveLicenses(licenses);
  keyInput.value = '';
  renderTable();
}

function toggleLicense(idx) {
  const licenses = getLicenses();
  licenses[idx].active = !licenses[idx].active;
  saveLicenses(licenses);
  renderTable();
}

function deleteLicense(idx) {
  if (!confirm('Удалить этот ключ?')) return;
  const licenses = getLicenses();
  licenses.splice(idx, 1);
  saveLicenses(licenses);
  renderTable();
}

function renderTable() {
  const licenses = getLicenses();
  const tbody = document.querySelector('#licenses-table tbody');
  tbody.innerHTML = '';
  licenses.forEach((license, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="text-break">${license.key}</td>
      <td>
        <span class="badge ${license.active ? 'bg-success' : 'bg-secondary'}">
          ${license.active ? 'Активен' : 'Отключен'}
        </span>
      </td>
      <td>
        <button onclick="toggleLicense(${idx})" class="btn btn-sm btn-outline-${license.active ? 'secondary' : 'success'} me-2">
          <span class="material-icons align-middle">${license.active ? 'lock' : 'lock_open'}</span>
        </button>
        <button onclick="deleteLicense(${idx})" class="btn btn-sm btn-outline-danger">
          <span class="material-icons align-middle">delete</span>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

document.addEventListener('DOMContentLoaded', renderTable);