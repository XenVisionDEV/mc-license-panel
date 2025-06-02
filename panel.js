const OWNER = "XenVisionDEV";
const REPO = "mc-license-panel";
const FILE = "licenses.json";

let TOKEN = localStorage.getItem("gh_pat") || "";

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
  alert("Токен сброшен! Следующая операция снова попросит ввести токен.");
}
window.logoutToken = logoutToken; // <-- Делаем функцию глобально видимой

async function fetchLicenses() {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE}`);
  const data = await res.json();
  if (!data.content) throw new Error("Не удалось получить файл лицензий");
  const licenses = JSON.parse(atob(data.content.replace(/\n/g, "")));
  return { licenses, sha: data.sha };
}

async function saveLicenses(licenses, sha) {
  const ok = await promptToken();
  if (!ok || !TOKEN) return alert("Нет токена!");
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
  if (!res.ok) {
    if(res.status === 401) {
      logoutToken();
      alert("Ошибка авторизации: неправильный токен или недостаточно прав. Введите токен снова.");
    }
    throw new Error("Ошибка записи файла лицензий");
  }
}

window.addLicense = async function() {
  const input = document.getElementById('new-key');
  const newKey = input.value.trim();
  if (!newKey) return alert("Введите ключ!");
  let { licenses, sha } = await fetchLicenses();
  if (licenses.some(l => l.key === newKey)) {
    alert("Такой ключ уже есть!");
    return;
  }
  licenses.push({ key: newKey, active: true });
  await saveLicenses(licenses, sha);
  input.value = "";
  renderTable();
}

window.toggleLicense = async function(idx) {
  let { licenses, sha } = await fetchLicenses();
  licenses[idx].active = !licenses[idx].active;
  await saveLicenses(licenses, sha);
  renderTable();
}

window.deleteLicense = async function(idx) {
  let { licenses, sha } = await fetchLicenses();
  if (!confirm("Удалить ключ " + licenses[idx].key + "?")) return;
  licenses.splice(idx, 1);
  await saveLicenses(licenses, sha);
  renderTable();
}

async function renderTable() {
  const { licenses } = await fetchLicenses();
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
