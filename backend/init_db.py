# backend/init_db.py
import sqlite3
import os
import json

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "data.db")

# Remove existing DB if you want a fresh start (optional)
# if os.path.exists(DB_PATH): os.remove(DB_PATH)

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

cur.execute("CREATE TABLE IF NOT EXISTS profile (id INTEGER PRIMARY KEY, data TEXT)")
cur.execute("CREATE TABLE IF NOT EXISTS products (barcode TEXT PRIMARY KEY, name TEXT, ingredients TEXT)")

# Default profile (example) - single user demo
default_profile = {"allergies": ["peanuts"], "avoid": ["milk", "soy"]}

# Insert or replace profile ID 1
cur.execute("INSERT OR REPLACE INTO profile (id, data) VALUES (1, ?)", (json.dumps(default_profile),))

# Example products
products = [
    ("1234567890123", "Example Oreo-style Cookies", ["wheat", "sugar", "cocoa", "soy lecithin"]),
    ("9876543210987", "Crunchy Peanut Butter", ["peanuts", "salt", "oil"]),
    ("8801073113312", "Noodles", ["milk", "sugar", "cocoa butter"]),
    ("05574237460", "tomato paste", ["sugar", "milk", "cocoa", "peanuts"]),
]

for barcode, name, ingredients in products:
    cur.execute("INSERT OR REPLACE INTO products (barcode, name, ingredients) VALUES (?, ?, ?)",
                (barcode, name, json.dumps(ingredients)))

conn.commit()
conn.close()
print("Initialized database at", DB_PATH)
