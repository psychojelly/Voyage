import { normalizeJson, normalizeCsv, parseCsvString } from './data-adapter.js';
import { saveDays } from './store.js';

export function initFileImport() {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const statusEl = document.getElementById('import-status');

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files, statusEl);
  });

  dropZone.addEventListener('click', (e) => {
    if (e.target === fileInput || e.target.closest('.file-label')) return;
    fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    handleFiles(fileInput.files, statusEl);
    fileInput.value = '';
  });
}

async function handleFiles(fileList, statusEl) {
  if (!fileList || fileList.length === 0) return;

  let totalImported = 0;
  let errors = 0;

  for (const file of fileList) {
    try {
      const text = await readFile(file);
      const days = parseFileContent(file.name, text);
      saveDays(days);
      totalImported += days.length;
    } catch (err) {
      console.error(`Error importing ${file.name}:`, err);
      errors++;
    }
  }

  if (totalImported > 0) {
    statusEl.textContent = `Imported ${totalImported} days of data` +
      (errors > 0 ? ` (${errors} file(s) failed)` : '');
    statusEl.className = 'status-msg success';
    window.dispatchEvent(new CustomEvent('data-updated'));
  } else {
    statusEl.textContent = errors > 0
      ? 'Failed to import files. Check format.'
      : 'No data found in files.';
    statusEl.className = 'status-msg error';
  }
}

function parseFileContent(filename, text) {
  const ext = filename.split('.').pop().toLowerCase();

  if (ext === 'json') {
    const data = JSON.parse(text);
    return normalizeJson(data);
  }

  if (ext === 'csv') {
    const rows = parseCsvString(text);
    return normalizeCsv(rows);
  }

  throw new Error(`Unsupported file type: .${ext}`);
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
