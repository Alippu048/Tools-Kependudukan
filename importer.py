import os
import re
import atexit
import pandas as pd
import mysql.connector

DATABASE_COLUMNS = [
    "IDEM", "TANGGAL", "NO_PROP", "NO_KAB", "NO_KEC", "NO_KEL", "NO_RW", "NO_RT",
    "LAKI_LAKI", "PEREMPUAN", "JUMLAH", "UMUR", "NO", "DESCRIP", "SECT"
]

DATABASE_CONNECTION = None
INSERT_BATCH_SIZE = 250

# ============================================================
# NORMALISASI NAMA KOLOM
# ============================================================

def normalisasi_kolom(column):
    col = str(column).upper().strip()
    col = re.sub(r"[^A-Z0-9]+", "_", col)
    col = re.sub(r"_+", "_", col)
    return col.strip("_")


# ============================================================
# DETEKSI POLA L / P / JML
# ============================================================

TOTAL_PREFIXES = ("JML_", "JUMLAH_", "TOTAL_")
MALE_PREFIXES = ("LAKI_LAKI_", "LAKI_", "LK_", "L_")
FEMALE_PREFIXES = ("PEREMPUAN_", "PR_", "P_")

TOTAL_SUFFIXES = ("_JUMLAH", "_JML", "_TOTAL", " JML", " JUMLAH", " TOTAL")
MALE_SUFFIXES = ("_LAKI_LAKI", "_LAKI", "_LK", "_L", " L", " LK", " LAKI", " LAKI_LAKI")
FEMALE_SUFFIXES = ("_PEREMPUAN", "_PR", "_P", " P", " PR", " PEREMPUAN")

SPECIAL_COLUMNS = {
    "NO", "IDEM", "UMUR", "KEL_UMUR", "RENTANG_UMUR", "USIA", "KELOMPOK_UMUR",
    "NO_RW", "NO_RT", "RW", "RT", "TANGGAL", "DATE", "WILAYAH", "WIL",
    "KODE", "KODE_WILAYAH", "KODE_WIL", "KODE_ADM",
    "KODE_KELURAHAN", "KODE_DESA", "KODE_KECAMATAN",
    "KODE_KEC", "NO_PROP", "NO_KAB", "NO_KEC", "NO_KEL"
}


def parse_column(column):
    raw = str(column).strip()
    col = normalisasi_kolom(column)

    if col in SPECIAL_COLUMNS:
        return {"type": None, "descrip": None}

    if col in ("L", "LK", "LAKI", "LAKI_LAKI"):
        return {"type": "male", "descrip": "DEFAULT"}

    if col in ("P", "PR", "PEREMPUAN"):
        return {"type": "female", "descrip": "DEFAULT"}

    if col in ("JML", "JUMLAH", "TOTAL"):
        return {"type": "total", "descrip": "DEFAULT"}

    # Suffixes (prioritas cek dari string mentah agar spasi terbaca)
    for sfx in sorted(MALE_SUFFIXES, key=len, reverse=True):
        if raw.upper().endswith(sfx) and len(raw) > len(sfx):
            d = raw[:-len(sfx)].strip(" _")
            if d and normalisasi_kolom(d) not in SPECIAL_COLUMNS:
                return {"type": "male", "descrip": d}

    for sfx in sorted(FEMALE_SUFFIXES, key=len, reverse=True):
        if raw.upper().endswith(sfx) and len(raw) > len(sfx):
            d = raw[:-len(sfx)].strip(" _")
            if d and normalisasi_kolom(d) not in SPECIAL_COLUMNS:
                return {"type": "female", "descrip": d}

    for sfx in sorted(TOTAL_SUFFIXES, key=len, reverse=True):
        if raw.upper().endswith(sfx) and len(raw) > len(sfx):
            d = raw[:-len(sfx)].strip(" _")
            if d and normalisasi_kolom(d) not in SPECIAL_COLUMNS:
                return {"type": "total", "descrip": d}

    # Prefixes
    for prefix in sorted(TOTAL_PREFIXES, key=len, reverse=True):
        if col.startswith(prefix) and col[len(prefix):]:
            d = col[len(prefix):].strip("_")
            if d not in SPECIAL_COLUMNS:
                return {"type": "total", "descrip": d}

    for prefix in sorted(MALE_PREFIXES, key=len, reverse=True):
        if col.startswith(prefix) and col[len(prefix):]:
            d = col[len(prefix):].strip("_")
            if d not in SPECIAL_COLUMNS:
                return {"type": "male", "descrip": d}

    for prefix in sorted(FEMALE_PREFIXES, key=len, reverse=True):
        if col.startswith(prefix) and col[len(prefix):]:
            d = col[len(prefix):].strip("_")
            if d not in SPECIAL_COLUMNS:
                return {"type": "female", "descrip": d}

    return {"type": None, "descrip": None}


