const el = {
  tanggal: document.getElementById('f-tanggal'),
  fungsi: document.getElementById('f-fungsi'),
  kecamatan: document.getElementById('f-kecamatan'),
  kelurahan: document.getElementById('f-kelurahan'),
  rw: document.getElementById('f-rw'),
  rt: document.getElementById('f-rt'),
  btnCari: document.getElementById('btn-cari'),
  btnOrientation: document.getElementById('btn-orientation'),
  orientationStatus: document.getElementById('table-orientation-status'),
  tableWrap: document.getElementById('table-wrap'),
  tableTitle: document.getElementById('table-title'),
  chartCanvas: document.getElementById('chart'),
};

let chartInstance = null;
let currentTableRows = [];
let tableOrientation = 'horizontal';
let filterState = {
  tanggal: '',
  descrip: '',
  no_kec: '',
  no_kel: ''
};

function parseFunctionSelection(value) {
  if (!value) return { descrip: '', sect: '' };

  const compositeKey = '|||';
  if (value.includes(compositeKey)) {
    const [descrip, sect] = value.split(compositeKey);
    return {
      descrip: descrip || '',
      sect: sect || ''
    };
  }

  const found = (filterState.fungsi || []).find((item) => {
    const currentValue = `${item.value}|||${item.sect || item.section || ''}`;
    return currentValue === value || String(item.value) === String(value);
  });

  return {
    descrip: found ? (found.value || value) : value,
    sect: found ? (found.sect || found.section || '') : ''
  };
}

function getSelectedFunction() {
  const selectedValue = el.fungsi?.value || '';
  if (!selectedValue) return null;

  const exactMatch = (filterState.fungsi || []).find((item) => {
    const currentValue = `${item.value}|||${item.sect || item.section || ''}`;
    return currentValue === selectedValue || String(item.value) === String(selectedValue);
  });

  return exactMatch || null;
}

function getCurrentFilters() {
  const parsed = parseFunctionSelection(el.fungsi?.value || '');
  const selectedFunction = getSelectedFunction();

  return {
    tanggal: el.tanggal.value || '',
    descrip: parsed.descrip || (selectedFunction ? selectedFunction.value : ''),
    sect: parsed.sect || (selectedFunction ? (selectedFunction.sect || selectedFunction.section || '') : ''),
    no_kec: el.kecamatan.value || '',
    no_kel: el.kelurahan.value || ''
  };
}

function resolveDescripFromSelection() {
  const selectedValue = el.fungsi?.value || '';
  const parsed = parseFunctionSelection(selectedValue);
  return parsed.descrip || selectedValue;
}

function populateSelect(select, items, placeholder, valueKey = 'value', labelKey = 'label') {
  if (!select) return;

  select.innerHTML = `<option value="">${placeholder}</option>`;
  select.disabled = false;

  (items || []).forEach((item) => {
    const option = document.createElement('option');
    option.value = item[valueKey];
    option.textContent = item[labelKey];
    select.appendChild(option);
  });
}

function sanitizeFunctionLabel(label) {
  if (label === null || label === undefined) return '';
  return String(label).replace(/\s*\(\d+\)\s*$/, '').trim();
}

function formatDateOption(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{4})-(\d{2})/);
  if (!match) return raw;
  const month = Number(match[2]);
  const year = match[1];
  const names = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  return month >= 1 && month <= 12 ? `${names[month - 1]} ${year}` : raw;
}

function populateDateSelect(select, items, placeholder) {
  if (!select) return;
  select.innerHTML = `<option value="">${placeholder}</option>`;
  select.disabled = false;
  (items || []).forEach((item) => {
    const option = document.createElement('option');
    option.value = item.value;
    option.textContent = formatDateOption(item.value);
    select.appendChild(option);
  });
}

function populateFunctionSelect(select, items, placeholder) {
  if (!select) return;

  select.innerHTML = `<option value="">${placeholder}</option>`;
  select.disabled = false;

  (items || []).forEach((item) => {
    const option = document.createElement('option');
    const section = item.sect || item.section || '';
    const uniqueValue = section ? `${item.value}|||${section}` : item.value;
    option.value = uniqueValue;
    option.textContent = sanitizeFunctionLabel(item.label || item.value);
    select.appendChild(option);
  });
}

function setDisabledSelect(select, placeholder) {
  if (!select) return;
  select.innerHTML = `<option value="">${placeholder}</option>`;
  select.disabled = true;
}

