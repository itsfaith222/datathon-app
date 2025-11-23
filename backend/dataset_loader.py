# backend/dataset_loader.py
import kagglehub
from kagglehub import KaggleDatasetAdapter
import pandas as pd
from typing import Dict, List, Optional

# Cache for datasets
_allergens_dataset = None
_nutrition_dataset = None
_ingredients_dataset = None


def load_allergens_dataset():
    """Load food ingredients and allergens dataset."""
    global _allergens_dataset
    
    if _allergens_dataset is not None:
        return _allergens_dataset
    
    try:
        print("Loading food ingredients and allergens dataset...")
        df = kagglehub.load_dataset(
            KaggleDatasetAdapter.PANDAS,
            "uom190346a/food-ingredients-and-allergens",
            "",
        )
        _allergens_dataset = df
        print(f"Allergens dataset loaded. Shape: {df.shape}")
        return df
    except Exception as e:
        print(f"Error loading allergens dataset: {e}")
        return None


def load_nutrition_datasets():
    """Load nutrition datasets (optional, for future use)."""
    global _nutrition_dataset
    
    if _nutrition_dataset is not None:
        return _nutrition_dataset
    
    try:
        print("Loading nutrition datasets...")
        # Load both nutrition datasets
        df1 = kagglehub.load_dataset(
            KaggleDatasetAdapter.PANDAS,
            "adilshamim8/daily-food-and-nutrition-dataset",
            "",
        )
        df2 = kagglehub.load_dataset(
            KaggleDatasetAdapter.PANDAS,
            "utsavdey1410/food-nutrition-dataset",
            "",
        )
        # Combine or use as needed
        _nutrition_dataset = {"daily": df1, "food": df2}
        print(f"Nutrition datasets loaded.")
        return _nutrition_dataset
    except Exception as e:
        print(f"Error loading nutrition datasets: {e}")
        return None


def get_ingredient_allergens(ingredient_name: str) -> List[str]:
    """
    Get allergens associated with an ingredient.
    Returns list of allergen names.
    """
    df = load_allergens_dataset()
    if df is None:
        return []
    
    # Normalize ingredient name for matching
    ingredient_lower = ingredient_name.lower().strip()
    
    # Search for ingredient in dataset (adjust column names based on actual dataset structure)
    allergens = []
    try:
        # Try different possible column names
        if 'ingredient' in df.columns and 'allergen' in df.columns:
            matches = df[df['ingredient'].str.lower().str.contains(ingredient_lower, na=False)]
            allergens = matches['allergen'].dropna().unique().tolist()
        elif 'name' in df.columns:
            # Try to find ingredient and get associated allergens
            matches = df[df['name'].str.lower().str.contains(ingredient_lower, na=False)]
            if 'allergen' in df.columns:
                allergens = matches['allergen'].dropna().unique().tolist()
    except Exception as e:
        print(f"Error searching allergens: {e}")
    
    return allergens


def check_ingredient_against_restrictions(ingredient: str, restrictions: Dict) -> Optional[Dict]:
    """
    Check if an ingredient matches any user restrictions.
    Returns dict with restriction info if match found, None otherwise.
    """
    import re
    ingredient_lower = ingredient.lower().strip()
    
    # Check allergies
    for allergy in restrictions.get("allergies", []):
        allergy_lower = allergy.lower().strip()
        
        # Try exact match first
        if allergy_lower == ingredient_lower:
            return {
                "type": "allergy",
                "item": allergy,
                "ingredient": ingredient
            }
        
        # Word boundary matching (e.g., "milk" matches "milk", "milk powder", "contains milk", but not "milky")
        # Create word boundary pattern
        pattern = r'\b' + re.escape(allergy_lower) + r'\b'
        if re.search(pattern, ingredient_lower):
            return {
                "type": "allergy",
                "item": allergy,
                "ingredient": ingredient
            }
        
        # Also check if allergy is a substring (for compound names like "tree nuts")
        if allergy_lower in ingredient_lower:
            return {
                "type": "allergy",
                "item": allergy,
                "ingredient": ingredient
            }
    
    # Check dietary restrictions
    for restriction in restrictions.get("restrictions", []):
        restriction_lower = restriction.lower().strip()
        # Check against known restriction patterns
        restriction_patterns = {
            "vegan": ["milk", "egg", "cheese", "butter", "honey", "gelatin", "whey"],
            "vegetarian": ["meat", "chicken", "beef", "pork", "fish", "gelatin"],
            "gluten-free": ["wheat", "gluten", "barley", "rye", "malt"],
            "halal": ["pork", "alcohol", "gelatin"],
            "kosher": ["pork", "shellfish", "mixing meat dairy"]
        }
        
        if restriction_lower in restriction_patterns:
            for pattern in restriction_patterns[restriction_lower]:
                # Use word boundary matching for better accuracy
                pattern_re = r'\b' + re.escape(pattern) + r'\b'
                if re.search(pattern_re, ingredient_lower):
                    return {
                        "type": "restriction",
                        "item": restriction,
                        "ingredient": ingredient
                    }
        # Direct match with word boundary
        pattern_re = r'\b' + re.escape(restriction_lower) + r'\b'
        if re.search(pattern_re, ingredient_lower):
            return {
                "type": "restriction",
                "item": restriction,
                "ingredient": ingredient
            }
    
    # Check dataset for allergens
    allergens = get_ingredient_allergens(ingredient)
    for allergen in allergens:
        allergen_lower = allergen.lower().strip()
        # Check if this allergen is in user's restrictions
        for allergy in restrictions.get("allergies", []):
            if allergy.lower().strip() in allergen_lower or allergen_lower in allergy.lower().strip():
                return {
                    "type": "allergy",
                    "item": allergy,
                    "ingredient": ingredient,
                    "source": "dataset"
                }
    
    return None

