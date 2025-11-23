# backend/dataset/food_nutrition_dataset.py
"""
Food Nutrition Dataset
Dataset: utsavdey1410/food-nutrition-dataset
"""
import kagglehub
from kagglehub import KaggleDatasetAdapter
import pandas as pd
from typing import Optional

# Cache for dataset
_food_nutrition_dataset = None


def load_food_nutrition_dataset() -> Optional[pd.DataFrame]:
    """
    Load food nutrition dataset from Kaggle.
    
    Returns:
        pandas.DataFrame: The loaded dataset, or None if loading fails.
    """
    global _food_nutrition_dataset
    
    if _food_nutrition_dataset is not None:
        return _food_nutrition_dataset
    
    try:
        print("Loading food nutrition dataset...")
        df = kagglehub.load_dataset(
            KaggleDatasetAdapter.PANDAS,
            "utsavdey1410/food-nutrition-dataset",
            "",
        )
        _food_nutrition_dataset = df
        print(f"Food nutrition dataset loaded. Shape: {df.shape}")
        return df
    except Exception as e:
        print(f"Error loading food nutrition dataset: {e}")
        return None

