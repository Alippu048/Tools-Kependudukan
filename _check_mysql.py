import app
import mysql.connector as mc

print('DB_CONFIG=', app.DB_CONFIG)
conn = None
try:
    conn = mc.connect(
        host=app.DB_CONFIG['host'],
        port=app.DB_CONFIG['port'],
        user=app.DB_CONFIG['user'],
        password=app.DB_CONFIG['password'],
        database=app.DB_CONFIG['database'],
        connect_timeout=5,
    )
    print('CONNECTION_OK')
except Exception as e:
    print('CONNECTION_FAILED:', type(e).__name__, str(e))
finally:
    if conn is not None:
        conn.close()
