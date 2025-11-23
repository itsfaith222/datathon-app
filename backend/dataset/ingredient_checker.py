# backend/dataset/ingredient_checker.py
"""
Ingredient checking functionality that uses all datasets to check ingredients
against user-defined restrictions and allergies.
"""
import re
from typing import Dict, Optional
from .allergens_dataset import get_ingredient_allergens


def check_ingredient_against_restrictions(ingredient: str, restrictions: Dict) -> Optional[Dict]:
    """
    Check if an ingredient matches any user restrictions or allergies.
    Uses pattern matching and the allergens dataset.
    
    Args:
        ingredient: The ingredient name to check.
        restrictions: Dictionary with 'allergies' and 'restrictions' lists.
    
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
        
        # 1. Check against new classification dataset
        try:
            from .food_classification import get_food_classification
            classification = get_food_classification(ingredient)
            
            if classification:
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
                # If True, we could technically skip other checks, but let's be safe and continue
        except Exception as e:
            print(f"Error checking classification dataset: {e}")

        # 2. Check against known restriction patterns (Fallback/Augmentation)
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

