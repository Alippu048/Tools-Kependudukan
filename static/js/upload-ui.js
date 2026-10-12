const form = document.getElementById("uploadForm");
const fileInput = document.getElementById("file");
const dropzone = document.getElementById("dropzone");
const fileList = document.getElementById("fileList");
const clearButton = document.getElementById("clearButton");
const analyzeButton = document.getElementById("analyzeButton");

let selectedFiles = [];

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function syncInputFiles() {
  const dataTransfer = new DataTransfer();
  selectedFiles.forEach((file) => dataTransfer.items.add(file));
  fileInput.files = dataTransfer.files;
}

function renderFileList() {
  fileList.innerHTML = "";

  if (!selectedFiles.length) return;

  selectedFiles.forEach((file, index) => {
    const row = document.createElement("div");
    row.className = "file-row";
    row.innerHTML = `
      <div class="file-info">
        <div style="display:flex;align-items:center;gap:8px;">
          <i class="ti ti-file-spreadsheet" style="font-size:22px;color:#10b981;flex-shrink:0;"></i>
          <strong title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</strong>
        </div>
        <span>${formatBytes(file.size)}</span>
      </div>
      <label class="sect-field">
        <span>SECT</span>
        <input type="text" data-sect-index="${index}" placeholder="Contoh: DKB">
      </label>
      <label class="sect-field">
        <span>TANGGAL</span>
        <input type="date" data-tanggal-index="${index}">
      </label>
      <label class="sect-field">
        <span>NO</span>
        <input type="text" data-nomor-index="${index}" placeholder="No urut">
      </label>
      <button type="button" class="remove-file" data-remove="${index}" title="Hapus dari daftar">
        <i class="ti ti-trash"></i>
      </button>
    `;
    fileList.appendChild(row);
  });

  document.querySelectorAll("[data-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedFiles.splice(Number(button.dataset.remove), 1);
      syncInputFiles();
      renderFileList();
    });
  });
}

function formatBytes(bytes) {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

fileInput.addEventListener("change", () => {
  selectedFiles = Array.from(fileInput.files);
  renderFileList();
});

["dragenter", "dragover"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.add("drag");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.remove("drag");
  });
});

dropzone.addEventListener("drop", (event) => {
  selectedFiles = Array.from(event.dataTransfer.files).filter((file) => /\.(xlsx|xls)$/i.test(file.name));
  syncInputFiles();
  renderFileList();
});

clearButton.addEventListener("click", () => {
  selectedFiles = [];
  fileInput.value = "";
  fileList.innerHTML = "";
  hideResults();
});

function hideResults() {
  document.getElementById("mapping").classList.add("hidden");
  document.getElementById("preview").classList.add("hidden");
  document.getElementById("database").classList.add("hidden");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!selectedFiles.length) {
    alert("Pilih minimal satu file Excel.");
    return;
  }

  analyzeButton.disabled = true;
  analyzeButton.textContent = "Menganalisis...";

  const formData = new FormData();
  selectedFiles.forEach((file) => formData.append("files", file));

  document.querySelectorAll("[data-sect-index]").forEach((input) => {
    formData.append("sect", input.value.trim());
  });

  document.querySelectorAll("[data-tanggal-index]").forEach((input) => {
    formData.append("tanggal", input.value);
  });

  document.querySelectorAll("[data-nomor-index]").forEach((input) => {
    formData.append("nomor", input.value.trim());
  });

  try {
    const response = await fetch("/analyze", {
      method: "POST",
      body: formData
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      alert(result.message || "Analisis gagal.");
      return;
    }

    document.getElementById("mapping").classList.remove("hidden");
    document.getElementById("preview").classList.remove("hidden");
    document.getElementById("database").classList.remove("hidden");

    document.getElementById("summary").textContent =
      `${result.total_files} file • ${result.success_files} berhasil • ${result.failed_files} gagal • ${result.database_rows} baris hasil mapping`;

    renderFileResults(result.files);
    renderTable(result.preview);
  } catch (error) {
    alert("Terjadi kesalahan saat menghubungi server: " + error.message);
  } finally {
    analyzeButton.disabled = false;
    analyzeButton.textContent = "Analisis semua file";
  }
});

function renderFileResults(files) {
  const container = document.getElementById("fileResults");
  container.innerHTML = "";

  files.forEach((file) => {
    const card = document.createElement("div");
    card.className = `result-file ${file.success ? "ok" : "failed"}`;

    let groupsHtml = "";
    file.groups.forEach((group) => {
      groupsHtml += `
        <div class="mapping-item">
          <div class="desc">${escapeHtml(group.descrip)}</div>
          <div><span>L</span>${escapeHtml(group.male || "-")}</div>
          <div><span>P</span>${escapeHtml(group.female || "-")}</div>
          <div><span>J</span>${escapeHtml(group.total || "-")}</div>
        </div>
      `;
    });

    card.innerHTML = `
      <div class="result-header">
        <div>
          <strong>${escapeHtml(file.filename)}</strong>
          <p>${file.rows} baris • ${file.columns} kolom • ${file.database_rows} baris hasil</p>
        </div>
        <span class="badge">${file.success ? "Berhasil" : "Gagal"}</span>
      </div>
      <div class="result-meta">
        <div><b>Kode wilayah:</b> ${escapeHtml(file.region_column || "Tidak ditemukan")}</div>
        <div><b>SECT:</b> ${escapeHtml(file.sect || "Belum diisi")}</div>
        <div><b>Tanggal:</b> ${escapeHtml(file.tanggal || "Belum diisi")}</div>
        <div><b>NO:</b> ${escapeHtml(file.nomor || "Belum diisi")}</div>
        <div><b>Status:</b> ${escapeHtml(file.message)}</div>
      </div>
      ${groupsHtml ? `<div class="mapping-grid">${groupsHtml}</div>` : '<div class="empty">Tidak ditemukan pola L/P/JML.</div>'}
    `;
    container.appendChild(card);
  });
}

function renderTable(rows) {
  const table = document.getElementById("previewTable");
  table.innerHTML = "";

  if (!rows || !rows.length) {
    table.innerHTML = '<tr><td class="empty">Belum ada data preview.</td></tr>';
    return;
  }

  const headers = Object.keys(rows[0]);
  const head = document.createElement("thead");
  head.innerHTML = `
    <tr>
      ${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}
    </tr>
  `;

  const body = document.createElement("tbody");
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = headers.map((header) => `<td>${escapeHtml(row[header] ?? "")}</td>`).join("");
    body.appendChild(tr);
  });

  table.appendChild(head);
  table.appendChild(body);
}

document.getElementById("dbButton").addEventListener("click", async () => {
  const button = document.getElementById("dbButton");
  const message = document.getElementById("message");

  button.disabled = true;
  button.textContent = "Mengupload semua data...";

  try {
    const response = await fetch("/upload-db", { method: "POST" });
    const result = await response.json();

    message.textContent = result.message;
    message.className = `message ${result.success ? "success" : "error"}`;
  } catch (error) {
    message.textContent = "Gagal menghubungi server: " + error.message;
    message.className = "message error";
  } finally {
    button.disabled = false;
    button.textContent = "Upload ke database";
  }
});
