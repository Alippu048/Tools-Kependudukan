import os
import mysql.connector

conn = mysql.connector.connect(
    host=os.getenv('DB_HOST', 'localhost'),
    port=int(os.getenv('DB_PORT', '3306')),
    user=os.getenv('DB_USER', 'root'),
    password=os.getenv('DB_PASSWORD', ''),
    database=os.getenv('DB_NAME', 'SIAKOFF'),
    autocommit=True,
)
cur = conn.cursor(dictionary=True)
cur.execute("SELECT COUNT(*) AS cnt FROM DATA_LAPORAN_PENDUDUK")
print('TOTAL_ROWS', cur.fetchone()['cnt'])
cur.execute("SELECT SECT, DESCRIP, COUNT(*) AS c FROM DATA_LAPORAN_PENDUDUK GROUP BY SECT, DESCRIP ORDER BY SECT, DESCRIP LIMIT 20")
rows = cur.fetchall()
print('SAMPLE_ROWS', rows)
cur.execute("SELECT SECT, DESCRIP FROM DATA_LAPORAN_PENDUDUK WHERE SECT = '801' OR SECT = '891' LIMIT 5")
print('MATCH_801_891', cur.fetchall())
