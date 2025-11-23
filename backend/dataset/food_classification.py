# backend/dataset/food_classification.py
"""
Food Classification Dataset
Dataset: theriley106/foodclassification
"""
import kagglehub
from kagglehub import KaggleDatasetAdapter
import pandas as pd
from typing import Optional

# Cache for dataset
_food_classification_dataset = None


import os

def load_food_classification_dataset() -> Optional[pd.DataFrame]:
    """
    Load food classification dataset from Kaggle.
    
    Returns:
        pandas.DataFrame: The loaded dataset, or None if loading fails.
    """
    global _food_classification_dataset
    
    if _food_classification_dataset is not None:
        return _food_classification_dataset
    
    try:
        print("Loading food classification dataset (theriley106/foodclassification)...")
        # Download the dataset
        path = kagglehub.dataset_download("theriley106/foodclassification")
        print(f"Dataset downloaded to: {path}")
        
        # Find the JSON file
        json_file = None
        for root, dirs, files in os.walk(path):
            for file in files:
                if file.endswith(".json"):
                    json_file = os.path.join(root, file)
                    break
            if json_file:
                break
        
        if not json_file:
            print("No JSON file found in the dataset.")
            return None
            
        import json
        with open(json_file, 'r') as f:
            data = json.load(f)
            
        # Convert dictionary to DataFrame
        # Structure: {'FoodName': {'Vegan': True, ...}, ...}
        df = pd.DataFrame.from_dict(data, orient='index')
        
        # Make the index (food name) a column
        df.reset_index(inplace=True)
        df.rename(columns={'index': 'food_name'}, inplace=True)
        
        # Normalize column names
        df.columns = [str(c).lower().strip() for c in df.columns]
        
        print(f"Food classification dataset loaded. Shape: {df.shape}")
        print(f"Columns: {df.columns.tolist()}")
        
        _food_classification_dataset = df
        return df
    except Exception as e:
        print(f"Error loading food classification dataset: {e}")
        return None

def get_food_classification(food_name: str) -> Optional[dict]:
    """
    Get dietary classification for a food product from the dataset.
    
    Args:
        food_name: The name of the food to search for.
    
    Returns:
        dict: Dictionary with dietary flags (e.g., {'vegan': True, 'halal': False}), or None if not found.
    """
    df = load_food_classification_dataset()
    if df is None:
        return None
    
    # Normalize food name for matching
    food_lower = food_name.lower().strip()
    
    try:
        # Identify food column
        food_col = None
        possible_food_cols = ['food', 'product', 'food product', 'item', 'name', 'ingredient']
        
        for col in df.columns:
            if col.lower() in possible_food_cols:
                food_col = col
                break
        
        if not food_col:
            # Fallback: check for columns containing keywords
            for col in df.columns:
                if 'food' in col.lower() or 'product' in col.lower() or 'item' in col.lower():
                    food_col = col
                    break
        
        if food_col:
            # Search for food in dataset
            matches = df[df[food_col].astype(str).str.lower() == food_lower]
            
            if matches.empty:
                # Try partial match
                matches = df[df[food_col].astype(str).str.lower().str.contains(food_lower, na=False)]
            
            if not matches.empty:
                # Get the first match
                match = matches.iloc[0]
                
                # Extract classification columns
                classification = {}
                dietary_keywords = ['vegan', 'vegetarian', 'halal', 'kosher', 'gluten']
                
                for col in df.columns:
                    col_lower = col.lower()
                    for keyword in dietary_keywords:
                        if keyword in col_lower:
                            # Normalize key
                            key = keyword
                            if keyword == 'gluten':
                                key = 'gluten-free'
                            
                            # Normalize value (handle boolean, "Yes"/"No", 1/0)
                            val = match[col]
                            is_compliant = False
                            
                            if isinstance(val, bool):
                                is_compliant = val
                            elif isinstance(val, (int, float)):
                                is_compliant = bool(val)
                            elif isinstance(val, str):
                                val_lower = val.lower().strip()
                                is_compliant = val_lower in ['yes', 'true', '1', 'y']
                            
                            # Special handling for "gluten" column which usually means "contains gluten"
                            if keyword == 'gluten' and 'free' not in col_lower:
                                # If column is "Contains Gluten", then True means NOT Gluten-Free
                                classification['gluten-free'] = not is_compliant
                            else:
                                classification[key] = is_compliant
                                
                return classification
                        
    except Exception as e:
        print(f"Error searching food classification: {e}")
    
    return None
