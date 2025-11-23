# backend/dataset/ingredient_checker.py
"""
Ingredient checking functionality that uses all datasets to check ingredients
against user-defined restrictions and allergies.
"""
import re
from typing import Dict, Optional
from .allergens_dataset import get_ingredient_allergens


def check_ingredient_against_restrictions(ingredient: str, restrictions: Dict, product_classification: Optional[Dict] = None) -> Optional[Dict]:
    """
    Check if an ingredient matches any user restrictions or allergies.
    Uses pattern matching and the allergens dataset.
    
    Args:
        ingredient: The ingredient name to check.
        restrictions: Dictionary with 'allergies' and 'restrictions' lists.
        product_classification: Optional dict from classification dataset for the product (not ingredient).
                               If product is marked as compliant for a restriction, skip ingredient checks for that restriction.
    
    Returns:
        Dict with restriction info if match found, None otherwise.
        Format: {
            "type": "allergy" or "restriction",
            "item": name of the restriction/allergy,
            "ingredient": ingredient name,
            "source": optional source indicator
        }
    """
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
        
        # 0. First check if product itself is marked as compliant in classification dataset
        # If product is halal, trust that even if ingredients might normally be flagged
        if product_classification:
            product_is_compliant = product_classification.get(restriction_lower)
            if product_is_compliant is True:
                # Product is marked as compliant, skip ingredient-level checks for this restriction
                continue
            elif product_is_compliant is False:
                # Product is explicitly marked as non-compliant
                return {
                    "type": "restriction",
                    "item": restriction,
                    "ingredient": ingredient,
                    "source": "product_classification_dataset"
                }
        
        # 1. Check against new classification dataset (for ingredient itself)
        # Stricter approach: if ingredient is not in dataset, flag as non-compliant
        classification_checked = False
        dataset_available = False
        try:
            from .food_classification import get_food_classification, load_food_classification_dataset
            # Check if dataset is available
            dataset_df = load_food_classification_dataset()
            dataset_available = dataset_df is not None
            
            if dataset_available:
                classification = get_food_classification(ingredient)
                
                if classification is not None:
                    # Ingredient exists in dataset - check its classification
                    # Map user restriction to dataset key
                    # e.g. "Vegan" -> "vegan", "Gluten-Free" -> "gluten-free"
                    is_compliant = classification.get(restriction_lower)
                    
                    # If dataset explicitly says False (not compliant), flag it
                    if is_compliant is False:
                        return {
                            "type": "restriction",
                            "item": restriction,
                            "ingredient": ingredient,
                            "source": "classification_dataset"
                        }
                    # If True, trust the dataset and skip fallback pattern matching for this restriction
                    elif is_compliant is True:
                        classification_checked = True
                        # Skip to next restriction - this one is compliant according to dataset
                        continue
                    # If classification exists but doesn't have this restriction key, flag as non-compliant
                    elif restriction_lower in ['vegan', 'vegetarian', 'halal', 'kosher', 'gluten-free']:
                        # Ingredient is in dataset but doesn't have this classification, so it's not compliant
                        return {
                            "type": "restriction",
                            "item": restriction,
                            "ingredient": ingredient,
                            "source": "classification_dataset_not_found"
                        }
                else:
                    # Ingredient not found in classification dataset at all - flag as non-compliant
                    # Only apply this strict check for standard dietary restrictions
                    if restriction_lower in ['vegan', 'vegetarian', 'halal', 'kosher', 'gluten-free']:
                        return {
                            "type": "restriction",
                            "item": restriction,
                            "ingredient": ingredient,
                            "source": "classification_dataset_not_in_list"
                        }
        except Exception as e:
            print(f"Error checking classification dataset: {e}")
            # On error, fall through to pattern matching

        # 2. Check against known restriction patterns (Fallback/Augmentation)
        # Only use fallback if classification dataset check didn't resolve the issue
        if not classification_checked:
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
    
    # Also check the new food allergens dataset
    try:
        from .food_allergens_dataset import get_food_allergens
        more_allergens = get_food_allergens(ingredient)
        allergens.extend(more_allergens)
    except Exception as e:
        print(f"Error checking food allergens dataset: {e}")
        
    for allergen in allergens:
        allergen_lower = str(allergen).lower().strip()
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