function refreshKelurahanOptions() {
  const selectedKec = el.kecamatan?.value || '';
  const kelurahan = selectedKec
    ? (filterState.kelurahan || []).filter((item) => String(item.kecamatan) === String(selectedKec))
    : [];

  populateSelect(el.kelurahan, kelurahan, '- Semua kelurahan -');
  if (el.kelurahan && !selectedKec) {
    el.kelurahan.value = '';
  }
}

function loadFilterOptions() {
  fetch('/api/penyajian/filter-options')
    .then((response) => response.json())
    .then((result) => {
      if (!result.success) {
        console.error(result.message || 'Gagal memuat filter');
        return;
      }

      const data = result.data || {};
      filterState = {
        tanggal: data.tanggal || [],
        fungsi: data.fungsi || [],
        kecamatan: data.kecamatan || [],
        kelurahan: data.kelurahan || []
      };

      populateDateSelect(el.tanggal, filterState.tanggal, '- Semua tanggal -');
      populateFunctionSelect(el.fungsi, filterState.fungsi, '- Semua fungsi -');
      populateSelect(el.kecamatan, filterState.kecamatan, '- Semua kecamatan -');
      refreshKelurahanOptions();
      fetchFilteredData();
    })
    .catch((err) => {
      console.error('filter-options error', err);
    });
}

function fetchFilteredData() {
  const params = new URLSearchParams(getCurrentFilters());

  fetch(`/api/penyajian/data?${params.toString()}`)
    .then((response) => response.json())
    .then((result) => {
      if (!result.success) {
        console.error(result.message || 'Gagal memuat data');
        currentTableRows = [];
        renderEmptyTable('Tidak ada data sesuai filter yang dipilih.');
        return;
      }

      const rows = result.rows || [];
      currentTableRows = rows;
      renderTable(rows);
      renderChart(rows);
      updateTitle(rows);
    })
    .catch((err) => {
      console.error('data error', err);
      currentTableRows = [];
      renderEmptyTable('Terjadi kesalahan saat memuat data.');
    });
}

function parseNumericValue(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  let text = String(value).trim().replace(/\s+/g, '');
  if (!text) return 0;

  if (text.includes(',') && text.includes('.')) {
    // Format Indonesia: 1.234,56
    text = text.replace(/\./g, '').replace(',', '.');
  } else if (text.includes(',')) {
    text = text.replace(',', '.');
  } else if ((text.match(/\./g) || []).length > 1) {
    text = text.replace(/\./g, '');
  } else if (/^\d{1,3}\.\d{3}$/.test(text)) {
    text = text.replace('.', '');
  }

  const number = Number(text);
  return Number.isFinite(number) ? number : 0;
}

function getKecamatanLabel(code) {
  if (!code) return 'Semua kecamatan';

  const found = (filterState.kecamatan || []).find((item) => String(item.value) === String(code));
  if (found && found.label) {
    return found.label;
  }

  return `Kecamatan ${code}`;
}

function formatReportMonth(value) {
  if (!value) return 'BULAN —';
  const match = String(value).match(/^(\d{4})-(\d{2})/);
  if (match) {
    const month = Number(match[2]);
    const year = match[1];
    const names = [
      'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
      'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'
    ];
    return month >= 1 && month <= 12 ? `BULAN ${names[month - 1]} ${year}` : `BULAN ${value}`;
  }
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return `BULAN ${date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }).toUpperCase()}`;
  }
  return `BULAN ${String(value).toUpperCase()}`;
}

function updateTitle(rows) {
  const selected = getSelectedFunction();
  const functionLabel = selected
    ? sanitizeFunctionLabel(selected.label || selected.value)
    : (resolveDescripFromSelection() || 'SEMUA FUNGSI');
  const title = (functionLabel || 'SEMUA FUNGSI').toUpperCase();
  const dateValue = el.tanggal?.value || (rows || []).find((row) => row.TANGGAL)?.TANGGAL || '';

  if (el.tableTitle) {
    el.tableTitle.innerHTML = `
      <strong>${escapeHtml(title)}</strong>
      <span>KOTA YOGYAKARTA</span>
      <span>${escapeHtml(formatReportMonth(dateValue))}</span>
    `;
  }
}

function setDefaultViewState() {
  if (el.tableTitle) {
    el.tableTitle.innerHTML = '<strong>SEMUA FUNGSI</strong><span>KOTA YOGYAKARTA</span><span>BULAN —</span>';
  }
}

