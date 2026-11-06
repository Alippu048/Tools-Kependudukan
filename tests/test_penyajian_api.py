import unittest
from unittest.mock import patch
import app
import importer


class FakeCursor:
    def __init__(self, rows=None, columns=None):
        self.rows = rows or []
        self.columns = columns or [
            {"Field": "IDEM"},
            {"Field": "TANGGAL"},
            {"Field": "NO_PROP"},
            {"Field": "NO_KAB"},
            {"Field": "NO_KEC"},
            {"Field": "NO_KEL"},
            {"Field": "NO_RW"},
            {"Field": "NO_RT"},
            {"Field": "LAKI_LAKI"},
            {"Field": "PEREMPUAN"},
            {"Field": "JUMLAH"},
            {"Field": "UMUR"},
            {"Field": "NO"},
            {"Field": "DESCRIP"},
            {"Field": "SECT"}
        ]
        self.query = ""
        self.params = None

    def execute(self, query, params=None):
        self.query = query
        self.params = params

    def fetchall(self):
        if "SHOW COLUMNS" in self.query:
            return self.columns
        return self.rows

    def fetchone(self):
        res = self.fetchall()
        return res[0] if res else None

    def close(self):
        pass


class FakeConnection:
    def __init__(self, cursor):
        self._cursor = cursor
        self.closed = False

    def cursor(self, dictionary=True):
        return self._cursor

    def close(self):
        self.closed = True


