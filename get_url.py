import urllib.request
import json

req = urllib.request.Request(
    'https://api.render.com/v1/services/srv-d778ie14tr6s739fe15g/env-vars',
    headers={'Authorization': 'Bearer rnd_BPID8LPoTe6lCHM7MIQ8gaygh64t'}
)
with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode())
    for item in data:
        key = item['envVar']['key']
        value = item['envVar']['value']
        if key == 'DATABASE_URL':
            print(f"FOUND DB URL: {value}")
