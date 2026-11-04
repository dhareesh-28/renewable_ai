import urllib.request
import time

endpoints = [
    "http://127.0.0.1:8000/api/health",
    "http://127.0.0.1:8000/api/meta",
    "http://127.0.0.1:8000/api/compare?start=2026-05-26%2000:00:00&end=2026-05-26%2023:00:00",
    "http://127.0.0.1:8000/api/simulate?start=2026-05-26%2000:00:00&end=2026-05-26%2023:00:00",
    "http://127.0.0.1:8000/api/period-summary?granularity=month",
    "http://127.0.0.1:8000/api/period-summary?granularity=week",
    "http://127.0.0.1:8000/api/period-summary?granularity=day",
    "http://127.0.0.1:8000/api/model-performance",
    "http://127.0.0.1:8000/api/faults",
    "http://127.0.0.1:8000/api/outlook?start=2026-05-26%2000:00:00&horizon_hours=24",
]

for url in endpoints:
    t0 = time.time()
    try:
        with urllib.request.urlopen(url, timeout=60) as r:
            data = r.read()
            dt = (time.time() - t0) * 1000
            name = url.split("8000")[1]
            print(f"{name:<55} -> {r.status} in {dt:7.1f} ms ({len(data)} bytes)")
    except Exception as e:
        dt = (time.time() - t0) * 1000
        name = url.split("8000")[1]
        print(f"{name:<55} -> ERROR in {dt:7.1f} ms: {e}")