def find_pattern_groups(df):
    groups = {}

    for column in df.columns:
        parsed = parse_column(column)
        if not parsed["type"] or not parsed["descrip"]:
            continue

        descrip = parsed["descrip"]
        groups.setdefault(descrip, {"male": None, "female": None, "total": None})
        groups[descrip][parsed["type"]] = column

    return groups


def detect_pattern_columns(df):
    detected = []
    for column in df.columns:
        parsed = parse_column(column)
        if parsed["type"]:
            detected.append({
                "column": str(column),
                "type": parsed["type"],
                "descrip": parsed["descrip"]
            })
    return detected


# ============================================================
# KODE WILAYAH & RW / RT
# ============================================================

def find_region_code_column(df):
    known_names = {
        "KODE", "KODE_WILAYAH", "KODE_WIL", "KODE_ADM",
        "KODE_WILAYAH_ADMINISTRASI", "KODE_KELURAHAN",
        "KODE_DESA", "KODE_KECAMATAN", "KODE_KEC"
    }

    for column in df.columns:
        if normalisasi_kolom(column) in known_names:
            return column

    for column in df.columns:
        values = df[column].dropna().astype(str).str.strip()
        if values.empty:
            continue

        sample = values.head(30)
        matches = 0
        for value in sample:
            clean = re.sub(r"\.0$", "", value)
            if re.fullmatch(r"\d{2}(?:\.\d{2}){1,3}(?:\.RW(?:\.RT)?)?", clean, re.IGNORECASE):
                matches += 1
            elif re.fullmatch(r"\d{4}|\d{6}|\d{10}", clean):
                matches += 1

        if matches >= max(1, int(len(sample) * 0.5)):
            return column

    return None


def find_wilayah_name_column(df):
    for col in df.columns:
        norm = normalisasi_kolom(col)
        if norm in {"WILAYAH", "WIL", "NAMA_WILAYAH", "NAMA_WIL"}:
            return col
    return None


def split_region_code(value):
    result = {"NO_PROP": None, "NO_KAB": None, "NO_KEC": None, "NO_KEL": None}

    if pd.isna(value):
        return result

    value = str(value).strip()
    value = re.sub(r"\.0$", "", value)

    if "." in value:
        parts = value.split(".")
        if len(parts) >= 1:
            result["NO_PROP"] = parts[0]
        if len(parts) >= 2:
            result["NO_KAB"] = parts[1]
        if len(parts) >= 3:
            result["NO_KEC"] = parts[2]
        if len(parts) >= 4:
            result["NO_KEL"] = parts[3]
        return result

    if value.isdigit():
        if len(value) == 10:
            result["NO_PROP"] = value[0:2]
            result["NO_KAB"] = value[2:4]
            result["NO_KEC"] = value[4:6]
            result["NO_KEL"] = value[6:10]
        elif len(value) == 6:
            result["NO_PROP"] = value[0:2]
            result["NO_KAB"] = value[2:4]
            result["NO_KEC"] = value[4:6]
        elif len(value) == 4:
            result["NO_PROP"] = value[0:2]
            result["NO_KAB"] = value[2:4]

    return result


