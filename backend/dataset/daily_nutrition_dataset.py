# backend/dataset/daily_nutrition_dataset.py
"""
Daily Food and Nutrition Dataset
Dataset: adilshamim8/daily-food-and-nutrition-dataset
"""
import kagglehub
from kagglehub import KaggleDatasetAdapter
import pandas as pd
from typing import Optional

# Cache for dataset
_daily_nutrition_dataset = None


def load_daily_nutrition_dataset() -> Optional[pd.DataFrame]:
    """
    Load daily food and nutrition dataset from Kaggle.
    
    Returns:
        pandas.DataFrame: The loaded dataset, or None if loading fails.
    """
    global _daily_nutrition_dataset
    
    if _daily_nutrition_dataset is not None:
        return _daily_nutrition_dataset
    
    try:
        print("Loading daily food and nutrition dataset...")
        df = kagglehub.load_dataset(
            KaggleDatasetAdapter.PANDAS,
            "adilshamim8/daily-food-and-nutrition-dataset",
            "",
        )
        _daily_nutrition_dataset = df
        print(f"Daily nutrition dataset loaded. Shape: {df.shape}")
        return df
    except Exception as e:
        print(f"Error loading daily nutrition dataset: {e}")
        return None

