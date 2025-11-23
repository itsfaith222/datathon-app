# backend/app.py
from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS
import os
import requests
import json
from dataset_loader import check_ingredient_against_restrictions

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROFILE_FILE = os.path.join(BASE_DIR, "profile.json")
HISTORY_FILE = os.path.join(BASE_DIR, "history.json")

app = Flask(__name__, static_folder=os.path.join(BASE_DIR, "..", "frontend"), static_url_path="/")
CORS(app)

# In-memory storage (fallback if files don't exist)
user_profile = {"allergies": [], "restrictions": []}
saved_items = []  # Last 2 scanned items

def load_profile():
    """Load user profile from file or return default."""
    global user_profile
    try:
        if os.path.exists(PROFILE_FILE):
            with open(PROFILE_FILE, 'r') as f:
                user_profile = json.load(f)
        return user_profile
    except Exception as e:
        print(f"Error loading profile: {e}")
        return {"allergies": [], "restrictions": []}


def save_profile(profile):
    """Save user profile to file."""
    global user_profile
    try:
        user_profile = profile
        with open(PROFILE_FILE, 'w') as f:
            json.dump(profile, f)
        return True
    except Exception as e:
        print(f"Error saving profile: {e}")
        return False


def load_history():
    """Load saved items history from file or return empty list."""
    global saved_items
    try:
        if os.path.exists(HISTORY_FILE):
            with open(HISTORY_FILE, 'r') as f:
                saved_items = json.load(f)
        return saved_items
    except Exception as e:
        print(f"Error loading history: {e}")
        return []


def save_history(items):
    """Save items history to file (keep only last 2)."""
    global saved_items
    try:
        saved_items = items[-2:] if len(items) > 2 else items
        with open(HISTORY_FILE, 'w') as f:
            json.dump(saved_items, f)
        return True
    except Exception as e:
        print(f"Error saving history: {e}")
        return False


# Initialize on startup
load_profile()
load_history()


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


# -------- Profile endpoints --------
@app.route("/api/profile/restrictions", methods=["GET"])
def get_restrictions():
    """Get user's dietary restrictions and allergies."""
    profile = load_profile()
    return jsonify(profile)


@app.route("/api/profile/restrictions", methods=["POST"])
def save_restrictions():
    """Save user's dietary restrictions and allergies."""
    data = request.get_json() or {}
    allergies = data.get("allergies", [])
    restrictions = data.get("restrictions", [])
    
    profile = {
        "allergies": allergies if isinstance(allergies, list) else [],
        "restrictions": restrictions if isinstance(restrictions, list) else []
    }
    
    if save_profile(profile):
        return jsonify({"ok": True, "profile": profile})
    else:
        return jsonify({"error": "Failed to save profile"}), 500


def check_allergens_from_product_data(product_data, profile):
    """
    Check Open Food Facts allergen fields directly.
    Returns list of flagged allergens.
    """
    flagged = []
    user_allergies = [a.lower().strip() for a in profile.get("allergies", [])]
    
    if not user_allergies:
        return flagged
    
    # Check allergens_tags (most reliable - array format)
    allergens_tags = product_data.get("allergens_tags", [])
    if isinstance(allergens_tags, list):
        for allergen_tag in allergens_tags:
            # Open Food Facts format: "en:milk" -> extract "milk"
            # Remove language prefixes and common separators
            allergen_name = allergen_tag
            for prefix in ["en:", "fr:", "de:", "es:", "it:", "pt:"]:
                allergen_name = allergen_name.replace(prefix, "")
            allergen_name = allergen_name.replace("-", " ").replace("_", " ").strip()
            allergen_lower = allergen_name.lower()
            
            # Check against user allergies
            for user_allergy in user_allergies:
                user_allergy_lower = user_allergy.lower()
                # Check if allergen matches user allergy (bidirectional substring match)
                if (user_allergy_lower == allergen_lower or
                    user_allergy_lower in allergen_lower or 
                    allergen_lower in user_allergy_lower):
                    flagged.append({
                        "type": "allergy",
                        "item": user_allergy,
                        "ingredient": allergen_name,
                        "source": "allergens_tags"
                    })
                    break  # Don't flag same allergen twice
    
    # Check allergens text field
    allergens_text = product_data.get("allergens", "")
    if allergens_text and isinstance(allergens_text, str):
        allergens_text_lower = allergens_text.lower()
        for user_allergy in user_allergies:
            user_allergy_lower = user_allergy.lower()
            if user_allergy_lower in allergens_text_lower:
                # Check if not already flagged
                already_flagged = any(
                    f.get("item", "").lower() == user_allergy_lower and 
                    f.get("source") == "allergens_text"
                    for f in flagged
                )
                if not already_flagged:
                    flagged.append({
                        "type": "allergy",
                        "item": user_allergy,
                        "ingredient": allergens_text,
                        "source": "allergens_text"
                    })
    
    # Check allergens_from_ingredients
    allergens_from_ing = product_data.get("allergens_from_ingredients", "")
    if allergens_from_ing and isinstance(allergens_from_ing, str):
        allergens_from_ing_lower = allergens_from_ing.lower()
        for user_allergy in user_allergies:
            user_allergy_lower = user_allergy.lower()
            if user_allergy_lower in allergens_from_ing_lower:
                # Check if not already flagged
                already_flagged = any(
                    f.get("item", "").lower() == user_allergy_lower and 
                    f.get("source") == "allergens_from_ingredients"
                    for f in flagged
                )
                if not already_flagged:
                    flagged.append({
                        "type": "allergy",
                        "item": user_allergy,
                        "ingredient": allergens_from_ing,
                        "source": "allergens_from_ingredients"
                    })
    
    return flagged


