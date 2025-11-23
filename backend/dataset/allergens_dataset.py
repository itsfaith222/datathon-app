# backend/dataset/allergens_dataset.py
"""
Food Ingredients and Allergens Dataset
Dataset: uom190346a/food-ingredients-and-allergens
"""
import kagglehub
from kagglehub import KaggleDatasetAdapter
import pandas as pd
from typing import List, Optional

# Cache for dataset
_allergens_dataset = None


def load_allergens_dataset() -> Optional[pd.DataFrame]:
    """
    Load food ingredients and allergens dataset from Kaggle.
    
    Returns:
        pandas.DataFrame: The loaded dataset, or None if loading fails.
    """
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


def get_ingredient_allergens(ingredient_name: str) -> List[str]:
    """
    Get allergens associated with an ingredient from the dataset.
    
    Args:
        ingredient_name: The name of the ingredient to search for.
    
    Returns:
        List[str]: List of allergen names associated with the ingredient.
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

