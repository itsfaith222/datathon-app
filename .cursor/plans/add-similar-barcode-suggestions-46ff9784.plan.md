<!-- 46ff9784-ae87-4e2a-96f6-31ce2cb51cfa a82c281c-661d-42bb-a4f9-b2f8ff852573 -->
# Dietary Restrictions and Saved Items Feature

## Overview

Implement a system where users can set dietary restrictions/allergies, check scanned products against those restrictions, and save the last 2 scanned items for easy re-testing.

## Implementation Steps

### 1. Backend: Dietary Restrictions Profile Storage

**File: `backend/app.py`**

- Add endpoints for managing dietary restrictions:
- `POST /api/profile/restrictions` - Save user's dietary restrictions/allergies
- `GET /api/profile/restrictions` - Get user's restrictions
- Store restrictions in a simple JSON file or in-memory (since we removed database)
- Restrictions format: `{"allergies": ["peanuts", "milk"], "restrictions": ["vegan", "gluten-free"]}`

### 2. Backend: Ingredients Matching Logic

**File: `backend/app.py`**

- Create function `check_ingredients_against_restrictions(ingredients, restrictions)`:
- Takes product ingredients list and user restrictions
- Checks if any ingredient matches any restriction/allergy
- Returns list of flagged ingredients with their restriction type
- Add endpoint `POST /api/check` that:
- Receives barcode or product data
- Fetches product from Open Food Facts API if needed
- Extracts ingredients
- Checks against user's restrictions
- Returns flagged ingredients and warnings

### 3. Frontend: Dietary Restrictions UI

**File: `frontend/index.html`**

- Add a dropdown/selection menu for dietary restrictions:
- Common allergies: Peanuts, Tree Nuts, Milk, Eggs, Fish, Shellfish, Soy, Wheat
- Common restrictions: Vegan, Vegetarian, Gluten-Free, Halal, Kosher
- Add "Save Restrictions" button
- Display current restrictions
- Position: Top of page or sidebar

### 4. Frontend: Run Check Button and Popup

**File: `frontend/script.js` & `frontend/index.html`**

- Add "Run Check" button that appears after scanning
- When clicked:
- Sends product data to `/api/check` endpoint
- Receives flagged ingredients
- Shows popup/modal with warnings if restrictions found
- Popup design:
- Red/orange warning color
- List of flagged ingredients
- Type of restriction (allergy vs dietary restriction)
- "Dismiss" button

### 5. Backend: Saved Items History

**File: `backend/app.py`**

- Store last 2 scanned items in memory or simple JSON file
- Each saved item contains:
- Barcode
- Product name
- Image URL
- Product data
- Add endpoint `GET /api/history` to retrieve saved items
- Update history when new item is scanned (keep only last 2)

### 6. Frontend: Saved Items Display

**File: `frontend/index.html` & `frontend/script.js`**

- Create sidebar on right side of screen
- Display last 2 scanned items:
- Small product image (thumbnail)
- Product name
- "Re-run Check" button for each item
- When "Re-run Check" clicked:
- Uses saved barcode to fetch product again
- Runs check against restrictions
- Shows popup if issues found

### 7. Frontend: Manual Barcode Input

**File: `frontend/index.html` & `frontend/script.js`**

- Add input field for manual barcode entry:
- Text input box labeled "Or enter barcode manually"
- "Search" button next to input
- Position: Near the scanner buttons
- When "Search" clicked:
- Validates barcode is not empty
- Calls `checkProduct(barcode)` function (same as scan)
- Saves to history and shows product info

### 8. Frontend: Update Scan Flow

**File: `frontend/script.js`**

- After successful scan:
- Save item to history (send to backend)
- Display "Run Check" button
- Update saved items sidebar

## Technical Considerations

**Ingredients Dataset:**

- Use ingredients from Open Food Facts API response (`ingredients_text` or `ingredients` array)
- May need ingredient normalization (e.g., "milk" vs "milk protein")

**Restrictions Matching:**

- Case-insensitive matching
- Partial matching (e.g., "milk" matches "milk protein")
- Handle variations and synonyms

**Storage:**

- Since database removed, use:
- In-memory storage (lost on restart) OR
- Simple JSON file for persistence

## Questions to Clarify

1. **Storage Method**: Should restrictions and history persist (JSON file) or be in-memory only?
2. **Ingredient Matching**: Should we do exact matching, partial matching, or use a synonym dictionary?
3. **Popup Style**: Modal popup, banner at top, or inline warning?