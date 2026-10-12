from app import app

client = app.test_client()

for path in ['/penyajian', '/penyajian_dkb.html', '/api/penyajian/filter-options']:
    try:
        response = client.get(path)
        print(path, '->', response.status_code)
        print(response.get_data(as_text=True)[:200])
    except Exception as exc:
        print(path, '-> EXCEPTION', type(exc).__name__, str(exc))
