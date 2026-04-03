import sqlite3
import pprint
conn = sqlite3.connect(r"d:\Travail\FLARE AI\Flare Group\Flare AI\Antigravity\FLARE AI\V2\claude\backend\flare.db")
c = conn.cursor()
c.execute("SELECT user_id, value FROM system_settings WHERE key='system_prompt'")
pprint.pprint(c.fetchall())
