# backend/app.py
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
import os
import requests

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__, static_folder=os.path.join(BASE_DIR, "..", "frontend"), static_url_path="/")
CORS(app)


@app.route("/")
def index():
    # Serve frontend index.html
    return send_from_directory(app.static_folder, "index.html")


def fetch_product_from_api(barcode):
    """
    Fetch product data from Open Food Facts API.
    Returns the product data dictionary or None if not found.
    """
    try:
        url = f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            # Open Food Facts API returns data in format: {"status": 1, "product": {...}}
            if data.get("status") == 1 and "product" in data:
                return data["product"]
        return None
    except Exception as e:
        print(f"Error fetching from Open Food Facts API: {e}")
        return None


def search_similar_barcodes(barcode, prefix_length=8, max_results=10):
    """
    Search for products with barcodes that start with the same prefix.
    Returns a list of products with matching barcode prefixes.
    """
    if not barcode or len(barcode) < prefix_length:
        return []
    
    # Get the prefix (first N digits)
    prefix = barcode[:prefix_length]
    similar_products = []
    existing_barcodes = set()
    
    try:
        # Try different approaches to find similar barcodes
        # Approach 1: Try searching with the prefix using search API
        url = f"https://world.openfoodfacts.org/cgi/search.pl"
        params = {
            "search_terms": prefix,
            "search_simple": "1",
            "action": "process",
            "json": "1",
            "page_size": 50  # Get more to filter
        }
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            products = data.get("products", [])
            
            # Filter products that actually start with the prefix
            for product in products:
                product_code = str(product.get("code", ""))
                if product_code.startswith(prefix) and product_code != barcode and product_code not in existing_barcodes:
                    # Extract useful information
                    product_name = product.get("product_name") or product.get("product_name_en") or "Unknown Product"
                    similar_products.append({
                        "barcode": product_code,
                        "productName": product_name,
                        "image_url": product.get("image_url"),
                        "brands": product.get("brands", "")
                    })
                    existing_barcodes.add(product_code)
                    
                    # Limit results
                    if len(similar_products) >= max_results:
                        break
        
        # If we didn't find enough results, try with shorter prefix
        if len(similar_products) < 5 and prefix_length > 6:
            # Try with one digit less (recursive)
            shorter_results = search_similar_barcodes(barcode, prefix_length - 1, max_results - len(similar_products))
            # Add unique results
            for product in shorter_results:
                if product["barcode"] not in existing_barcodes:
                    similar_products.append(product)
                    existing_barcodes.add(product["barcode"])
                    if len(similar_products) >= max_results:
                        break
        
    except Exception as e:
        print(f"Error searching similar barcodes: {e}")
    
    return similar_products[:max_results]


# -------- Scan endpoint: lookup by barcode using Open Food Facts API --------
@app.route("/api/scan/<barcode>", methods=["GET"])
def scan_barcode(barcode):
    # Search in Open Food Facts API
    product_data = fetch_product_from_api(barcode)
    
    if not product_data:
        # Search for similar barcodes
        similar_products = search_similar_barcodes(barcode, prefix_length=8, max_results=10)
        
        return jsonify({
            "error": "i cant find it :)",
            "similarProducts": similar_products
        }), 404
    
    # Extract key information
    product_name = product_data.get("product_name") or product_data.get("product_name_en") or product_data.get("abbreviated_product_name") or "Unknown Product"
    
    # Parse ingredients
    ingredients_text = product_data.get("ingredients_text") or product_data.get("ingredients_text_en") or ""
    ingredients_list = []
    if ingredients_text:
        # Split by comma and clean up
        ingredients_list = [ing.strip() for ing in str(ingredients_text).split(",") if ing.strip()]
    
    # Also check ingredients array if available
    if not ingredients_list and "ingredients" in product_data:
        ingredients = product_data.get("ingredients", [])
        if isinstance(ingredients, list):
            ingredients_list = [ing.get("text", "") for ing in ingredients if isinstance(ing, dict) and ing.get("text")]
    
    return jsonify({
        "productName": product_name,
        "ingredients": ingredients_list,
        "allData": product_data  # Return all API data
    })


if __name__ == "__main__":
    # run dev server
    app.run(host="0.0.0.0", port=5000, debug=True)
