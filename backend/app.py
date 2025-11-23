# backend/app.py
from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS
import os
import requests
import json
from dataset.ingredient_checker import check_ingredient_against_restrictions

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROFILES_FILE = os.path.join(BASE_DIR, "profiles.json")
PROFILE_FILE = os.path.join(BASE_DIR, "profile.json")  # Legacy file
HISTORY_FILE = os.path.join(BASE_DIR, "history.json")
MEAL_PLANS_FILE = os.path.join(BASE_DIR, "meal_plans.json")

app = Flask(__name__, static_folder=os.path.join(BASE_DIR, "..", "frontend"), static_url_path="/")
CORS(app)

# In-memory storage (fallback if files don't exist)
saved_items = []  # Last 2 scanned items

def load_profiles():
    """Load all profiles from file or return default structure."""
    try:
        if os.path.exists(PROFILES_FILE):
            with open(PROFILES_FILE, 'r') as f:
                data = json.load(f)
                # Ensure structure is correct
                if isinstance(data, dict) and "profiles" in data:
                    return data
        # Try to migrate from old profile.json
        elif os.path.exists(PROFILE_FILE):
            with open(PROFILE_FILE, 'r') as f:
                old_profile = json.load(f)
                # Migrate old profile to new format
                profiles_data = {
                    "profiles": [{
                        "id": "default",
                        "name": "Default Profile",
                        "allergies": old_profile.get("allergies", []),
                        "restrictions": old_profile.get("restrictions", []),
                        "createdAt": "2024-01-01T00:00:00Z"
                    }],
                    "activeProfileId": "default"
                }
                save_profiles(profiles_data)
                return profiles_data
        # Return default structure
        return {
            "profiles": [{
                "id": "default",
                "name": "Default Profile",
                "allergies": [],
                "restrictions": [],
                "createdAt": "2024-01-01T00:00:00Z"
            }],
            "activeProfileId": "default"
        }
    except Exception as e:
        print(f"Error loading profiles: {e}")
        return {
            "profiles": [{
                "id": "default",
                "name": "Default Profile",
                "allergies": [],
                "restrictions": [],
                "createdAt": "2024-01-01T00:00:00Z"
            }],
            "activeProfileId": "default"
        }


def save_profiles(profiles_data):
    """Save all profiles to file."""
    try:
        with open(PROFILES_FILE, 'w') as f:
            json.dump(profiles_data, f, indent=2)
        return True
    except Exception as e:
        print(f"Error saving profiles: {e}")
        return False


def get_active_profile():
    """Get the currently active profile."""
    profiles_data = load_profiles()
    active_id = profiles_data.get("activeProfileId", "default")
    
    for profile in profiles_data.get("profiles", []):
        if profile.get("id") == active_id:
            return profile
    
    # If active profile not found, return first profile or default
    if profiles_data.get("profiles"):
        return profiles_data["profiles"][0]
    
    return {"id": "default", "name": "Default Profile", "allergies": [], "restrictions": []}


def load_profile():
    """Load active user profile (for backward compatibility)."""
    return get_active_profile()


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
# Initialize on startup
load_profiles()  # Initialize profiles system
load_history()

# Start background thread to load dataset
def preload_dataset():
    try:
        print("Pre-loading food allergens dataset...")
        from dataset.food_allergens_dataset import load_food_allergens_dataset
        load_food_allergens_dataset()
        print("Food allergens dataset pre-loaded.")
    except Exception as e:
        print(f"Failed to pre-load allergens dataset: {e}")
        
    try:
        print("Pre-loading food classification dataset...")
        from dataset.food_classification import load_food_classification_dataset
        load_food_classification_dataset()
        print("Food classification dataset pre-loaded.")
    except Exception as e:
        print(f"Failed to pre-load classification dataset: {e}")

import threading
threading.Thread(target=preload_dataset, daemon=True).start()


@app.route("/")
def index():
    # Serve frontend index.html
    return send_from_directory(app.static_folder, "index.html")


