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
  tipeTabs: document.getElementById('tipeFilterTabs'),
  sourceNote: document.getElementById('source-note'),
};

let chartInstance = null;
let currentTableRows = [];
let tableOrientation = 'horizontal';
let currentTipeFilter = 'all'; // 'all', 'DKB', 'Pelayanan'

let filterState = {
  tanggal: [],
  fungsi: [],
  allFungsi: [],
  kecamatan: [],
  kelurahan: [],
  rw: [],
  rt: []
};

function parseFunctionSelection(value) {
  if (!value) return { descrip: '', sect: '' };

  const compositeKey = '|||';
  if (value.includes(compositeKey)) {
    const [descrip, sect] = value.split(compositeKey);
    return {
      descrip: descrip ? descrip.trim() : '',
      sect: sect ? sect.trim() : ''
    };
  }

  const found = (filterState.allFungsi || filterState.fungsi || []).find((item) => {
    const currentValue = `${item.descrip || item.value}|||${item.sect || item.section || ''}`;
    return currentValue === value || String(item.value) === String(value) || String(item.descrip) === String(value);
  });

  return {
    descrip: found ? (found.descrip || found.value || value) : value,
    sect: found ? (found.sect || found.section || '') : ''
  };
}

function getSelectedFunction() {
  const selectedValue = el.fungsi?.value || '';
  if (!selectedValue) return null;

  const parsed = parseFunctionSelection(selectedValue);
  const found = (filterState.allFungsi || filterState.fungsi || []).find((item) => {
    const itemSect = String(item.sect || item.section || '').trim();
    const itemDescrip = String(item.descrip || item.value || '').trim();
    if (parsed.sect && itemSect) {
      return itemSect === parsed.sect;
    }
    return itemDescrip.toLowerCase() === parsed.descrip.toLowerCase();
  });

  return found || null;
}

function getCurrentFilters() {
  const parsed = parseFunctionSelection(el.fungsi?.value || '');
  const selectedFunction = getSelectedFunction();

  return {
    tanggal: el.tanggal?.value || '',
    descrip: parsed.descrip || (selectedFunction ? (selectedFunction.descrip || selectedFunction.value) : ''),
    sect: parsed.sect || (selectedFunction ? (selectedFunction.sect || selectedFunction.section || '') : ''),
    no_kec: el.kecamatan?.value || '',
    no_kel: el.kelurahan?.value || '',
    no_rw: el.rw?.value || '',
    no_rt: el.rt?.value || ''
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

function populateFunctionSelect(select, allItems, placeholder) {
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = `<option value="">${placeholder}</option>`;
  select.disabled = false;

  const filteredItems = (allItems || []).filter((item) => {
    if (currentTipeFilter === 'all') return true;
    return String(item.tipe || '').toLowerCase() === currentTipeFilter.toLowerCase();
  });

  filteredItems.forEach((item) => {
    const option = document.createElement('option');
    const section = item.sect || item.section || '';
    const descrip = item.descrip || item.value || '';
    const uniqueValue = section ? `${descrip}|||${section}` : descrip;

    option.value = uniqueValue;
    // Bersihkan angka sektor (SECT xxx) dari tampilan user
    const rawLabel = item.short_label || item.label || `${item.no}. [${item.tipe}] ${descrip}`;
    const cleanLabel = rawLabel.replace(/\s*\(SECT\s*\w+\)/i, '').trim();

    option.textContent = cleanLabel;
    option.dataset.sect = section;
    option.dataset.tipe = item.tipe || '';
    option.dataset.hasUmur = String(item.has_umur || false);
    option.dataset.no = String(item.no || '');

    select.appendChild(option);
  });

  // Pertahankan pilihan sebelumnya jika masih ada di daftar terfilter
  if (currentVal) {
    const exists = Array.from(select.options).some((opt) => opt.value === currentVal);
    if (exists) {
      select.value = currentVal;
    }
  }
}

function initTipeFilterTabs() {
  if (!el.tipeTabs) return;

  const tabButtons = el.tipeTabs.querySelectorAll('.tab-pill');
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      currentTipeFilter = btn.dataset.tipe || 'all';

      const placeholder = currentTipeFilter === 'all'
        ? '- Semua fungsi (40 agregat) -'
        : currentTipeFilter === 'DKB'
          ? '- Semua fungsi Data DKB (19) -'
          : '- Semua fungsi Data Pelayanan (21) -';

      populateFunctionSelect(el.fungsi, filterState.allFungsi, placeholder);
      fetchFilteredData();
    });
  });
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
  refreshRwOptions();
}

