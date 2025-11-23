# backend/dataset/__init__.py
"""
Dataset package for loading and managing food-related datasets.
"""
from .allergens_dataset import load_allergens_dataset, get_ingredient_allergens
from .daily_nutrition_dataset import load_daily_nutrition_dataset
from .food_nutrition_dataset import load_food_nutrition_dataset
from .food_classification import load_food_classification_dataset
from .ingredient_checker import check_ingredient_against_restrictions

__all__ = [
    'load_allergens_dataset',
    'get_ingredient_allergens',
    'load_daily_nutrition_dataset',
    'load_food_nutrition_dataset',
    'load_food_classification_dataset',
    'check_ingredient_against_restrictions'
]