function renderEmptyTable(message) {
  el.tableWrap.innerHTML = `
    <div style="padding:48px 20px; text-align:center; color:var(--ink-500);">
      <div style="width:54px; height:54px; border-radius:50%; background:var(--surface-alt); margin:0 auto 12px; display:flex; align-items:center; justify-content:center; font-size:24px; color:var(--ink-400);">
        <i class="ti ti-table-off"></i>
      </div>
      <p style="font-weight:700; font-size:14px; color:var(--ink-800); margin:0 0 4px;">${escapeHtml(message)}</p>
      <span style="font-size:12px; color:var(--ink-500);">Pilih parameter filter di atas lalu klik "Tampilkan Data" untuk memuat hasil.</span>
    </div>
  `;
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
}

function getKelurahanLabel(kecamatanCode, kelurahanCode) {
  const found = (filterState.kelurahan || []).find((item) =>
    String(item.kecamatan) === String(kecamatanCode) && String(item.value) === String(kelurahanCode)
  );
  return found?.label || (kelurahanCode ? `Kelurahan ${kelurahanCode}` : getKecamatanLabel(kecamatanCode));
}

function renderTable(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    renderEmptyTable('Tidak ada data untuk filter ini');
    return;
  }

  const selectedKecamatan = el.kecamatan?.value || '';
  const useKelurahanGroups = Boolean(selectedKecamatan);
  const groupMap = new Map();
  const rowMap = new Map();

  rows.forEach((row) => {
    const kecCode = String(row.NO_KEC ?? '').trim();
    const kelCode = String(row.NO_KEL ?? '').trim();
    const groupCode = useKelurahanGroups ? (kelCode || kecCode || '000') : (kecCode || '000');
    const groupKey = `${useKelurahanGroups ? 'kel' : 'kec'}:${groupCode}`;
    const groupLabel = useKelurahanGroups
      ? (kelCode ? getKelurahanLabel(kecCode, kelCode) : getKecamatanLabel(kecCode))
      : getKecamatanLabel(kecCode);

    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, { key: groupKey, code: groupCode, label: groupLabel, kecCode, kelCode });
    }

    const rowLabel = String(row.DESCRIP ?? 'LAINNYA').trim() || 'LAINNYA';
    if (!rowMap.has(rowLabel)) rowMap.set(rowLabel, new Map());
    const locationValues = rowMap.get(rowLabel);
    if (!locationValues.has(groupKey)) {
      locationValues.set(groupKey, { male: 0, female: 0, total: 0, totalFromSource: false });
    }

    const aggregate = locationValues.get(groupKey);
    const male = parseNumericValue(row.LAKI_LAKI ?? row.LK ?? 0);
    const female = parseNumericValue(row.PEREMPUAN ?? row.PR ?? 0);
    aggregate.male += male;
    aggregate.female += female;
    if (row.JUMLAH !== null && row.JUMLAH !== undefined && row.JUMLAH !== '') {
      aggregate.total += parseNumericValue(row.JUMLAH);
      aggregate.totalFromSource = true;
    } else {
      aggregate.total += male + female;
    }
  });

  const groups = [...groupMap.values()].sort((a, b) =>
    String(a.code).localeCompare(String(b.code), 'id', { numeric: true })
  );
  const rowLabels = [...rowMap.keys()].sort((a, b) => a.localeCompare(b, 'id', { numeric: true, sensitivity: 'base' }));

  if (!groups.length || !rowLabels.length) {
    renderEmptyTable('Tidak ada data untuk filter ini');
    return;
  }

  const valuesFor = (label, group) => {
    const item = rowMap.get(label).get(group.key);
    if (!item) return '<td>0</td><td>0</td><td><strong>0</strong></td>';
    return `<td>${Number(item.male).toLocaleString('id-ID')}</td><td>${Number(item.female).toLocaleString('id-ID')}</td><td><strong>${Number(item.total).toLocaleString('id-ID')}</strong></td>`;
  };

  let headers;
  let body;
  if (tableOrientation === 'horizontal') {
    const groupHeaders = groups.map((group) =>
      `<th colspan="3">${escapeHtml(group.label)}</th>`
    ).join('');
    const subHeaders = groups.map(() => '<th><span style="color:#93c5fd;font-weight:700;">L</span></th><th><span style="color:#f9a8d4;font-weight:700;">P</span></th><th><span style="color:#ffffff;font-weight:700;">Jml</span></th>').join('');
    headers = `<tr><th class="row-label" rowspan="2">Kategori</th>${groupHeaders}</tr><tr>${subHeaders}</tr>`;
    body = rowLabels.map((label) => {
      const cells = groups.map((group) => valuesFor(label, group)).join('');
      return `<tr><td class="row-label">${escapeHtml(label)}</td>${cells}</tr>`;
    }).join('');
  } else {
    const categoryHeaders = rowLabels.map((label) => `<th colspan="3">${escapeHtml(label)}</th>`).join('');
    const subHeaders = rowLabels.map(() => '<th><span style="color:#93c5fd;font-weight:700;">L</span></th><th><span style="color:#f9a8d4;font-weight:700;">P</span></th><th><span style="color:#ffffff;font-weight:700;">Jml</span></th>').join('');
    headers = `<tr><th class="row-label" rowspan="2">Wilayah</th>${categoryHeaders}</tr><tr>${subHeaders}</tr>`;
    body = groups.map((group) => {
      const cells = rowLabels.map((label) => valuesFor(label, group)).join('');
      return `<tr><td class="row-label">${escapeHtml(group.label)}</td>${cells}</tr>`;
    }).join('');
  }

  el.tableWrap.innerHTML = `
    <table class="data-table" aria-label="Tabel penyajian data penduduk">
      <thead>${headers}</thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

function updateOrientationControls() {
  const isHorizontal = tableOrientation === 'horizontal';
  if (el.orientationStatus) {
    el.orientationStatus.textContent = `Tampilan ${isHorizontal ? 'horizontal' : 'vertikal'}`;
  }
  if (el.btnOrientation) {
    el.btnOrientation.textContent = `Ubah ke ${isHorizontal ? 'vertikal' : 'horizontal'}`;
  }
}

function bindOrientationControl() {
  el.btnOrientation?.addEventListener('click', () => {
    tableOrientation = tableOrientation === 'horizontal' ? 'vertical' : 'horizontal';
    updateOrientationControls();
    renderTable(currentTableRows);
    el.tableWrap.scrollLeft = 0;
    el.tableWrap.scrollTop = 0;
  });
}

function renderChart(rows) {
  const isAllKecamatanSelected = !el.kecamatan || !el.kecamatan.value;

  const grouped = {};
  rows.forEach((row) => {
    const key = isAllKecamatanSelected ? (row.NO_KEC || '000') : (row.DESCRIP || 'LAINNYA');
    const label = isAllKecamatanSelected ? getKecamatanLabel(key) : key;
    const value = parseNumericValue(isAllKecamatanSelected ? (row.JUMLAH || (parseNumericValue(row.LAKI_LAKI || row.LK || 0) + parseNumericValue(row.PEREMPUAN || row.PR || 0))) : (row.JUMLAH || (parseNumericValue(row.LAKI_LAKI || row.LK || 0) + parseNumericValue(row.PEREMPUAN || row.PR || 0))));

    if (!grouped[label]) {
      grouped[label] = 0;
    }

    grouped[label] += value;
  });

  const labels = Object.keys(grouped);
  const data = Object.values(grouped);

  if (!labels.length) {
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    return;
  }

  if (chartInstance) chartInstance.destroy();

  const palette = ['#2563eb', '#059669', '#d97706', '#8b5cf6', '#06b6d4', '#ec4899', '#f59e0b', '#10b981', '#6366f1', '#14b8a6'];

  chartInstance = new Chart(el.chartCanvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: isAllKecamatanSelected ? 'Jumlah Penduduk per Kecamatan' : 'Jumlah Penduduk',
        data,
        backgroundColor: labels.map((_, i) => palette[i % palette.length]),
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { color: '#64748b' } },
        x: { grid: { display: false }, ticks: { color: '#64748b' } }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function applyFilters() {
  fetchFilteredData();
}

function bindFilterEvents() {
  if (el.btnCari) {
    el.btnCari.addEventListener('click', applyFilters);
  }

  [el.tanggal, el.fungsi, el.kecamatan, el.kelurahan].forEach((element) => {
    if (!element) return;

    element.addEventListener('change', () => {
      if (element === el.kecamatan) {
        refreshKelurahanOptions();
      }
      if (element === el.kecamatan && !el.kecamatan.value) {
        el.kelurahan.value = '';
      }
      fetchFilteredData();
    });
  });
}

setDefaultViewState();
updateOrientationControls();
loadFilterOptions();
bindFilterEvents();
bindOrientationControl();

document.getElementById('btn-download')?.addEventListener('click', (event) => {
  event.preventDefault();
  return false;
});