class PenyajianApiTests(unittest.TestCase):
    def setUp(self):
        app.app.config["TESTING"] = True
        self.client = app.app.test_client()

    def test_filter_options_returns_40_functions_with_types_and_numbers(self):
        response = self.client.get("/api/penyajian/filter-options")
        self.assertEqual(response.status_code, 200)

        data = response.get_json()
        self.assertTrue(data.get("success"))

        fungsi_list = data["data"]["fungsi"]
        self.assertEqual(len(fungsi_list), 40)

        # Check numbering 1..40
        numbers = [f["no"] for f in fungsi_list]
        self.assertEqual(numbers, list(range(1, 41)))

        # Check types
        pelayanan = [f for f in fungsi_list if f["tipe"] == "Pelayanan"]
        dkb = [f for f in fungsi_list if f["tipe"] == "DKB"]
        self.assertEqual(len(pelayanan), 21)
        self.assertEqual(len(dkb), 19)

        # Check duplicate base function names are differentiated by SECT and tipe
        wni_funcs = [f for f in fungsi_list if f["descrip"] == "Jumlah Penduduk WNI dan OA"]
        self.assertEqual(len(wni_funcs), 2)
        wni_pelayanan = next((f for f in wni_funcs if f["tipe"] == "Pelayanan"), None)
        wni_dkb = next((f for f in wni_funcs if f["tipe"] == "DKB"), None)

        self.assertIsNotNone(wni_pelayanan)
        self.assertIsNotNone(wni_dkb)
        self.assertEqual(wni_pelayanan["sect"], "801")
        self.assertEqual(wni_dkb["sect"], "891")
        self.assertIn("Pelayanan", wni_pelayanan["label"])
        self.assertIn("DKB", wni_dkb["label"])

        # Check age functions have has_umur = True
        age_funcs = [f for f in fungsi_list if f["has_umur"]]
        self.assertEqual(len(age_funcs), 10)
        self.assertTrue(all(f["sect"] in {"804", "894", "808", "898", "303", "393", "304", "394", "807", "897"} for f in age_funcs))

    def test_filter_options_labels_do_not_contain_sector_numbers(self):
        response = self.client.get("/api/penyajian/filter-options")
        data = response.get_json()
        fungsi_list = data["data"]["fungsi"]

        # User is general public, sector numbers (SECT xxx) must not appear in the dropdown labels
        for f in fungsi_list:
            self.assertNotIn("(SECT", f["label"].upper())
            self.assertNotIn("(SECT", f.get("short_label", "").upper())

    def test_penyajian_data_filters_by_composite_descrip_and_sect(self):
        fake_cursor = FakeCursor(rows=[
            {
                "TANGGAL": "2026-06-30",
                "NO_PROP": "34",
                "NO_KAB": "71",
                "NO_KEC": "01",
                "NO_KEL": "1001",
                "NO_RW": None,
                "NO_RT": None,
                "LAKI_LAKI": "100",
                "PEREMPUAN": "120",
                "JUMLAH": "220",
                "UMUR": None,
                "NO": "1",
                "DESCRIP": "Jumlah Penduduk WNI dan OA",
                "SECT": "801"
            }
        ])
        fake_conn = FakeConnection(fake_cursor)

        with patch.object(app, "get_mysql_connection", return_value=fake_conn):
            response = self.client.get("/api/penyajian/data?descrip=Jumlah%20Penduduk%20WNI%20dan%20OA%7C%7C%7C801")

        self.assertEqual(response.status_code, 200)
        json_data = response.get_json()
        self.assertTrue(json_data.get("success"))
        self.assertEqual(len(json_data["rows"]), 1)

        # Verify query had SECT = %s and non-age condition
        self.assertIn("SECT", fake_cursor.query)
        self.assertIn("801", fake_cursor.params)
        self.assertIn("UMUR IS NULL", fake_cursor.query)

    def test_penyajian_data_filters_age_functions_with_umur_not_null(self):
        fake_cursor = FakeCursor(rows=[
            {
                "TANGGAL": "2026-06-30",
                "NO_PROP": "34",
                "NO_KAB": "71",
                "NO_KEC": "01",
                "NO_KEL": "1001",
                "NO_RW": None,
                "NO_RT": None,
                "LAKI_LAKI": "50",
                "PEREMPUAN": "45",
                "JUMLAH": "95",
                "UMUR": "0",
                "NO": "1",
                "DESCRIP": "Jumlah Penduduk Berdasarkan Kelompok Umur",
                "SECT": "804"
            }
        ])
        fake_conn = FakeConnection(fake_cursor)

        with patch.object(app, "get_mysql_connection", return_value=fake_conn):
            response = self.client.get("/api/penyajian/data?sect=804")

        self.assertEqual(response.status_code, 200)
        self.assertIn("UMUR IS NOT NULL", fake_cursor.query)

    def test_kelurahan_query_includes_rw_level_when_rw_not_selected(self):
        fake_cursor = FakeCursor(rows=[])
        fake_conn = FakeConnection(fake_cursor)

        with patch.object(app, "get_mysql_connection", return_value=fake_conn):
            response = self.client.get("/api/penyajian/data?no_kec=01&no_kel=1001")

        self.assertEqual(response.status_code, 200)
        self.assertIn("NO_KEC = %s", fake_cursor.query)
        self.assertIn("NO_KEL = %s", fake_cursor.query)
        # IDEM constraint must not exclude RW rows (which have IDEM 6 in SECT 894/291)
        self.assertNotIn("IDEM IN ('4', '5')", fake_cursor.query)

    def test_rw_query_includes_rt_level_when_rt_not_selected(self):
        fake_cursor = FakeCursor(rows=[])
        fake_conn = FakeConnection(fake_cursor)

        with patch.object(app, "get_mysql_connection", return_value=fake_conn):
            response = self.client.get("/api/penyajian/data?no_kec=01&no_kel=1001&no_rw=01")

        self.assertEqual(response.status_code, 200)
        self.assertIn("NO_RW", fake_cursor.query)
        self.assertIn("01", fake_cursor.params)
        # IDEM constraint must not exclude RT rows (which have IDEM 7 in SECT 894)
        self.assertNotIn("IDEM IN ('5', '6')", fake_cursor.query)

    def test_preview_columns_order_matches_specification(self):
        expected_columns = [
            "IDEM", "TANGGAL", "NO_PROP", "NO_KAB", "NO_KEC", "NO_KEL", "NO_RW", "NO_RT",
            "LAKI_LAKI", "PEREMPUAN", "JUMLAH", "UMUR", "NO", "DESCRIP", "SECT"
        ]
        self.assertEqual(importer.DATABASE_COLUMNS, expected_columns)


if __name__ == "__main__":
    unittest.main()