function refreshRwOptions() {
  if (!el.rw) return;
  const selectedKec = el.kecamatan?.value || '';
  const selectedKel = el.kelurahan?.value || '';
  if (!selectedKel) {
    el.rw.innerHTML = '<option value="">- Semua RW -</option>';
    el.rw.disabled = true;
    el.rw.value = '';
    refreshRtOptions();
    return;
  }

  let rwList = (filterState.rw || []).filter(
    (item) => (!item.kecamatan || String(item.kecamatan) === String(selectedKec)) &&
              (!item.kelurahan || String(item.kelurahan) === String(selectedKel))
  );

  if (!rwList.length) {
    el.rw.innerHTML = '<option value="">- Semua RW -</option>';
    el.rw.disabled = false;
    refreshRtOptions();
    return;
  }

  const seen = new Set();
  const deduped = [];
  rwList.forEach((item) => {
    const val = String(item.value).trim();
    if (val && val !== 'Nul' && val !== 'null' && !seen.has(val)) {
      seen.add(val);
      const num = parseInt(val, 10);
      const label = !isNaN(num) ? `RW ${String(num).padStart(2, '0')}` : (item.label || `RW ${val}`);
      deduped.push({ value: val, label: label, num: isNaN(num) ? 9999 : num });
    }
  });
  deduped.sort((a, b) => a.num - b.num);

  populateSelect(el.rw, deduped, '- Semua RW -');
  el.rw.disabled = false;
  refreshRtOptions();
}

function refreshRtOptions() {
  if (!el.rt) return;
  const selectedKec = el.kecamatan?.value || '';
  const selectedKel = el.kelurahan?.value || '';
  const selectedRw = el.rw?.value || '';
  if (!selectedRw || el.rw.disabled) {
    el.rt.innerHTML = '<option value="">- Semua RT -</option>';
    el.rt.disabled = true;
    el.rt.value = '';
    return;
  }

  let rtList = (filterState.rt || []).filter((item) => {
    const rwMatches = !item.rw || String(item.rw) === String(selectedRw) ||
                      (item.rw && selectedRw && parseInt(item.rw, 10) === parseInt(selectedRw, 10));
    const kelMatches = !item.kelurahan || !selectedKel || String(item.kelurahan) === String(selectedKel);
    const kecMatches = !item.kecamatan || !selectedKec || String(item.kecamatan) === String(selectedKec);
    return rwMatches && kelMatches && kecMatches;
  });

  if (!rtList.length) {
    el.rt.innerHTML = '<option value="">- Semua RT -</option>';
    el.rt.disabled = false;
    return;
  }

  const seen = new Set();
  const deduped = [];
  rtList.forEach((item) => {
    const val = String(item.value).trim();
    if (val && val !== 'Nul' && val !== 'null' && !seen.has(val)) {
      seen.add(val);
      const num = parseInt(val, 10);
      const label = !isNaN(num) ? `RT ${String(num).padStart(2, '0')}` : (item.label || `RT ${val}`);
      deduped.push({ value: val, label: label, num: isNaN(num) ? 9999 : num });
    }
  });
  deduped.sort((a, b) => a.num - b.num);

  populateSelect(el.rt, deduped, '- Semua RT -');
  el.rt.disabled = false;
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
        allFungsi: data.fungsi || [],
        kecamatan: data.kecamatan || [],
        kelurahan: data.kelurahan || [],
        rw: data.rw || [],
        rt: data.rt || []
      };

      populateDateSelect(el.tanggal, filterState.tanggal, '- Semua tanggal -');
      populateFunctionSelect(el.fungsi, filterState.allFungsi, '- Semua fungsi (40 agregat) -');
      populateSelect(el.kecamatan, filterState.kecamatan, '- Semua kecamatan -');
      refreshKelurahanOptions();
      refreshRwOptions();
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

      // Update RW & RT options dinamis jika ada data RW/RT di dalam hasil kueri
      updateDynamicRwRtOptions(rows);

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

