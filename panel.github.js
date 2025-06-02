// Настройка: укажи свой репозиторий и имя файла лицензий
const GITHUB_OWNER = "XenVisionDEV";
const GITHUB_REPO = "mc-license-panel";
const LICENSES_PATH = "licenses.json";

// Вставь свой Personal Access Token (лучше хранить в .env или только для локального теста!)
const GITHUB_TOKEN = "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";

// Запросить licenses.json с GitHub
async function fetchLicenses() {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${LICENSES_PATH}`,
    { headers: { Authorization: `Bearer ${GITHUB_TOKEN}` } }
  );
  if (!res.ok) throw new Error("Не удалось получить файл лицензий");
  const data = await res.json();
  const content = atob(data.content);
  const licenses = JSON.parse(content);
  // Для коммита потребуется SHA последнего файла
  return { licenses, sha: data.sha };
}

// Записать licenses.json на GitHub (через API)
async function saveLicenses(licenses, sha) {
  const content = btoa(JSON.stringify(licenses, null, 2));
  const message = prompt("Введите комментарий к изменению:", "Обновление лицензий") || "Update licenses";
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${LICENSES_PATH}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message,
        content,
        sha
      })
    }
  );
  if (!res.ok) throw new Error("Не удалось записать файл лицензий");
}

// Вся логика работы панели теперь использует fetchLicenses/saveLicenses вместо localStorage!

// Например, вот как будет выглядеть загрузка и рендеринг:
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

// Аналогично перепиши функции добавления/удаления/смены статуса, чтобы они обновляли файл на GitHub через saveLicenses().

document.addEventListener('DOMContentLoaded', renderTable);