def parse_region_and_rwrt(kode, wil):
    result = {
        "NO_PROP": None, "NO_KAB": None, "NO_KEC": None, "NO_KEL": None,
        "NO_RW": None, "NO_RT": None
    }
    if pd.isna(kode):
        return result

    s_kode = str(kode).strip()
    s_wil = str(wil).strip() if not pd.isna(wil) else ""

    if ".RW.RT" in s_kode.upper():
        base = re.sub(r"\.RW\.RT.*$", "", s_kode, flags=re.IGNORECASE)
        parts = base.split(".")
        if len(parts) >= 1: result["NO_PROP"] = parts[0]
        if len(parts) >= 2: result["NO_KAB"] = parts[1]
        if len(parts) >= 3: result["NO_KEC"] = parts[2]
        if len(parts) >= 4: result["NO_KEL"] = parts[3]
        if "." in s_wil:
            wparts = s_wil.split(".")
            result["NO_RW"] = wparts[0]
            result["NO_RT"] = wparts[1]
        elif s_wil:
            result["NO_RW"] = s_wil
        return result

    if ".RW" in s_kode.upper():
        base = re.sub(r"\.RW.*$", "", s_kode, flags=re.IGNORECASE)
        parts = base.split(".")
        if len(parts) >= 1: result["NO_PROP"] = parts[0]
        if len(parts) >= 2: result["NO_KAB"] = parts[1]
        if len(parts) >= 3: result["NO_KEC"] = parts[2]
        if len(parts) >= 4: result["NO_KEL"] = parts[3]
        if s_wil:
            result["NO_RW"] = s_wil
        return result

    clean = re.sub(r"\.0$", "", s_kode)
    if "." in clean:
        parts = clean.split(".")
        if len(parts) >= 1: result["NO_PROP"] = parts[0]
        if len(parts) >= 2: result["NO_KAB"] = parts[1]
        if len(parts) >= 3: result["NO_KEC"] = parts[2]
        if len(parts) >= 4: result["NO_KEL"] = parts[3]
        return result

    if clean.isdigit():
        if len(clean) == 10:
            result["NO_PROP"] = clean[0:2]
            result["NO_KAB"] = clean[2:4]
            result["NO_KEC"] = clean[4:6]
            result["NO_KEL"] = clean[6:10]
        elif len(clean) == 6:
            result["NO_PROP"] = clean[0:2]
            result["NO_KAB"] = clean[2:4]
            result["NO_KEC"] = clean[4:6]
        elif len(clean) == 4:
            result["NO_PROP"] = clean[0:2]
            result["NO_KAB"] = clean[2:4]

    return result


# ============================================================
# ANGKA
# ============================================================

def numeric_series(df, column):
    if not column or column not in df.columns:
        return pd.Series([None] * len(df), index=df.index, dtype="object")

    series = df[column]

    def to_text(value):
        if pd.isna(value):
            return None

        text = str(value).strip()
        if text.upper() in {"", "-", "--", "N/A", "NA", "NULL", "NONE", "NAN"}:
            return None

        # Excel sering dibaca pandas dengan titik desimal. Simpan sebagai
        # teks berkoma agar nilainya mengikuti tampilan lokal Excel.
        if "," not in text and "." in text:
            text = text.replace(".", ",")

        if re.fullmatch(r"-?\d+,0+", text):
            text = text.split(",", 1)[0]

        return text

    return series.map(to_text).astype("object")


# ============================================================
# DETEKSI UMUR & RW / RT KHUSUS
# ============================================================

def get_age_series(df):
    for col in df.columns:
        norm = normalisasi_kolom(col)
        if norm in {"UMUR", "KEL_UMUR", "RENTANG_UMUR", "USIA", "KELOMPOK_UMUR"}:
            def clean_age(val):
                if pd.isna(val):
                    return None
                text = str(val).strip()
                if text.upper() in {"", "-", "NULL", "NONE", "NAN"}:
                    return None
                if re.fullmatch(r"-?\d+\.0+", text):
                    text = text.split(".", 1)[0]
                return text or None
            return df[col].map(clean_age).astype("object"), True

    return pd.Series([None] * len(df), index=df.index, dtype="object"), False


def source_text_series(df, target_column):
    aliases = {
        "NO_RW": {"NO_RW", "RW"},
        "NO_RT": {"NO_RT", "RT"},
        "UMUR": {"UMUR", "KEL_UMUR", "RENTANG_UMUR", "USIA", "KELOMPOK_UMUR"}
    }
    accepted_names = aliases.get(target_column, {target_column})
    source_column = next(
        (column for column in df.columns if normalisasi_kolom(column) in accepted_names),
        None
    )
    if source_column is None:
        return pd.Series([None] * len(df), index=df.index, dtype="object")

    def to_text(value):
        if pd.isna(value):
            return None

        text = str(value).strip()
        if re.fullmatch(r"-?\d+\.0+", text):
            return text.split(".", 1)[0]
        return text or None

    return df[source_column].map(to_text).astype("object")


def add_region_columns(temp, df, region_column):
    for col in ["NO_PROP", "NO_KAB", "NO_KEC", "NO_KEL"]:
        temp[col] = None

    if region_column and region_column in df.columns:
        region = df[region_column].apply(split_region_code)
        for col in ["NO_PROP", "NO_KAB", "NO_KEC", "NO_KEL"]:
            temp[col] = region.apply(lambda x: x[col])

    return temp