def fetch_product_from_api(barcode):
    """
    Fetch product data from Open Food Facts API.
    Returns (product_data, error_message).
    """
    try:
        url = f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            # Open Food Facts API returns data in format: {"status": 1, "product": {...}}
            if data.get("status") == 1 and "product" in data:
                return data["product"], None
            else:
                return None, "Product not found in Open Food Facts database"
        else:
            return None, f"API returned status code {response.status_code}"
    except requests.exceptions.Timeout:
        print(f"Timeout fetching from Open Food Facts API for {barcode}")
        return None, "Connection timed out. Please try again."
    except requests.exceptions.ConnectionError:
        print(f"Connection error fetching from Open Food Facts API for {barcode}")
        return None, "Connection error. Please check your internet connection."
    except Exception as e:
        print(f"Error fetching from Open Food Facts API: {e}")
        return None, f"Error: {str(e)}"


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
    product_data, error_msg = fetch_product_from_api(barcode)
    
    if not product_data:
        # Search for similar barcodes
        similar_products = search_similar_barcodes(barcode, prefix_length=8, max_results=10)
        
        return jsonify({
            "error": error_msg or "i cant find it :)",
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
@app.route("/api/profiles", methods=["GET"])
def list_profiles():
    """List all profiles."""
    profiles_data = load_profiles()
    return jsonify({
        "profiles": profiles_data.get("profiles", []),
        "activeProfileId": profiles_data.get("activeProfileId", "default")
    })


@app.route("/api/profiles", methods=["POST"])
def create_profile():
    """Create a new profile."""
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    
    if not name:
        return jsonify({"error": "Profile name is required"}), 400
    
    profiles_data = load_profiles()
    profiles = profiles_data.get("profiles", [])
    
    # Check if name already exists
    if any(p.get("name", "").lower() == name.lower() for p in profiles):
        return jsonify({"error": "Profile name already exists"}), 400
    
    # Generate unique ID
    import uuid
    profile_id = str(uuid.uuid4())
    
    new_profile = {
        "id": profile_id,
        "name": name,
        "allergies": data.get("allergies", []),
        "restrictions": data.get("restrictions", []),
        "createdAt": data.get("createdAt") or __import__("datetime").datetime.utcnow().isoformat() + "Z"
    }
    
    profiles.append(new_profile)
    profiles_data["profiles"] = profiles
    
    if save_profiles(profiles_data):
        return jsonify({"ok": True, "profile": new_profile}), 201
    else:
        return jsonify({"error": "Failed to create profile"}), 500


@app.route("/api/profiles/<profile_id>", methods=["GET"])
def get_profile(profile_id):
    """Get a specific profile by ID."""
    profiles_data = load_profiles()
    profiles = profiles_data.get("profiles", [])
    
    for profile in profiles:
        if profile.get("id") == profile_id:
            return jsonify(profile)
    
    return jsonify({"error": "Profile not found"}), 404


@app.route("/api/profiles/<profile_id>", methods=["PUT"])
def update_profile(profile_id):
    """Update a profile."""
    data = request.get_json() or {}
    profiles_data = load_profiles()
    profiles = profiles_data.get("profiles", [])
    
    for i, profile in enumerate(profiles):
        if profile.get("id") == profile_id:
            # Update allowed fields
            if "name" in data:
                new_name = data["name"].strip()
                if not new_name:
                    return jsonify({"error": "Profile name cannot be empty"}), 400
                # Check if name conflicts with another profile
                if any(p.get("name", "").lower() == new_name.lower() and p.get("id") != profile_id for p in profiles):
                    return jsonify({"error": "Profile name already exists"}), 400
                profiles[i]["name"] = new_name
            
            if "allergies" in data:
                profiles[i]["allergies"] = data["allergies"] if isinstance(data["allergies"], list) else []
            
            if "restrictions" in data:
                profiles[i]["restrictions"] = data["restrictions"] if isinstance(data["restrictions"], list) else []
            
            profiles_data["profiles"] = profiles
            
            if save_profiles(profiles_data):
                return jsonify({"ok": True, "profile": profiles[i]})
            else:
                return jsonify({"error": "Failed to update profile"}), 500
    
    return jsonify({"error": "Profile not found"}), 404


@app.route("/api/profiles/<profile_id>", methods=["DELETE"])
def delete_profile(profile_id):
    """Delete a profile."""
    profiles_data = load_profiles()
    profiles = profiles_data.get("profiles", [])
    
    # Don't allow deleting the last profile
    if len(profiles) <= 1:
        return jsonify({"error": "Cannot delete the last profile"}), 400
    
    # Find and remove profile
    original_count = len(profiles)
    profiles = [p for p in profiles if p.get("id") != profile_id]
    
    if len(profiles) == original_count:
        return jsonify({"error": "Profile not found"}), 404
    
    # If deleted profile was active, set first profile as active
    if profiles_data.get("activeProfileId") == profile_id:
        profiles_data["activeProfileId"] = profiles[0]["id"]
    
    profiles_data["profiles"] = profiles
    
    if save_profiles(profiles_data):
        return jsonify({"ok": True})
    else:
        return jsonify({"error": "Failed to delete profile"}), 500


@app.route("/api/profiles/active", methods=["POST"])
def set_active_profile():
    """Set the active profile."""
    data = request.get_json() or {}
    profile_id = data.get("profileId") or data.get("id")
    
    if not profile_id:
        return jsonify({"error": "Profile ID is required"}), 400
    
    profiles_data = load_profiles()
    profiles = profiles_data.get("profiles", [])
    
    # Verify profile exists
    if not any(p.get("id") == profile_id for p in profiles):
        return jsonify({"error": "Profile not found"}), 404
    
    profiles_data["activeProfileId"] = profile_id
    
    if save_profiles(profiles_data):
        return jsonify({"ok": True, "activeProfileId": profile_id})
    else:
        return jsonify({"error": "Failed to set active profile"}), 500


# Backward compatibility endpoints
@app.route("/api/profile/restrictions", methods=["GET"])
def get_restrictions():
    """Get active profile's dietary restrictions and allergies (backward compatible)."""
    profile = get_active_profile()
    return jsonify({
        "allergies": profile.get("allergies", []),
        "restrictions": profile.get("restrictions", [])
    })


@app.route("/api/profile/restrictions", methods=["POST"])
def save_restrictions():
    """Save active profile's dietary restrictions and allergies (backward compatible)."""
    data = request.get_json() or {}
    allergies = data.get("allergies", [])
    restrictions = data.get("restrictions", [])
    
    profiles_data = load_profiles()
    active_id = profiles_data.get("activeProfileId", "default")
    profiles = profiles_data.get("profiles", [])
    
    # Find and update active profile
    for i, profile in enumerate(profiles):
        if profile.get("id") == active_id:
            profiles[i]["allergies"] = allergies if isinstance(allergies, list) else []
            profiles[i]["restrictions"] = restrictions if isinstance(restrictions, list) else []
            profiles_data["profiles"] = profiles
            
            if save_profiles(profiles_data):
                return jsonify({
                    "ok": True,
                    "profile": {
                        "allergies": profiles[i]["allergies"],
                        "restrictions": profiles[i]["restrictions"]
                    }
                })
            else:
                return jsonify({"error": "Failed to save profile"}), 500
    
    return jsonify({"error": "Active profile not found"}), 404


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
        product_data, _ = fetch_product_from_api(barcode)
    
    # Use provided product data or fetched data
    if not product_data and data.get("productData"):
        product_data = data.get("productData")
    
    if not product_data:
        return jsonify({"error": "Product data not found"}), 404
    
    flagged = []
    
    # FIRST: Check Open Food Facts allergen fields directly (most reliable)
    allergen_flags = check_allergens_from_product_data(product_data, profile)
    flagged.extend(allergen_flags)
    
    # SECOND: Check product name against classification dataset first
    # This allows us to trust product-level classifications even if ingredients might normally be flagged
    product_classification = None
    try:
        from dataset.food_classification import get_food_classification
        product_name = product_data.get("product_name") or product_data.get("product_name_en") or ""
        if product_name:
            product_classification = get_food_classification(product_name)
    except Exception as e:
        print(f"Error checking product classification: {e}")
    
    # THIRD: Extract and check ingredients
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
        result = check_ingredient_against_restrictions(ingredient, profile, product_classification)
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


# Meal Plan Management
def load_meal_plans():
    """Load saved meal plans from file."""
    try:
        if os.path.exists(MEAL_PLANS_FILE):
            with open(MEAL_PLANS_FILE, 'r') as f:
                return json.load(f)
        return []
    except Exception as e:
        print(f"Error loading meal plans: {e}")
        return []

def save_meal_plan(meal_plan_data):
    """Save a meal plan to file."""
    try:
        meal_plans = load_meal_plans()
        meal_plans.append(meal_plan_data)
        with open(MEAL_PLANS_FILE, 'w') as f:
            json.dump(meal_plans, f, indent=2)
        return True
    except Exception as e:
        print(f"Error saving meal plan: {e}")
        return False

@app.route("/api/generate-meal-plan", methods=["POST"])
def generate_meal_plan():
    """Generate a meal plan using Gemini AI."""
    try:
        data = request.get_json()
        user_prompt = data.get("prompt", "")
        
        if not user_prompt:
            return jsonify({"error": "Prompt is required"}), 400
        
        # Get user's current restrictions for context
        profiles_data = load_profiles()
        active_profile_id = profiles_data.get("activeProfileId")
        active_profile = None
        
        if active_profile_id:
            for profile in profiles_data.get("profiles", []):
                if profile.get("id") == active_profile_id:
                    active_profile = profile
                    break
        
        # Build context for Gemini
        context = f"""You are a nutritionist and meal planning expert. Create a personalized meal plan based on the user's goals and preferences.

User's Request: {user_prompt}
"""
        
        if active_profile:
            allergies = active_profile.get("allergies", [])
            restrictions = active_profile.get("restrictions", [])
            
            if allergies:
                context += f"\nUser's Allergies: {', '.join(allergies)}"
            if restrictions:
                context += f"\nUser's Dietary Restrictions: {', '.join(restrictions)}"
        
        context += """

Please create a detailed meal plan that:
1. Addresses the user's goals and preferences
2. Respects any allergies and dietary restrictions mentioned
3. Includes breakfast, lunch, dinner, and optional snacks for each day
4. Provides specific food items and portions
5. Is practical and easy to follow

Format the meal plan clearly with days and meals. Be specific about ingredients so they can be checked against dietary restrictions."""

        # Use Gemini AI (Google Generative AI)
        try:
            import google.generativeai as genai
            
            # Get API key from environment variable
            api_key = os.getenv("GEMINI_API_KEY")
            if not api_key:
                # Fallback: try to read from .env file
                from dotenv import load_dotenv
                load_dotenv()
                api_key = os.getenv("GEMINI_API_KEY")
            
            if not api_key:
                return jsonify({
                    "error": "Gemini API key not found. Please set GEMINI_API_KEY environment variable."
                }), 500
            
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel('gemini-pro')
            
            response = model.generate_content(context)
            meal_plan_text = response.text
            
            return jsonify({
                "mealPlan": meal_plan_text,
                "success": True
            })
            
        except ImportError:
            return jsonify({
                "error": "Google Generative AI library not installed. Run: pip install google-generativeai"
            }), 500
        except Exception as e:
            return jsonify({
                "error": f"Failed to generate meal plan: {str(e)}"
            }), 500
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/save-meal-plan", methods=["POST"])
def save_meal_plan_endpoint():
    """Save a meal plan."""
    try:
        data = request.get_json()
        
        meal_plan_data = {
            "mealPlan": data.get("text", ""),
            "timestamp": data.get("timestamp", ""),
            "savedAt": json.dumps({"$date": int(__import__("time").time() * 1000)})
        }
        
        if save_meal_plan(meal_plan_data):
            return jsonify({"success": True, "message": "Meal plan saved"})
        else:
            return jsonify({"error": "Failed to save meal plan"}), 500
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/meal-plans", methods=["GET"])
def get_meal_plans():
    """Get all saved meal plans."""
    try:
        meal_plans = load_meal_plans()
        return jsonify({"mealPlans": meal_plans})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/check-meal-plan", methods=["POST"])
def check_meal_plan():
    """Check meal plan items against restrictions."""
    try:
        data = request.get_json()
        meal_plan_text = data.get("mealPlan", "")
        
        if not meal_plan_text:
            return jsonify({"error": "Meal plan text is required"}), 400
        
        # Get active profile
        profiles_data = load_profiles()
        active_profile_id = profiles_data.get("activeProfileId")
        active_profile = None
        
        if active_profile_id:
            for profile in profiles_data.get("profiles", []):
                if profile.get("id") == active_profile_id:
                    active_profile = profile
                    break
        
        if not active_profile:
            return jsonify({"error": "No active profile found"}), 400
        
        # Extract food items from meal plan (simple extraction)
        # This is a basic implementation - you may want to improve the parsing
        lines = meal_plan_text.split('\n')
        food_items = []
        
        for line in lines:
            line = line.strip()
            # Skip headers and empty lines
            if not line or line.startswith('Day') or line.startswith('Monday') or line.startswith('Tuesday') or line.startswith('Wednesday') or line.startswith('Thursday') or line.startswith('Friday') or line.startswith('Saturday') or line.startswith('Sunday'):
                continue
            # Skip meal type headers
            if line.startswith('Breakfast') or line.startswith('Lunch') or line.startswith('Dinner') or line.startswith('Snack'):
                continue
            # Extract food items (lines that aren't headers)
            if line and not line.startswith('-') and not line.startswith('•'):
                # Try to extract food names (simple approach)
                food_items.append(line)
        
        # Check each food item against restrictions
        profile = {
            "allergies": active_profile.get("allergies", []),
            "restrictions": active_profile.get("restrictions", [])
        }
        
        flagged_items = []
        for item in food_items:
            # Check food item name against classification dataset first
            item_classification = None
            try:
                from dataset.food_classification import get_food_classification
                item_classification = get_food_classification(item)
            except Exception as e:
                print(f"Error checking item classification: {e}")
            
            # Check if item contains restricted ingredients
            result = check_ingredient_against_restrictions(item, profile, item_classification)
            if result:
                flagged_items.append({
                    "item": item,
                    "issue": result
                })
        
        return jsonify({
            "flaggedItems": flagged_items,
            "totalItems": len(food_items),
            "hasIssues": len(flagged_items) > 0
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    # run dev server
    app.run(host="0.0.0.0", port=5000, debug=True)
