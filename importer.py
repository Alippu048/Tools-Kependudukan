import os
import re
import atexit
import pandas as pd
import mysql.connector

DATABASE_COLUMNS = [
    "TANGGAL", "NO_PROP", "NO_KAB", "NO_KEC", "NO_KEL",
    "LAKI_LAKI", "PEREMPUAN", "JUMLAH", "NO", "DESCRIP", "SECT"
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

TOTAL_SUFFIXES = ("_JUMLAH", "_JML", "_TOTAL")
MALE_SUFFIXES = ("_LAKI_LAKI", "_LAKI", "_LK", "_L")
FEMALE_SUFFIXES = ("_PEREMPUAN", "_PR", "_P")

SPECIAL_COLUMNS = {
    "NO", "IDEM", "TANGGAL", "DATE", "WILAYAH",
    "KODE", "KODE_WILAYAH", "KODE_WIL", "KODE_ADM",
    "KODE_KELURAHAN", "KODE_DESA", "KODE_KECAMATAN",
    "KODE_KEC", "NO_PROP", "NO_KAB", "NO_KEC", "NO_KEL"
}


def parse_column(column):
    col = normalisasi_kolom(column)

    if col in SPECIAL_COLUMNS:
        return {"type": None, "descrip": None}

    if col in ("L", "LK", "LAKI", "LAKI_LAKI"):
        return {"type": "male", "descrip": "DEFAULT"}

    if col in ("P", "PR", "PEREMPUAN"):
        return {"type": "female", "descrip": "DEFAULT"}

    if col in ("JML", "JUMLAH", "TOTAL"):
        return {"type": "total", "descrip": "DEFAULT"}

    # Prefix harus dicek dari yang paling panjang.
    for prefix in sorted(TOTAL_PREFIXES, key=len, reverse=True):
        if col.startswith(prefix) and col[len(prefix):]:
            return {"type": "total", "descrip": col[len(prefix):].strip("_")}

    for prefix in sorted(MALE_PREFIXES, key=len, reverse=True):
        if col.startswith(prefix) and col[len(prefix):]:
            return {"type": "male", "descrip": col[len(prefix):].strip("_")}

    for prefix in sorted(FEMALE_PREFIXES, key=len, reverse=True):
        if col.startswith(prefix) and col[len(prefix):]:
            return {"type": "female", "descrip": col[len(prefix):].strip("_")}

    # Suffix.
    for suffix in sorted(TOTAL_SUFFIXES, key=len, reverse=True):
        if col.endswith(suffix) and col[:-len(suffix)]:
            return {"type": "total", "descrip": col[:-len(suffix)].strip("_")}

    for suffix in sorted(MALE_SUFFIXES, key=len, reverse=True):
        if col.endswith(suffix) and col[:-len(suffix)]:
            return {"type": "male", "descrip": col[:-len(suffix)].strip("_")}

    for suffix in sorted(FEMALE_SUFFIXES, key=len, reverse=True):
        if col.endswith(suffix) and col[:-len(suffix)]:
            return {"type": "female", "descrip": col[:-len(suffix)].strip("_")}

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
# KODE WILAYAH
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
            if re.fullmatch(r"\d{2}(?:\.\d{2}){1,3}", clean):
                matches += 1
            elif re.fullmatch(r"\d{4}|\d{6}|\d{10}", clean):
                matches += 1

        if matches >= max(1, int(len(sample) * 0.6)):
            return column

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
# PEMBENTUKAN DATA
# ============================================================

def add_region_columns(temp, df, region_column):
    for col in ["NO_PROP", "NO_KAB", "NO_KEC", "NO_KEL"]:
        temp[col] = None

    if region_column and region_column in df.columns:
        region = df[region_column].apply(split_region_code)
        for col in ["NO_PROP", "NO_KAB", "NO_KEC", "NO_KEL"]:
            temp[col] = region.apply(lambda x: x[col])

    return temp


def create_from_pattern_groups(df, region_column, groups, sect=None, tanggal=None, nomor=None):
    results = []

    for descrip, group in groups.items():
        male = group["male"]
        female = group["female"]
        total = group["total"]

        if not any([male, female, total]):
            continue

        temp = pd.DataFrame(index=df.index)
        temp["TANGGAL"] = tanggal
        temp = add_region_columns(temp, df, region_column)

        temp["LAKI_LAKI"] = numeric_series(df, male)
        temp["PEREMPUAN"] = numeric_series(df, female)

        if total:
            temp["JUMLAH"] = numeric_series(df, total)
        else:
            # Jangan menghitung nilai yang tidak ada di sumber Excel.
            temp["JUMLAH"] = None

        temp["NO"] = nomor
        temp["DESCRIP"] = descrip
        temp["SECT"] = sect
        results.append(temp[DATABASE_COLUMNS])

    if not results:
        return pd.DataFrame(columns=DATABASE_COLUMNS)

    return pd.concat(results, ignore_index=True)


def create_database_output(df, sect=None, tanggal=None, nomor=None):
    region_column = find_region_code_column(df)
    groups = find_pattern_groups(df)

    if groups:
        output = create_from_pattern_groups(
            df,
            region_column,
            groups,
            sect,
            tanggal,
            nomor
        )
        if not output.empty:
            return output, {
                "region_column": region_column,
                "groups": groups,
                "detected": detect_pattern_columns(df)
            }

    return pd.DataFrame(columns=DATABASE_COLUMNS), {
        "region_column": region_column,
        "groups": {},
        "detected": detect_pattern_columns(df)
    }


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
        "region_column": meta["region_column"],
        "groups": meta["groups"],
        "detected": meta["detected"],
        "database_df": database_df
    }


# ============================================================
# ANALISIS BANYAK FILE
# files = [{"path": ..., "filename": ..., "sect": ...}, ...]
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
                "tanggal": tanggal
                ,"nomor": nomor
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
                "tanggal": tanggal
                ,"nomor": nomor
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