# ============================================================
# PEMBENTUKAN DATA (UNIVERSAL ENGINE)
# ============================================================

def create_database_output(df, sect=None, tanggal=None, nomor=None):
    if df is None or df.empty:
        return pd.DataFrame(columns=DATABASE_COLUMNS), {
            "region_column": None,
            "groups": {},
            "detected": []
        }

    # 1. Wilayah dasar (NO_PROP, NO_KAB, NO_KEC, NO_KEL, NO_RW, NO_RT)
    has_direct_region = all(c in df.columns for c in ["NO_PROP", "NO_KAB", "NO_KEC", "NO_KEL"])
    region_col = find_region_code_column(df)
    wil_col = find_wilayah_name_column(df)

    base_region = pd.DataFrame(index=df.index)
    if has_direct_region:
        for c in ["NO_PROP", "NO_KAB", "NO_KEC", "NO_KEL"]:
            base_region[c] = df[c].map(lambda x: None if pd.isna(x) else str(x).strip())
        base_region["NO_RW"] = None
        base_region["NO_RT"] = None
    elif region_col:
        parsed_rows = [parse_region_and_rwrt(r[region_col], r[wil_col] if wil_col else None) for _, r in df.iterrows()]
        parsed_df = pd.DataFrame(parsed_rows, index=df.index)
        for c in ["NO_PROP", "NO_KAB", "NO_KEC", "NO_KEL", "NO_RW", "NO_RT"]:
            base_region[c] = parsed_df[c].map(lambda x: None if pd.isna(x) else str(x))
    else:
        for c in ["NO_PROP", "NO_KAB", "NO_KEC", "NO_KEL", "NO_RW", "NO_RT"]:
            base_region[c] = None

    # RW dan RT: Hanya mengambil file yang memiliki data RW dan RT!
    # Cek kolom eksplisit jika belum terisi dari KODE/WILAYAH
    for col in df.columns:
        norm = normalisasi_kolom(col)
        if norm in {"NO_RW", "RW"} and base_region["NO_RW"].isna().all():
            base_region["NO_RW"] = df[col].map(lambda x: None if pd.isna(x) else str(x).strip().replace(".0", ""))
        if norm in {"NO_RT", "RT"} and base_region["NO_RT"].isna().all():
            base_region["NO_RT"] = df[col].map(lambda x: None if pd.isna(x) else str(x).strip().replace(".0", ""))

    # 2. IDEM: ambil langsung dari file jika ada, jika tidak ada tetap None
    idem_series = source_text_series(df, "IDEM")

    # 3. UMUR: Hanya mengambil file yang memiliki data umur!
    age_series, file_has_age = get_age_series(df)

    # 4. Deteksi Kolom Kategori Vertikal (isi sel adalah kategori)
    cat_col = None
    for col in df.columns:
        norm = normalisasi_kolom(col)
        if norm in {"PENDIDIKAN", "AGAMA", "PEKERJAAN", "STATUS_KAWIN", "STATUS_HUB_KELUARGA", "JENIS_DISABILITAS", "KATEGORI", "DESCRIP", "DESKRIPSI"}:
            cat_col = col
            break

    # 5. Deteksi Pola Kolom Wide
    groups = find_pattern_groups(df)

    results = []

    # Pola A: Wide Pattern Groups
    if groups and (not cat_col or len(groups) > 1):
        all_numeric_groups = all(re.fullmatch(r"\d+|\d+-\d+", str(k)) for k in groups.keys())

        for descrip_key, group in groups.items():
            male, female, total = group["male"], group["female"], group["total"]
            if not any([male, female, total]):
                continue

            temp = pd.DataFrame(index=df.index)
            temp["IDEM"] = idem_series
            temp["TANGGAL"] = tanggal
            for c in ["NO_PROP", "NO_KAB", "NO_KEC", "NO_KEL", "NO_RW", "NO_RT"]:
                temp[c] = base_region[c]

            if all_numeric_groups:
                temp["UMUR"] = str(descrip_key)
                temp["DESCRIP"] = "Umur Tunggal"
            else:
                temp["UMUR"] = age_series if file_has_age else None
                temp["DESCRIP"] = str(descrip_key)

            temp["LAKI_LAKI"] = numeric_series(df, male)
            temp["PEREMPUAN"] = numeric_series(df, female)
            temp["JUMLAH"] = numeric_series(df, total) if total else None
            temp["SECT"] = str(sect).strip() if sect else None
            temp["NO"] = None
            results.append(temp[DATABASE_COLUMNS])

    # Pola B: Vertikal (Kategori di Isi Kolom/Baris)
    elif cat_col:
        male_col = next((c for c in df.columns if normalisasi_kolom(c) in {"L", "LK", "LAKI", "LAKI_LAKI"} or normalisasi_kolom(c).endswith(("_L", "_LK"))), None)
        female_col = next((c for c in df.columns if normalisasi_kolom(c) in {"P", "PR", "PEREMPUAN"} or normalisasi_kolom(c).endswith(("_P", "_PR"))), None)
        total_col = next((c for c in df.columns if normalisasi_kolom(c) in {"JML", "JUMLAH", "TOTAL"} or normalisasi_kolom(c).endswith(("_JML", "_TOTAL"))), None)

        temp = pd.DataFrame(index=df.index)
        temp["IDEM"] = idem_series
        temp["TANGGAL"] = tanggal
        for c in ["NO_PROP", "NO_KAB", "NO_KEC", "NO_KEL", "NO_RW", "NO_RT"]:
            temp[c] = base_region[c]

        temp["UMUR"] = age_series if file_has_age else None
        temp["DESCRIP"] = df[cat_col].map(lambda x: None if pd.isna(x) else str(x).strip())
        temp["LAKI_LAKI"] = numeric_series(df, male_col)
        temp["PEREMPUAN"] = numeric_series(df, female_col)
        temp["JUMLAH"] = numeric_series(df, total_col) if total_col else None
        temp["SECT"] = str(sect).strip() if sect else None
        temp["NO"] = None
        results.append(temp[DATABASE_COLUMNS])

    # Pola C: Kolom Langsung (Direct L / P / JML)
    else:
        male_col = next((c for c in df.columns if normalisasi_kolom(c) in {"L", "LK", "LAKI", "LAKI_LAKI"}), None)
        female_col = next((c for c in df.columns if normalisasi_kolom(c) in {"P", "PR", "PEREMPUAN"}), None)
        total_col = next((c for c in df.columns if normalisasi_kolom(c) in {"JML", "JUMLAH", "TOTAL"}), None)

        if male_col or female_col or total_col:
            temp = pd.DataFrame(index=df.index)
            temp["IDEM"] = idem_series
            temp["TANGGAL"] = tanggal
            for c in ["NO_PROP", "NO_KAB", "NO_KEC", "NO_KEL", "NO_RW", "NO_RT"]:
                temp[c] = base_region[c]

            temp["UMUR"] = age_series if file_has_age else None
            temp["DESCRIP"] = "DEFAULT"
            temp["LAKI_LAKI"] = numeric_series(df, male_col)
            temp["PEREMPUAN"] = numeric_series(df, female_col)
            temp["JUMLAH"] = numeric_series(df, total_col) if total_col else None
            temp["SECT"] = str(sect).strip() if sect else None
            temp["NO"] = None
            results.append(temp[DATABASE_COLUMNS])

    if not results:
        return pd.DataFrame(columns=DATABASE_COLUMNS), {
            "region_column": region_col,
            "groups": groups,
            "detected": detect_pattern_columns(df)
        }

    combined = pd.concat(results, ignore_index=True)

    # 6. ATURAN NOMOR:
    # "nomer yang tersedia pada tabel data_laporan_penduduk adalah nomer urutan deskrip
    # dari 1 file dengan sect yang sama, lalu fungsi data agregat dibedakan menggunakan nomer SECT,
    # no hanya fokus pada nomer deskript."
    unique_descrips = []
    for d in combined["DESCRIP"]:
        if pd.notna(d) and d not in unique_descrips:
            unique_descrips.append(d)

    desc_to_no = {d: str(idx + 1) for idx, d in enumerate(unique_descrips)}
    combined["NO"] = combined["DESCRIP"].map(lambda d: desc_to_no.get(d, "1"))

    for col in DATABASE_COLUMNS:
        if col in combined.columns:
            combined[col] = pd.Series([None if pd.isna(x) else x for x in combined[col]], dtype=object)

    return combined, {
        "region_column": region_col,
        "groups": groups,
        "detected": detect_pattern_columns(df)
    }


