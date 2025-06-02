const OWNER = "XenVisionDEV";
const REPO = "mc-license-panel";
const FILE = "licenses.json";

let TOKEN = localStorage.getItem("gh_pat") || "";
let licensesCache = [];
let shaCache = "";
let sortField = localStorage.getItem("sortField") || "key";
let sortDirection = localStorage.getItem("sortDirection") || "asc";
let theme = localStorage.getItem("theme") || "dark";

async function promptToken() {
  while (!TOKEN) {
    TOKEN = prompt("Вставьте ваш GitHub Personal Access Token (Fine-grained, права только на mc-license-panel):");
    if (TOKEN) localStorage.setItem("gh_pat", TOKEN);
    else return false;
  }
  return true;
}

function logoutToken() {
  localStorage.removeItem("gh_pat");
  TOKEN = "";
  showToast("Токен сброшен! Следующая операция снова попросит ввести токен.", "info");
  updateAuthStatus();
}
window.logoutToken = logoutToken;

function showToast(msg, type = "success") {
  const toastContainer = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast align-items-center show ${type}`;
  toast.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${msg}</div>
      <button type="button" class="btn-close btn-close-white ms-2 m-auto" data-bs-dismiss="toast"></button>
    </div>`;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function showLoader(show) {
  let loader = document.getElementById("loader");
  if (!loader) {
    loader = document.createElement("div");
    loader.id = "loader";
    loader.innerHTML = `<div class="position-fixed top-0 start-0 w-100 h-100 bg-black bg-opacity-50 d-flex justify-content-center align-items-center" style="z-index:2000">
      <div class="spinner-border text-info" style="width:3rem;height:3rem"></div>
    </div>`;
    document.body.appendChild(loader);
  }
  loader.style.display = show ? "block" : "none";
}

function updateAuthStatus() {
  const el = document.getElementById("auth-status");
  if (TOKEN) el.innerHTML = `<span class="badge rounded-pill bg-success"><span class="material-icons align-middle" style="font-size:1em;">lock</span> Авторизовано</span>`;
  else el.innerHTML = `<span class="badge rounded-pill bg-secondary"><span class="material-icons align-middle" style="font-size:1em;">lock_open</span> Не авторизовано</span>`;
}

async function fetchLicenses() {
  showLoader(true);
  try {
    const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE}`);
    const data = await res.json();
    if (!data.content) throw new Error("Не удалось получить файл лицензий");
    const licenses = JSON.parse(atob(data.content.replace(/\n/g, "")));
    licensesCache = licenses;
    shaCache = data.sha;
    return { licenses, sha: data.sha };
  } catch (e) {
    showToast("Ошибка загрузки лицензий: " + e.message, "error");
    return { licenses: [], sha: "" };
  } finally {
    showLoader(false);
  }
}

async function saveLicenses(licenses, sha) {
  const ok = await promptToken();
  if (!ok || !TOKEN) return showToast("Нет токена!", "error");
  showLoader(true);
  const content = btoa(JSON.stringify(licenses, null, 2));
  const message = prompt("Комментарий к изменению:", "Обновление лицензий") || "Обновление лицензий";
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ message, content, sha })
  });
  showLoader(false);
  if (!res.ok) {
    if(res.status === 401) {
      logoutToken();
      showToast("Ошибка авторизации: неправильный токен или недостаточно прав. Введите токен снова.", "error");
    }
    throw new Error("Ошибка записи файла лицензий");
  }
  showToast("Лицензии успешно обновлены.", "success");
}

window.addLicense = async function() {
  const input = document.getElementById('new-key');
  const newKey = input.value.trim();
  if (!newKey) return showToast("Введите ключ!", "error");
  let { licenses, sha } = await fetchLicenses();
  if (licenses.some(l => l.key === newKey)) {
    showToast("Такой ключ уже есть!", "error");
    return;
  }
  licenses.push({ key: newKey, active: true });
  try {
    await saveLicenses(licenses, sha);
    input.value = "";
    renderTable();
  } catch (e) {
    showToast(e.message, "error");
  }
}

window.toggleLicense = async function(idx) {
  let { licenses, sha } = await fetchLicenses();
  licenses[idx].active = !licenses[idx].active;
  try {
    await saveLicenses(licenses, sha);
    renderTable();
  } catch (e) {
    showToast(e.message, "error");
  }
}

// Модальное подтверждение удаления
let confirmCallback = null;
window.confirmDeleteLicense = function(idx) {
  const confirmModal = new bootstrap.Modal(document.getElementById('confirmModal'));
  document.getElementById('confirm-text').innerText = `Удалить ключ ${licensesCache[idx].key}?`;
  confirmCallback = async function() {
    let { licenses, sha } = await fetchLicenses();
    licenses.splice(idx, 1);
    try {
      await saveLicenses(licenses, sha);
      renderTable();
    } catch (e) {
      showToast(e.message, "error");
    }
    confirmModal.hide();
  };
  document.getElementById('confirm-ok').onclick = confirmCallback;
  confirmModal.show();
}

window.copyKey = function(key) {
  navigator.clipboard.writeText(key)
    .then(() => showToast("Ключ скопирован!", "success"))
    .catch(() => showToast("Не удалось скопировать.", "error"));
}

window.exportLicenses = function(type) {
  const filtered = filterAndSortLicenses();
  if (type === "json") {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], {type: "application/json"});
    downloadBlob(blob, "licenses.json");
  } else if (type === "csv") {
    let csv = "key,active\n";
    filtered.forEach(l => csv += `"${l.key}",${l.active}\n`);
    const blob = new Blob([csv], {type: "text/csv"});
    downloadBlob(blob, "licenses.csv");
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

window.showHistory = async function() {
  showLoader(true);
  const historyModal = new bootstrap.Modal(document.getElementById('historyModal'));
  const historyList = document.getElementById('history-list');
  historyList.innerHTML = '<div class="text-center text-muted">Загрузка...</div>';
  // Получаем логи коммитов licenses.json
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/commits?path=${FILE}`);
  const data = await res.json();
  if (!Array.isArray(data)) {
    historyList.innerHTML = '<div class="text-danger">Ошибка загрузки истории.</div>';
    showLoader(false);
    return;
  }
  historyList.innerHTML = data.map(c => `
    <div class="mb-2 pb-2 border-bottom">
      <div><b>${c.commit.author.name}</b> <span class="text-muted small">${c.commit.author.date.replace("T", " ").replace("Z", "")}</span></div>
      <div class="small">${c.commit.message}</div>
      <div class="small text-muted">SHA: <span style="font-family: monospace;">${c.sha.slice(0,7)}</span></div>
      <a href="${c.html_url}" target="_blank" class="small">Посмотреть на GitHub</a>
    </div>
  `).join('');
  showLoader(false);
  historyModal.show();
}

