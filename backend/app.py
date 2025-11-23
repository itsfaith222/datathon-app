# backend/app.py
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "data.db")

app = Flask(__name__, static_folder=os.path.join(BASE_DIR, "..", "frontend"), static_url_path="/")
CORS(app)


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


@app.route("/")
def index():
    # Serve frontend index.html
    return send_from_directory(app.static_folder, "index.html")


# -------- Profile endpoints (single-user simple profile for demo) --------
@app.route("/api/profile", methods=["GET"])
def get_profile():
    conn = get_db()
    cur = conn.execute("SELECT data FROM profile WHERE id = 1")
    row = cur.fetchone()
    conn.close()
    if not row:
        return jsonify({"allergies": [], "avoid": []})
    import json
    return jsonify(json.loads(row["data"]))


@app.route("/api/profile", methods=["POST"])
def save_profile():
    data = request.get_json() or {}
    import json
    allergies = data.get("allergies", [])
    avoid = data.get("avoid", [])
    payload = json.dumps({"allergies": allergies, "avoid": avoid})
    conn = get_db()
    conn.execute("INSERT OR REPLACE INTO profile (id, data) VALUES (1, ?)", (payload,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


# -------- Product endpoints --------
@app.route("/api/product", methods=["POST"])
def add_product():
    """
    POST JSON:
    {
      "barcode": "0123456789012",
      "name": "Chocolate Bar",
      "ingredients": ["sugar", "milk", "cocoa", "peanuts"]
    }
    """
    data = request.get_json() or {}
    barcode = data.get("barcode")
    name = data.get("name")
    ingredients = data.get("ingredients")
    if not ingredients or not isinstance(ingredients, list):
        return jsonify({"error": "ingredients (array) required"}), 400

    import json
    conn = get_db()
    # store ingredients as JSON text
    conn.execute(
        "INSERT OR REPLACE INTO products (barcode, name, ingredients) VALUES (?, ?, ?)",
        (barcode, name, json.dumps(ingredients)),
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/product/<id>", methods=["GET"])
def get_product(id):
    conn = get_db()
    cur = conn.execute("SELECT name, ingredients FROM products WHERE barcode = ? OR barcode = ?", (id, id))
    row = cur.fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "not found"}), 404
    import json
    return jsonify({"name": row["name"], "ingredients": json.loads(row["ingredients"])})


# -------- Scan endpoint: lookup by barcode and check against profile --------
@app.route("/api/scan/<barcode>", methods=["GET"])
def scan_barcode(barcode):
    conn = get_db()
    cur = conn.execute("SELECT name, ingredients FROM products WHERE barcode = ?", (barcode,))
    prod = cur.fetchone()
    if not prod:
        conn.close()
        # not in DB -> return 404 so frontend can handle or we can say 'not found'
        return jsonify({"error": "product not found"}), 404

    import json
    ingredients = [i.lower().strip() for i in json.loads(prod["ingredients"])]

    # fetch profile
    cur2 = conn.execute("SELECT data FROM profile WHERE id = 1")
    row = cur2.fetchone()
    conn.close()
    profile = {"allergies": [], "avoid": []}
    if row:
        profile = json.loads(row["data"])

    flagged = []
    for a in profile.get("allergies", []):
        if a and a.lower().strip() in ingredients:
            flagged.append({"type": "allergy", "item": a})

    for a in profile.get("avoid", []):
        if a and a.lower().strip() in ingredients:
            flagged.append({"type": "avoid", "item": a})

    return jsonify({
        "productName": prod["name"],
        "safe": len(flagged) == 0,
        "flagged": flagged
    })


# Simple health check
@app.route("/api/ping")
def ping():
    return jsonify({"ok": True})


if __name__ == "__main__":
    # run dev server
    app.run(host="0.0.0.0", port=5000, debug=True)