def create_from_pattern_groups(df, region_column, groups, sect=None, tanggal=None, nomor=None):
    output, _ = create_database_output(df, sect=sect, tanggal=tanggal, nomor=nomor)
    return output


# ============================================================
# ANALISIS SATU FILE
# ============================================================

def analyze_file(file_path, sect=None, tanggal=None, nomor=None):
    df = pd.read_excel(file_path)
    database_df, meta = create_database_output(df, sect, tanggal, nomor)

    return {
        "rows": len(df),
        "columns": len(df.columns),
        "column_names": [str(c) for c in df.columns],
        "region_column": meta.get("region_column"),
        "groups": meta.get("groups", {}),
        "detected": meta.get("detected", []),
        "database_df": database_df
    }


# ============================================================
# ANALISIS BANYAK FILE
# ============================================================

def analyze_files(files):
    all_database = []
    file_results = []

    for item in files:
        file_path = item["path"]
        filename = item.get("filename") or os.path.basename(file_path)
        sect = item.get("sect") or None
        tanggal = item.get("tanggal") or None
        nomor = item.get("nomor") or None

        try:
            result = analyze_file(file_path, sect, tanggal, nomor)
            database_df = result["database_df"].copy()

            file_results.append({
                "filename": filename,
                "success": True,
                "message": "Berhasil diproses.",
                "rows": result["rows"],
                "columns": result["columns"],
                "region_column": str(result["region_column"]) if result["region_column"] is not None else None,
                "groups": result["groups"],
                "detected": result["detected"],
                "database_rows": len(database_df),
                "sect": sect,
                "tanggal": tanggal,
                "nomor": nomor
            })

            if not database_df.empty:
                all_database.append(database_df)

        except Exception as e:
            file_results.append({
                "filename": filename,
                "success": False,
                "message": str(e),
                "rows": 0,
                "columns": 0,
                "region_column": None,
                "groups": {},
                "detected": [],
                "database_rows": 0,
                "sect": sect,
                "tanggal": tanggal,
                "nomor": nomor
            })

    if all_database:
        combined = pd.concat(all_database, ignore_index=True)
    else:
        combined = pd.DataFrame(columns=DATABASE_COLUMNS)

    return {
        "files": file_results,
        "database_df": combined,
        "total_files": len(files),
        "success_files": sum(1 for x in file_results if x["success"]),
        "failed_files": sum(1 for x in file_results if not x["success"]),
        "database_rows": len(combined)
    }