document.getElementById('confirmModal').addEventListener('hidden.bs.modal', () => {
  confirmCallback = null;
});

function filterAndSortLicenses() {
  let arr = [...licensesCache];
  const search = document.getElementById('search').value.trim().toLowerCase();
  const status = document.getElementById('status-filter').value;
  if (search) arr = arr.filter(l => l.key.toLowerCase().includes(search));
  if (status === "active") arr = arr.filter(l => l.active);
  if (status === "inactive") arr = arr.filter(l => !l.active);
  // Сортировка
  arr.sort((a, b) => {
    let vA = a[sortField], vB = b[sortField];
    if (sortField === "key") {
      vA = vA.toLowerCase(); vB = vB.toLowerCase();
      if (vA < vB) return sortDirection === "asc" ? -1 : 1;
      if (vA > vB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    }
    if (sortField === "active") {
      if (vA === vB) return 0;
      return (vA ? 1 : -1) * (sortDirection === "asc" ? 1 : -1);
    }
    return 0;
  });
  return arr;
}

window.sortTable = function(field) {
  if (sortField === field) sortDirection = sortDirection === "asc" ? "desc" : "asc";
  else { sortField = field; sortDirection = "asc"; }
  localStorage.setItem("sortField", sortField);
  localStorage.setItem("sortDirection", sortDirection);
  renderTable();
}

function renderTableIndicators() {
  ["key", "active"].forEach(f => {
    const el = document.getElementById("sort-"+f);
    if (!el) return;
    if (f === sortField) el.textContent = sortDirection === "asc" ? "expand_less" : "expand_more";
    else el.textContent = "unfold_more";
  });
}

async function renderTable() {
  if (!licensesCache.length || !shaCache) await fetchLicenses();
  const tbody = document.querySelector('#licenses-table tbody');
  tbody.innerHTML = '';
  const arr = filterAndSortLicenses();
  arr.forEach((license, idx) => {
    // Находим актуальный индекс (idx2) в исходном массиве
    const idx2 = licensesCache.findIndex(l => l.key === license.key);
    const statusBadge = license.active
      ? `<span class="badge bg-success">Активен</span>`
      : `<span class="badge bg-secondary">Отключен</span>`;
    const actions = `
      <button onclick="window.toggleLicense(${idx2})" class="btn btn-sm btn-outline-${license.active ? 'secondary' : 'success'} me-2" title="Вкл/Выкл">
        <span class="material-icons align-middle">${license.active ? 'lock' : 'lock_open'}</span>
      </button>
      <button onclick="window.confirmDeleteLicense(${idx2})" class="btn btn-sm btn-outline-danger me-2" title="Удалить">
        <span class="material-icons align-middle">delete</span>
      </button>
      <button onclick="window.copyKey('${license.key.replace(/'/g,"\\'")}')" class="btn btn-sm copy-btn" title="Копировать">
        <span class="material-icons align-middle">content_copy</span>
      </button>`;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="text-break">${license.key}</td>
      <td>${statusBadge}</td>
      <td>${actions}</td>
    `;
    tbody.appendChild(tr);
  });
  renderTableIndicators();
  updateAuthStatus();
}

// Поиск, фильтр — ререндер таблицы по вводу
document.getElementById('search').addEventListener('input', renderTable);
document.getElementById('status-filter').addEventListener('change', renderTable);

function applyTheme() {
  if (theme === "light") {
    document.body.classList.add("theme-light");
    document.getElementById("theme-icon").textContent = "light_mode";
  } else {
    document.body.classList.remove("theme-light");
    document.getElementById("theme-icon").textContent = "dark_mode";
  }
  localStorage.setItem("theme", theme);
}
document.getElementById("theme-toggle").onclick = function() {
  theme = theme === "dark" ? "light" : "dark";
  applyTheme();
};

document.addEventListener('DOMContentLoaded', async () => {
  applyTheme();
  updateAuthStatus();
  await fetchLicenses();
  renderTable();
});