function updateDynamicRwRtOptions(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return;

  const currentKec = el.kecamatan?.value || '';
  const currentKel = el.kelurahan?.value || '';
  const currentRw = el.rw?.value || '';

  const rwsFound = new Map();
  const rtsFound = new Map();

  rows.forEach((r) => {
    const rwRaw = r.NO_RW !== null && r.NO_RW !== undefined ? String(r.NO_RW).trim() : '';
    if (rwRaw && rwRaw !== 'Nul' && rwRaw !== 'null' && rwRaw !== 'NULL') {
      const rwInt = parseInt(rwRaw, 10);
      const label = !isNaN(rwInt) ? `RW ${String(rwInt).padStart(2, '0')}` : `RW ${rwRaw}`;
      if (!rwsFound.has(rwRaw)) {
        rwsFound.set(rwRaw, {
          value: rwRaw,
          label,
          num: isNaN(rwInt) ? 9999 : rwInt,
          kecamatan: currentKec,
          kelurahan: currentKel
        });
      }
    }

    const rtRaw = r.NO_RT !== null && r.NO_RT !== undefined ? String(r.NO_RT).trim() : '';
    if (rtRaw && rtRaw !== 'Nul' && rtRaw !== 'null' && rtRaw !== 'NULL') {
      const rtInt = parseInt(rtRaw, 10);
      const label = !isNaN(rtInt) ? `RT ${String(rtInt).padStart(2, '0')}` : `RT ${rtRaw}`;
      if (!rtsFound.has(rtRaw)) {
        rtsFound.set(rtRaw, {
          value: rtRaw,
          label,
          num: isNaN(rtInt) ? 9999 : rtInt,
          rw: currentRw || rwRaw,
          kecamatan: currentKec,
          kelurahan: currentKel
        });
      }
    }
  });

  if (currentKel && rwsFound.size > 0 && el.rw) {
    const sortedRws = [...rwsFound.values()].sort((a, b) => a.num - b.num);
    const prevVal = el.rw.value;
    el.rw.innerHTML = '<option value="">- Semua RW -</option>';
    sortedRws.forEach((item) => {
      const opt = document.createElement('option');
      opt.value = item.value;
      opt.textContent = item.label;
      el.rw.appendChild(opt);
    });
    el.rw.disabled = false;
    if (prevVal && rwsFound.has(prevVal)) {
      el.rw.value = prevVal;
    }
  }

  if (currentRw && rtsFound.size > 0 && el.rt) {
    const sortedRts = [...rtsFound.values()].sort((a, b) => a.num - b.num);
    const prevVal = el.rt.value;
    el.rt.innerHTML = '<option value="">- Semua RT -</option>';
    sortedRts.forEach((item) => {
      const opt = document.createElement('option');
      opt.value = item.value;
      opt.textContent = item.label;
      el.rt.appendChild(opt);
    });
    el.rt.disabled = false;
    if (prevVal && rtsFound.has(prevVal)) {
      el.rt.value = prevVal;
    }
  }
}

