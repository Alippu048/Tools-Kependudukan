import unittest
import pandas as pd
from importer import create_database_output


class ImporterColumnTests(unittest.TestCase):
    def test_demographic_columns_are_copied_to_database_rows(self):
        source = pd.DataFrame({
            "idem": ["A-01", "A-02"],
            "Umur": [12, 35],
            "RW": ["01", "02"],
            "RT": ["003", "004"],
            "KODE_WILAYAH": ["34.71.01.0001", "34.71.01.0002"],
            "L_MMLK": [2, 3],
            "P_MMLK": [4, 5],
            "JML_MMLK": [6, 8],
        })

        database_df, _ = create_database_output(source, sect="01", tanggal="2026-01-01")

        self.assertEqual(database_df["IDEM"].tolist(), ["A-01", "A-02"])
        self.assertEqual(database_df["UMUR"].tolist(), ["12", "35"])
        self.assertEqual(database_df["NO_RW"].tolist(), ["01", "02"])
        self.assertEqual(database_df["NO_RT"].tolist(), ["003", "004"])

    def test_missing_source_columns_remain_null(self):
        source = pd.DataFrame({
            "KODE_WILAYAH": ["34.71.01.0001"],
            "L_MMLK": [2],
            "P_MMLK": [4],
            "JML_MMLK": [6],
        })

        database_df, _ = create_database_output(source)

        for column in ["IDEM", "UMUR", "NO_RW", "NO_RT"]:
            self.assertTrue(database_df[column].isna().all(), column)

    def test_no_is_sequential_deskrip_number_per_sect(self):
        source = pd.DataFrame({
            "KODE": ["34.71.01.1001", "34.71.01.1002"],
            "ISLAM L": [10, 20],
            "ISLAM P": [15, 25],
            "ISLAM JML": [25, 45],
            "KRISTEN L": [5, 6],
            "KRISTEN P": [7, 8],
            "KRISTEN JML": [12, 14],
            "KATHOLIK L": [1, 2],
            "KATHOLIK P": [3, 4],
            "KATHOLIK JML": [4, 6],
        })

        database_df, _ = create_database_output(source, sect="501", tanggal="2026-06-30")

        # Deskrip 1 (ISLAM) must have NO = "1"
        islam_rows = database_df[database_df["DESCRIP"] == "ISLAM"]
        self.assertTrue((islam_rows["NO"] == "1").all())
        self.assertTrue((islam_rows["SECT"] == "501").all())

        # Deskrip 2 (KRISTEN) must have NO = "2"
        kristen_rows = database_df[database_df["DESCRIP"] == "KRISTEN"]
        self.assertTrue((kristen_rows["NO"] == "2").all())

        # Deskrip 3 (KATHOLIK) must have NO = "3"
        katholik_rows = database_df[database_df["DESCRIP"] == "KATHOLIK"]
        self.assertTrue((katholik_rows["NO"] == "3").all())

        # UMUR, RW, RT should be null because this file has neither
        self.assertTrue(database_df["UMUR"].isna().all())
        self.assertTrue(database_df["NO_RW"].isna().all())
        self.assertTrue(database_df["NO_RT"].isna().all())

    def test_vertical_category_template(self):
        source = pd.DataFrame({
            "IDEM": ["3", "3"],
            "KODE": ["34.71.01", "34.71.01"],
            "WILAYAH": ["TEGALREJO", "TEGALREJO"],
            "PENDIDIKAN": ["TIDAK/BLM SEKOLAH", "TAMAT SD"],
            "L": [100, 200],
            "P": [120, 210],
            "JML": [220, 410]
        })

        database_df, _ = create_database_output(source, sect="101", tanggal="2026-06-30")

        self.assertEqual(len(database_df), 2)
        self.assertEqual(database_df["DESCRIP"].tolist(), ["TIDAK/BLM SEKOLAH", "TAMAT SD"])
        self.assertEqual(database_df["NO"].tolist(), ["1", "2"])
        self.assertEqual(database_df["NO_KEC"].tolist(), ["01", "01"])
        self.assertEqual(database_df["LAKI_LAKI"].tolist(), ["100", "200"])
        self.assertEqual(database_df["PEREMPUAN"].tolist(), ["120", "210"])
        self.assertEqual(database_df["JUMLAH"].tolist(), ["220", "410"])
        self.assertTrue(database_df["UMUR"].isna().all())

    def test_rw_and_rt_encoded_in_kode_and_wilayah(self):
        source = pd.DataFrame({
            "IDEM": ["4", "5", "6"],
            "KODE": ["34.71.01.1001", "34.71.01.1001.RW", "34.71.01.1001.RW.RT"],
            "WILAYAH": ["KRICAK", "013", "004.018"],
            "L": [500, 50, 10],
            "P": [520, 55, 12],
            "JML": [1020, 105, 22]
        })

        database_df, _ = create_database_output(source, sect="891", tanggal="2026-06-30")

        self.assertEqual(len(database_df), 3)
        # Row 0: kelurahan level
        self.assertEqual(database_df.iloc[0]["NO_KEL"], "1001")
        self.assertIsNone(database_df.iloc[0]["NO_RW"])
        self.assertIsNone(database_df.iloc[0]["NO_RT"])

        # Row 1: RW level
        self.assertEqual(database_df.iloc[1]["NO_KEL"], "1001")
        self.assertEqual(database_df.iloc[1]["NO_RW"], "013")
        self.assertIsNone(database_df.iloc[1]["NO_RT"])

        # Row 2: RT level
        self.assertEqual(database_df.iloc[2]["NO_KEL"], "1001")
        self.assertEqual(database_df.iloc[2]["NO_RW"], "004")
        self.assertEqual(database_df.iloc[2]["NO_RT"], "018")


if __name__ == "__main__":
    unittest.main()