# ============================================================
# DATABASE
# ============================================================

def connect_database(host, port, user, password, database):
    return mysql.connector.connect(
        host=host,
        port=int(port),
        user=user,
        password=password,
        database=database
    )


def close_database_connection():
    global DATABASE_CONNECTION

    if DATABASE_CONNECTION is not None:
        try:
            if DATABASE_CONNECTION.is_connected():
                DATABASE_CONNECTION.close()
        finally:
            DATABASE_CONNECTION = None


atexit.register(close_database_connection)


def get_database_connection(host, port, user, password, database):
    global DATABASE_CONNECTION

    if DATABASE_CONNECTION is None:
        DATABASE_CONNECTION = connect_database(
            host,
            port,
            user,
            password,
            database
        )
    else:
        DATABASE_CONNECTION.ping(
            reconnect=True,
            attempts=3,
            delay=2
        )

    return DATABASE_CONNECTION


def upload_to_database(database_df, db_config):
    if database_df is None or database_df.empty:
        raise ValueError("Tidak ada data untuk di-upload.")

    connection = get_database_connection(
        db_config["host"],
        db_config["port"],
        db_config["user"],
        db_config["password"],
        db_config["database"]
    )

    cursor = None
    try:
        cursor = connection.cursor()

        columns = ", ".join(f"`{c}`" for c in DATABASE_COLUMNS)
        placeholders = ", ".join(["%s"] * len(DATABASE_COLUMNS))

        sql = f"""
            INSERT INTO `{db_config['table']}`
            ({columns})
            VALUES ({placeholders})
        """

        data = []
        for _, row in database_df.iterrows():
            values = []
            for column in DATABASE_COLUMNS:
                value = row[column]
                values.append(None if pd.isna(value) else value)
            data.append(tuple(values))

        inserted_count = 0
        for start in range(0, len(data), INSERT_BATCH_SIZE):
            cursor.executemany(sql, data[start:start + INSERT_BATCH_SIZE])
            inserted_count += cursor.rowcount

        connection.commit()
        return inserted_count

    except Exception:
        try:
            connection.rollback()
        except mysql.connector.Error:
            pass
        raise

    finally:
        if cursor:
            cursor.close()
