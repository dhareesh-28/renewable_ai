import os
import re

pages = ['Home', 'Forecast', 'Energy', 'Cost', 'Models', 'NotFound']
for p in pages:
    path = rf'c:\Users\dhare\EVS_Project\renewable_ai\frontend\src\pages\{p}.tsx'
    with open(path, 'r', encoding='utf-8') as f:
        t = f.read()
    h1_matches = re.findall(r'<h1|as=["\']h1["\']', t)
    print(f'{p}: {len(h1_matches)} h1 element(s)')