function parseNumericValue(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  let text = String(value).trim().replace(/\s+/g, '');
  if (!text) return 0;

  if (text.includes(',') && text.includes('.')) {
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

function getKelurahanLabel(kecamatanCode, kelurahanCode) {
  const found = (filterState.kelurahan || []).find((item) =>
    String(item.kecamatan) === String(kecamatanCode) && String(item.value) === String(kelurahanCode)
  );
  return found?.label || (kelurahanCode ? `Kelurahan ${kelurahanCode}` : getKecamatanLabel(kecamatanCode));
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
  const dateValue = el.tanggal?.value || (rows || []).find((row) => row.TANGGAL)?.TANGGAL || '';

  const selectedKec = el.kecamatan?.value ? getKecamatanLabel(el.kecamatan.value) : '';
  const selectedKel = el.kelurahan?.value ? getKelurahanLabel(el.kecamatan?.value, el.kelurahan.value) : '';
  const selectedRw = el.rw?.value ? (
    !isNaN(parseInt(el.rw.value, 10))
      ? `RW ${String(parseInt(el.rw.value, 10)).padStart(2, '0')}`
      : `RW ${el.rw.value}`
  ) : '';
  const selectedRt = el.rt?.value ? (
    !isNaN(parseInt(el.rt.value, 10))
      ? `RT ${String(parseInt(el.rt.value, 10)).padStart(2, '0')}`
      : `RT ${el.rt.value}`
  ) : '';

  const hasRtData = (rows || []).some((r) => r.NO_RT !== null && r.NO_RT !== undefined && String(r.NO_RT).trim() !== '' && String(r.NO_RT).trim() !== 'Nul');
  const hasRwData = (rows || []).some((r) => r.NO_RW !== null && r.NO_RW !== undefined && String(r.NO_RW).trim() !== '' && String(r.NO_RW).trim() !== 'Nul');

  const parts = [];
  if (selectedKec && selectedKec !== '- Semua kecamatan -') parts.push(selectedKec.toUpperCase());
  if (selectedKel) parts.push(`KEL. ${selectedKel.toUpperCase()}`);

  if (selectedKel && !selectedRw && hasRwData) {
    parts.push('SEMUA RW');
  } else if (selectedRw) {
    parts.push(selectedRw);
    if (!selectedRt && hasRtData) {
      parts.push('SEMUA RT');
    } else if (selectedRt) {
      parts.push(selectedRt);
    }
  } else if (!selectedKec || selectedKec === '- Semua kecamatan -') {
    parts.push('SEMUA KECAMATAN');
  } else if (selectedKec && !selectedKel) {
    parts.push('SEMUA KELURAHAN');
  }

  const areaSubtitle = parts.length ? parts.join(' · ') : 'KOTA YOGYAKARTA';

  let badgeHtml = '';
  let titleText = 'SEMUA FUNGSI AGREGAT';
  let typeSubText = 'DATA KEPENDUDUKAN';

  if (selected) {
    const isDkb = selected.tipe === 'DKB' || String(selected.sect || '').startsWith('89') || String(selected.sect || '').includes('9');
    const funcNo = selected.no ? `${selected.no}. ` : '';
    titleText = `${funcNo}${selected.descrip || selected.value}`;

    if (isDkb) {
      // Hapus angka sektor dari badge, tampilkan murni DATA KONSOLIDASI BERSIH (DKB)
      badgeHtml = '<span class="badge-type badge-dkb"><i class="ti ti-shield-check"></i> DATA KONSOLIDASI BERSIH (DKB)</span>';
      typeSubText = 'KONSOLIDASI BERSIH DITJEN DUKCAPIL KEMENDAGRI';
      if (el.sourceNote) {
        el.sourceNote.innerHTML = '<i class="ti ti-check"></i> Sumber Data: Konsolidasi Bersih (DKB) Ditjen Kependudukan dan Pencatatan Sipil Kemendagri &bull; Dinas Dukcapil Kota Yogyakarta';
      }
    } else {
      // Hapus angka sektor dari badge, tampilkan murni DATA PELAYANAN
      badgeHtml = '<span class="badge-type badge-pelayanan"><i class="ti ti-id-badge-2"></i> DATA PELAYANAN</span>';
      typeSubText = 'PELAYANAN PENDAFTARAN PENDUDUK & PENCATATAN SIPIL';
      if (el.sourceNote) {
        el.sourceNote.innerHTML = '<i class="ti ti-check"></i> Sumber Data: Pelayanan Pendaftaran Penduduk dan Pencatatan Sipil Dinas Dukcapil Kota Yogyakarta';
      }
    }
  } else {
    badgeHtml = '<span class="badge-type" style="background:var(--surface-alt);color:var(--ink-700);border:1px solid var(--line);"><i class="ti ti-layout-grid"></i> SEMUA FUNGSI AGREGAT</span>';
    typeSubText = 'DATA KEPENDUDUKAN KOTA YOGYAKARTA';
    if (el.sourceNote) {
      el.sourceNote.innerHTML = '<i class="ti ti-check"></i> Sumber Data: Dinas Kependudukan dan Pencatatan Sipil Kota Yogyakarta';
    }
  }

  if (el.tableTitle) {
    el.tableTitle.innerHTML = `
      ${badgeHtml}
      <strong style="font-size:16px; margin-top:2px;">${escapeHtml(titleText.toUpperCase())}</strong>
      <span style="font-weight:600; color:var(--ink-600);">${escapeHtml(typeSubText)} &bull; ${escapeHtml(areaSubtitle)}</span>
      <span style="font-size:11.5px; color:var(--ink-500);">${escapeHtml(formatReportMonth(dateValue))}</span>
    `;
  }
}

function setDefaultViewState() {
  if (el.tableTitle) {
    el.tableTitle.innerHTML = '<strong>SEMUA FUNGSI AGREGAT</strong><span>KOTA YOGYAKARTA</span><span>BULAN —</span>';
  }
}

function renderEmptyTable(message) {
  el.tableWrap.innerHTML = `
    <div style="padding:48px 20px; text-align:center; color:var(--ink-500);">
      <div style="width:54px; height:54px; border-radius:50%; background:var(--surface-alt); margin:0 auto 12px; display:flex; align-items:center; justify-content:center; font-size:24px; color:var(--ink-400);">
        <i class="ti ti-table-off"></i>
      </div>
      <p style="font-weight:700; font-size:14px; color:var(--ink-800); margin:0 0 4px;">${escapeHtml(message)}</p>
      <span style="font-size:12px; color:var(--ink-500);">Pilih parameter filter di atas untuk memuat hasil penyajian data secara otomatis.</span>
    </div>
  `;
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
}

function getCategoryColumnTitle(selected, hasAgeData) {
  if (hasAgeData) {
    if (selected) {
      const desc = (selected.descrip || selected.label || '').toLowerCase();
      if (desc.includes('tunggal')) return 'Umur Tunggal (Tahun)';
      if (desc.includes('kelompok') || desc.includes('umur')) return 'Kelompok / Rentang Umur';
      if (desc.includes('kia')) return 'Kelompok Usia KIA';
      if (desc.includes('akta')) return 'Kelompok Usia Akta Kelahiran';
    }
    return 'Kelompok / Rentang Umur';
  }

  if (!selected) return 'Kategori / Deskripsi';

  const raw = (selected.descrip || selected.raw_descrip || selected.label || '').toLowerCase();

  if (raw.includes('agama')) return 'Agama';
  if (raw.includes('pekerjaan')) return 'Jenis Pekerjaan';
  if (raw.includes('darah')) return 'Golongan Darah';
  if (raw.includes('pendidikan')) return 'Pendidikan Terakhir';
  if (raw.includes('kawin') || raw.includes('perkawinan') || raw.includes('nikah')) return 'Status Perkawinan';
  if (raw.includes('disabilitas') || raw.includes('cacat') || raw.includes('kelainan')) return 'Jenis Kelainan / Disabilitas';
  if (raw.includes('hubungan') || raw.includes('keluarga') || raw.includes('shbkel')) return 'Status Hubungan Keluarga';
  if (raw.includes('wni') || raw.includes('oa')) return 'Kewarganegaraan';
  if (raw.includes('akta')) return 'Kepemilikan Akta';
  if (raw.includes('kia')) return 'Kepemilikan KIA';
  if (raw.includes('ktp')) return 'Status Perekaman KTP-el';
  if (raw.includes('kelahiran')) return 'Status Kelahiran';
  if (raw.includes('kematian')) return 'Status Kematian';
  if (raw.includes('pindah') || raw.includes('kedatangan')) return 'Mutasi Penduduk';
  if (raw.includes('keluarga') || raw.includes('kk')) return 'Status Kartu Keluarga';

  const match = (selected.descrip || selected.label || '').match(/berdasarkan\s+([^(\[]+)/i);
  if (match && match[1]) {
    return match[1].trim();
  }

  return selected.descrip || 'Kategori / Deskripsi';
}

function renderTable(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    renderEmptyTable('Tidak ada data untuk filter ini');
    return;
  }

  const selected = getSelectedFunction();
  const selectedKecamatan = el.kecamatan?.value || '';
  const selectedKelurahan = el.kelurahan?.value || '';
  const selectedRw = el.rw?.value || '';
  const selectedRt = el.rt?.value || '';

  // 1. Cek apakah tampilan baris menggunakan UMUR atau DESCRIP
  // Laporan umur murni: baris menggunakan Umur (misal Umur 0, Umur 1...).
  // Laporan kategori (misal Golongan Darah, Agama, Pekerjaan): baris menggunakan DESCRIP (misal A, B, AB, O).
  const hasAgeData = selected
    ? Boolean(selected.has_umur)
    : rows.every((r) => !r.DESCRIP || r.DESCRIP === 'DEFAULT' || r.DESCRIP === 'Umur Tunggal' || r.DESCRIP === 'LAINNYA');

  // 2. Cek hierarki ketersediaan data RW dan RT
  const hasRtData = rows.some((r) => r.NO_RT !== null && r.NO_RT !== undefined && String(r.NO_RT).trim() !== '' && String(r.NO_RT).trim() !== 'Nul');
  const hasRwData = rows.some((r) => r.NO_RW !== null && r.NO_RW !== undefined && String(r.NO_RW).trim() !== '' && String(r.NO_RW).trim() !== 'Nul');

  // 3. Tentukan level pengelompokan (activeLevel) & data baris yang aktif
  let activeLevel = 'kec';
  let displayRows = rows;
  let wilayahColTitle = 'Kecamatan';

  if (selectedRt) {
    activeLevel = 'single_rt';
    displayRows = rows.filter((r) => {
      const rt = String(r.NO_RT ?? '').trim();
      return rt === selectedRt || parseInt(rt, 10) === parseInt(selectedRt, 10);
    });
    wilayahColTitle = 'Rukun Tetangga (RT)';
  } else if (selectedRw) {
    const rtRows = rows.filter((r) => {
      const rt = String(r.NO_RT ?? '').trim();
      const rw = String(r.NO_RW ?? '').trim();
      return rt && rt !== 'Nul' && rt !== 'null' && (rw === selectedRw || parseInt(rw, 10) === parseInt(selectedRw, 10));
    });
    if (rtRows.length > 0) {
      activeLevel = 'rt';
      displayRows = rtRows;
      wilayahColTitle = 'Rukun Tetangga (RT)';
    } else {
      activeLevel = 'single_rw';
      displayRows = rows.filter((r) => {
        const rw = String(r.NO_RW ?? '').trim();
        return rw === selectedRw || parseInt(rw, 10) === parseInt(selectedRw, 10);
      });
      wilayahColTitle = 'Rukun Warga (RW)';
    }
  } else if (selectedKelurahan) {
    const rwRows = rows.filter((r) => {
      const rw = String(r.NO_RW ?? '').trim();
      return rw && rw !== 'Nul' && rw !== 'null';
    });
    if (rwRows.length > 0) {
      activeLevel = 'rw';
      const rwSummaryRows = rwRows.filter((r) => {
        const rt = String(r.NO_RT ?? '').trim();
        return !rt || rt === 'Nul' || rt === 'null';
      });
      displayRows = rwSummaryRows.length > 0 ? rwSummaryRows : rwRows;
      wilayahColTitle = 'Rukun Warga (RW)';
    } else {
      activeLevel = 'single_kel';
      wilayahColTitle = 'Kelurahan';
    }
  } else if (selectedKecamatan) {
    activeLevel = 'kel';
    const kelRows = rows.filter((r) => {
      const kel = String(r.NO_KEL ?? '').trim();
      return kel && kel !== 'Nul' && kel !== 'null';
    });
    displayRows = kelRows.length > 0 ? kelRows : rows;
    wilayahColTitle = 'Kelurahan';
  } else {
    activeLevel = 'kec';
    wilayahColTitle = 'Kemantren (Kecamatan)';
  }

  const groupMap = new Map();
  const rowMap = new Map();
  const rowOrderMap = new Map();

  displayRows.forEach((row) => {
    let groupCode = '';
    let groupKey = '';
    let groupLabel = '';

    if (activeLevel === 'rt' || activeLevel === 'single_rt') {
      const rtCode = String(row.NO_RT ?? '').trim();
      const rtNum = parseInt(rtCode, 10);
      groupCode = !isNaN(rtNum) ? String(rtNum).padStart(2, '0') : (rtCode || '00');
      groupKey = `rt:${groupCode}`;
      groupLabel = `RT ${groupCode}`;
    } else if (activeLevel === 'rw' || activeLevel === 'single_rw') {
      const rwCode = String(row.NO_RW ?? '').trim();
      const rwNum = parseInt(rwCode, 10);
      groupCode = !isNaN(rwNum) ? String(rwNum).padStart(2, '0') : (rwCode || '00');
      groupKey = `rw:${groupCode}`;
      groupLabel = `RW ${groupCode}`;
    } else if (activeLevel === 'kel' || activeLevel === 'single_kel') {
      const kecCode = String(row.NO_KEC ?? '').trim();
      const kelCode = String(row.NO_KEL ?? '').trim();
      groupCode = kelCode || kecCode || '000';
      groupKey = `kel:${kecCode}:${groupCode}`;
      groupLabel = kelCode ? getKelurahanLabel(kecCode, kelCode) : getKecamatanLabel(kecCode);
    } else {
      const kecCode = String(row.NO_KEC ?? '').trim();
      groupCode = kecCode || '000';
      groupKey = `kec:${groupCode}`;
      groupLabel = getKecamatanLabel(kecCode);
    }

    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, { key: groupKey, code: groupCode, label: groupLabel });
    }

    // Tentukan label baris (Kategori atau Umur)
    let rowLabel = '';
    if (hasAgeData) {
      const u = row.UMUR !== null && row.UMUR !== undefined ? String(row.UMUR).trim() : '';
      rowLabel = u ? `Umur ${u}` : (String(row.DESCRIP ?? 'LAINNYA').trim() || 'LAINNYA');
    } else {
      rowLabel = String(row.DESCRIP ?? 'LAINNYA').trim() || 'LAINNYA';
    }

    // Simpan urutan deskripsi NO (1, 2, 3...)
    if (row.NO !== null && row.NO !== undefined && !rowOrderMap.has(rowLabel)) {
      rowOrderMap.set(rowLabel, parseNumericValue(row.NO));
    }

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

  // Urutan baris: berdasarkan NO urut jika ada, atau umur numerik
  const rowLabels = [...rowMap.keys()].sort((a, b) => {
    if (hasAgeData) {
      const numA = parseInt(a.replace(/\D/g, ''), 10);
      const numB = parseInt(b.replace(/\D/g, ''), 10);
      if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
        return numA - numB;
      }
    }
    const orderA = rowOrderMap.get(a) ?? 99999;
    const orderB = rowOrderMap.get(b) ?? 99999;
    if (orderA !== orderB) return orderA - orderB;
    return a.localeCompare(b, 'id', { numeric: true, sensitivity: 'base' });
  });

  if (!groups.length || !rowLabels.length) {
    renderEmptyTable('Tidak ada data untuk filter ini');
    return;
  }

  const valuesFor = (label, group) => {
    const item = rowMap.get(label).get(group.key);
    if (!item) return '<td>0</td><td>0</td><td><strong>0</strong></td>';
    return `<td>${Number(item.male).toLocaleString('id-ID')}</td><td>${Number(item.female).toLocaleString('id-ID')}</td><td><strong>${Number(item.total).toLocaleString('id-ID')}</strong></td>`;
  };

  const categoryColName = getCategoryColumnTitle(selected, hasAgeData);

  let headers;
  let body;
  if (tableOrientation === 'horizontal') {
    const groupHeaders = groups.map((group) =>
      `<th colspan="3">${escapeHtml(group.label)}</th>`
    ).join('');
    const subHeaders = groups.map(() => '<th><span style="color:#93c5fd;font-weight:700;">L</span></th><th><span style="color:#f9a8d4;font-weight:700;">P</span></th><th><span style="color:#ffffff;font-weight:700;">Jml</span></th>').join('');
    headers = `<tr><th class="col-no" rowspan="2">No</th><th class="row-label" rowspan="2">${categoryColName}</th>${groupHeaders}</tr><tr>${subHeaders}</tr>`;
    body = rowLabels.map((label, index) => {
      const cells = groups.map((group) => valuesFor(label, group)).join('');
      return `<tr><td class="col-no">${index + 1}</td><td class="row-label">${escapeHtml(label)}</td>${cells}</tr>`;
    }).join('');
  } else {
    const categoryHeaders = rowLabels.map((label) => `<th colspan="3">${escapeHtml(label)}</th>`).join('');
    const subHeaders = rowLabels.map(() => '<th><span style="color:#93c5fd;font-weight:700;">L</span></th><th><span style="color:#f9a8d4;font-weight:700;">P</span></th><th><span style="color:#ffffff;font-weight:700;">Jml</span></th>').join('');
    headers = `<tr><th class="col-no" rowspan="2">No</th><th class="row-label" rowspan="2">${wilayahColTitle}</th>${categoryHeaders}</tr><tr>${subHeaders}</tr>`;
    body = groups.map((group, index) => {
      const cells = rowLabels.map((label) => valuesFor(label, group)).join('');
      return `<tr><td class="col-no">${index + 1}</td><td class="row-label">${escapeHtml(group.label)}</td>${cells}</tr>`;
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
  if (!Array.isArray(rows) || rows.length === 0) {
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    return;
  }

  const selected = getSelectedFunction();
  const isDkb = selected && (selected.tipe === 'DKB' || String(selected.sect || '').startsWith('89') || String(selected.sect || '').includes('9'));
  const hasAgeData = selected
    ? Boolean(selected.has_umur)
    : rows.every((r) => !r.DESCRIP || r.DESCRIP === 'DEFAULT' || r.DESCRIP === 'Umur Tunggal' || r.DESCRIP === 'LAINNYA');
  const categoryTitle = getCategoryColumnTitle(selected, hasAgeData);

  const selectedKecamatan = el.kecamatan?.value || '';
  const selectedKelurahan = el.kelurahan?.value || '';
  const selectedRw = el.rw?.value || '';
  const selectedRt = el.rt?.value || '';

  const hasRtData = rows.some((r) => r.NO_RT !== null && r.NO_RT !== undefined && String(r.NO_RT).trim() !== '' && String(r.NO_RT).trim() !== 'Nul');
  const hasRwData = rows.some((r) => r.NO_RW !== null && r.NO_RW !== undefined && String(r.NO_RW).trim() !== '' && String(r.NO_RW).trim() !== 'Nul');

  let activeLevel = 'kec';
  let chartRows = rows;
  let chartLabelTitle = 'Jumlah Penduduk';

  if (selectedRt) {
    activeLevel = 'single_rt';
    chartLabelTitle = `Distribusi ${categoryTitle} - RT ${String(parseInt(selectedRt, 10) || selectedRt).padStart(2, '0')}`;
    chartRows = rows.filter((r) => {
      const rt = String(r.NO_RT ?? '').trim();
      return rt === selectedRt || parseInt(rt, 10) === parseInt(selectedRt, 10);
    });
  } else if (selectedRw) {
    const rtRows = rows.filter((r) => {
      const rt = String(r.NO_RT ?? '').trim();
      const rw = String(r.NO_RW ?? '').trim();
      return rt && rt !== 'Nul' && rt !== 'null' && (rw === selectedRw || parseInt(rw, 10) === parseInt(selectedRw, 10));
    });
    if (rtRows.length > 0) {
      activeLevel = 'rt';
      chartRows = rtRows;
      chartLabelTitle = `Jumlah Penduduk per RT (RW ${String(parseInt(selectedRw, 10) || selectedRw).padStart(2, '0')})`;
    } else {
      activeLevel = 'single_rw';
      chartRows = rows.filter((r) => {
        const rw = String(r.NO_RW ?? '').trim();
        return rw === selectedRw || parseInt(rw, 10) === parseInt(selectedRw, 10);
      });
      chartLabelTitle = `Distribusi ${categoryTitle} - RW ${String(parseInt(selectedRw, 10) || selectedRw).padStart(2, '0')}`;
    }
  } else if (selectedKelurahan) {
    const rwRows = rows.filter((r) => {
      const rw = String(r.NO_RW ?? '').trim();
      return rw && rw !== 'Nul' && rw !== 'null';
    });
    if (rwRows.length > 0) {
      activeLevel = 'rw';
      const rwSummaryRows = rwRows.filter((r) => {
        const rt = String(r.NO_RT ?? '').trim();
        return !rt || rt === 'Nul' || rt === 'null';
      });
      chartRows = rwSummaryRows.length > 0 ? rwSummaryRows : rwRows;
      chartLabelTitle = 'Jumlah Penduduk per RW';
    } else {
      activeLevel = 'single_kel';
      chartLabelTitle = `Distribusi ${categoryTitle} - Kelurahan ${getKelurahanLabel(selectedKecamatan, selectedKelurahan)}`;
    }
  } else if (selectedKecamatan) {
    activeLevel = 'kel';
    const kelRows = rows.filter((r) => {
      const kel = String(r.NO_KEL ?? '').trim();
      return kel && kel !== 'Nul' && kel !== 'null';
    });
    chartRows = kelRows.length > 0 ? kelRows : rows;
    chartLabelTitle = 'Jumlah Penduduk per Kelurahan';
  } else {
    activeLevel = 'kec';
    chartLabelTitle = 'Jumlah Penduduk per Kecamatan';
  }

  const grouped = {};
  chartRows.forEach((row) => {
    let key = '';
    if (activeLevel === 'single_rt' || activeLevel === 'single_rw' || activeLevel === 'single_kel') {
      if (hasAgeData) {
        const u = row.UMUR !== null && row.UMUR !== undefined ? String(row.UMUR).trim() : '';
        key = u ? `Umur ${u}` : (String(row.DESCRIP ?? 'LAINNYA').trim() || 'LAINNYA');
      } else {
        key = String(row.DESCRIP || 'LAINNYA').trim();
      }
    } else if (activeLevel === 'rt') {
      const rtVal = String(row.NO_RT || '00').trim();
      const rtNum = parseInt(rtVal, 10);
      key = !isNaN(rtNum) ? `RT ${String(rtNum).padStart(2, '0')}` : `RT ${rtVal}`;
    } else if (activeLevel === 'rw') {
      const rwVal = String(row.NO_RW || '00').trim();
      const rwNum = parseInt(rwVal, 10);
      key = !isNaN(rwNum) ? `RW ${String(rwNum).padStart(2, '0')}` : `RW ${rwVal}`;
    } else if (activeLevel === 'kel') {
      const kec = String(row.NO_KEC || '');
      const kel = String(row.NO_KEL || '');
      key = getKelurahanLabel(kec, kel);
    } else if (activeLevel === 'kec') {
      const kec = String(row.NO_KEC || '000');
      key = getKecamatanLabel(kec);
    } else {
      key = String(row.DESCRIP || 'LAINNYA');
    }

    const value = parseNumericValue(
      row.JUMLAH || (parseNumericValue(row.LAKI_LAKI || row.LK || 0) + parseNumericValue(row.PEREMPUAN || row.PR || 0))
    );

    grouped[key] = (grouped[key] || 0) + value;
  });

  const labels = Object.keys(grouped).sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));
  const data = labels.map((k) => grouped[k]);

  if (!labels.length) {
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    return;
  }

  if (chartInstance) chartInstance.destroy();

  const pelayananPalette = ['#2563eb', '#0284c7', '#4f46e5', '#0891b2', '#6366f1', '#38bdf8', '#818cf8', '#0ea5e9', '#1d4ed8'];
  const dkbPalette = ['#059669', '#10b981', '#d97706', '#0d9488', '#f59e0b', '#047857', '#14b8a6', '#b45309', '#34d399'];
  const palette = isDkb ? dkbPalette : pelayananPalette;

  chartInstance = new Chart(el.chartCanvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: chartLabelTitle,
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

  [el.tanggal, el.fungsi, el.kecamatan, el.kelurahan, el.rw, el.rt].forEach((element) => {
    if (!element) return;

    element.addEventListener('change', () => {
      if (element === el.kecamatan) {
        refreshKelurahanOptions();
        if (!el.kecamatan.value && el.kelurahan) {
          el.kelurahan.value = '';
        }
        if (el.rw) el.rw.value = '';
        if (el.rt) el.rt.value = '';
        refreshRwOptions();
      } else if (element === el.kelurahan) {
        if (el.rw) el.rw.value = '';
        if (el.rt) el.rt.value = '';
        refreshRwOptions();
      } else if (element === el.rw) {
        if (el.rt) el.rt.value = '';
        refreshRtOptions();
      }
      fetchFilteredData();
    });
  });
}

setDefaultViewState();
updateOrientationControls();
initTipeFilterTabs();
loadFilterOptions();
bindFilterEvents();
bindOrientationControl();

document.getElementById('btn-download')?.addEventListener('click', (event) => {
  event.preventDefault();
  return false;
});