# -------- Check ingredients endpoint --------
@app.route("/api/check", methods=["POST"])
def check_ingredients():
    """Check product ingredients against user restrictions."""
    data = request.get_json() or {}
    barcode = data.get("barcode")
    
    # Get user profile
    profile = load_profile()
    
    # Fetch product if barcode provided
    product_data = None
    if barcode:
        product_data = fetch_product_from_api(barcode)
    
    # Use provided product data or fetched data
    if not product_data and data.get("productData"):
        product_data = data.get("productData")
    
    if not product_data:
        return jsonify({"error": "Product data not found"}), 404
    
    flagged = []
    
    # FIRST: Check Open Food Facts allergen fields directly (most reliable)
    allergen_flags = check_allergens_from_product_data(product_data, profile)
    flagged.extend(allergen_flags)
    
    # SECOND: Extract and check ingredients
    ingredients_text = product_data.get("ingredients_text") or product_data.get("ingredients_text_en") or ""
    ingredients_list = []
    if ingredients_text:
        # Better parsing: split by comma, but also handle parentheses
        ingredients_list = [ing.strip() for ing in str(ingredients_text).split(",") if ing.strip()]
        # Also extract ingredients from parentheses (e.g., "milk powder (milk, whey)")
        for ing in ingredients_list[:]:  # Use slice to avoid modifying during iteration
            if "(" in ing and ")" in ing:
                # Extract content from parentheses
                start = ing.find("(")
                end = ing.find(")")
                if start < end:
                    nested = ing[start+1:end].strip()
                    nested_ingredients = [n.strip() for n in nested.split(",") if n.strip()]
                    ingredients_list.extend(nested_ingredients)
    
    # Also check ingredients array if available
    if not ingredients_list and "ingredients" in product_data:
        ingredients = product_data.get("ingredients", [])
        if isinstance(ingredients, list):
            ingredients_list = [ing.get("text", "") for ing in ingredients if isinstance(ing, dict) and ing.get("text")]
    
    # Check each ingredient against restrictions
    for ingredient in ingredients_list:
        result = check_ingredient_against_restrictions(ingredient, profile)
        if result:
            # Avoid duplicates
            already_flagged = any(
                f.get("ingredient", "").lower() == ingredient.lower() and
                f.get("item", "").lower() == result.get("item", "").lower()
                for f in flagged
            )
            if not already_flagged:
                flagged.append(result)
    
    return jsonify({
        "flagged": flagged,
        "hasIssues": len(flagged) > 0,
        "ingredientsChecked": len(ingredients_list),
        "productName": product_data.get("product_name") or product_data.get("product_name_en") or "Unknown"
    })


# -------- History endpoints --------
@app.route("/api/history", methods=["GET"])
def get_history():
    """Get saved items history (last 2 items)."""
    history = load_history()
    return jsonify({"items": history})


@app.route("/api/history", methods=["POST"])
def save_to_history():
    """Save an item to history (keep only last 2)."""
    data = request.get_json() or {}
    
    item = {
        "barcode": data.get("barcode"),
        "productName": data.get("productName"),
        "imageUrl": data.get("imageUrl"),
        "productData": data.get("productData")
    }
    
    # Load current history
    history = load_history()
    
    # Remove if already exists (to move to end)
    history = [h for h in history if h.get("barcode") != item.get("barcode")]
    
    # Add new item
    history.append(item)
    
    # Keep only last 2
    if save_history(history):
        return jsonify({"ok": True, "items": saved_items})
    else:
        return jsonify({"error": "Failed to save history"}), 500


if __name__ == "__main__":
    # run dev server
    app.run(host="0.0.0.0", port=5000, debug=True)
