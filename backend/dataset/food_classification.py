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
        print("Loading food classification dataset...")
        df = kagglehub.load_dataset(
            KaggleDatasetAdapter.PANDAS,
            "theriley106/foodclassification",
            "",
        )
        _food_classification_dataset = df
        print(f"Food classification dataset loaded. Shape: {df.shape}")
        return df
    except Exception as e:
        print(f"Error loading food classification dataset: {e}")
        return None

