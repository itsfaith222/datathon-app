// frontend/script.js
const startBtn = document.getElementById("startScanner");
const stopBtn = document.getElementById("stopScanner");
const scanOutput = document.getElementById("scanOutput");
const checkOutput = document.getElementById("checkOutput");
const productTableContainer = document.getElementById("productTableContainer");
const manualBarcodeInput = document.getElementById("manualBarcode");
const searchBarcodeBtn = document.getElementById("searchBarcode");
const runCheckContainer = document.getElementById("runCheckContainer");
const saveRestrictionsBtn = document.getElementById("saveRestrictions");
const allergiesSelect = document.getElementById("allergiesSelect");
const restrictionsSelect = document.getElementById("restrictionsSelect");
const restrictionsStatus = document.getElementById("restrictionsStatus");
const savedItemsList = document.getElementById("savedItemsList");

let html5QrcodeScanner = null;
let isScanning = false;
let currentProductData = null; // Store current product for checking

// Function to run after the DOM is ready
function docReady(fn) {
    if (document.readyState === "complete" || document.readyState === "interactive") {
        setTimeout(fn, 1);
    } else {
        document.addEventListener("DOMContentLoaded", fn);
    }
}

docReady(function() {
    const readerElementId = "reader";

    function onScanSuccess(decodedText, decodedResult) {
        if (isScanning) {
            console.log(`Scan result: ${decodedText}`, decodedResult);
            scanOutput.innerHTML = `<strong>Scanned Barcode:</strong> ${decodedText}`;
            
            // Stop scanning after successful scan
            if (html5QrcodeScanner) {
                html5QrcodeScanner.clear().then(() => {
                    html5QrcodeScanner = null;
                    isScanning = false;
                    startBtn.disabled = false;
                    stopBtn.disabled = true;
                }).catch(err => {
                    console.error("Error stopping scanner:", err);
                });
            }
            
            // Call backend API to get product name
            checkProduct(decodedText);
        }
    }

    function onScanError(errorMessage) {
        // Ignore scanning errors (no barcode in frame)
        // Only log actual errors
        if (errorMessage && !errorMessage.includes("NotFoundException")) {
            console.debug("Scan error:", errorMessage);
        }
    }

    const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
    };

    startBtn.addEventListener("click", async () => {
        if (html5QrcodeScanner) {
            return; // Already started
        }

        startBtn.disabled = true;
        stopBtn.disabled = false;
        scanOutput.textContent = "Starting camera...";
        checkOutput.textContent = "";

        try {
            html5QrcodeScanner = new Html5QrcodeScanner(
                readerElementId,
                config,
                false // verbose
            );
            
            isScanning = true;
            html5QrcodeScanner.render(onScanSuccess, onScanError);
        } catch (e) {
            console.error("Camera start failed", e);
            scanOutput.textContent = "Camera permission denied or no camera available.";
            startBtn.disabled = false;
            stopBtn.disabled = true;
            isScanning = false;
        }
    });

    stopBtn.addEventListener("click", async () => {
        if (html5QrcodeScanner) {
            try {
                await html5QrcodeScanner.clear();
                html5QrcodeScanner = null;
                isScanning = false;
                startBtn.disabled = false;
                stopBtn.disabled = true;
                scanOutput.textContent = "";
                checkOutput.innerHTML = "";
                productTableContainer.innerHTML = "";
            } catch (err) {
                console.error("Error stopping scanner:", err);
            }
        }
    });
});

// Load saved restrictions on page load
docReady(function() {
    loadRestrictions();
    loadSavedItems();
    updateActiveRestrictionsDisplay();
    
    // Update display when selections change
    allergiesSelect.addEventListener('change', updateActiveRestrictionsDisplay);
    restrictionsSelect.addEventListener('change', updateActiveRestrictionsDisplay);
});

// Save restrictions functionality
saveRestrictionsBtn.addEventListener("click", async () => {
    const allergies = Array.from(allergiesSelect.selectedOptions).map(opt => opt.value);
    const restrictions = Array.from(restrictionsSelect.selectedOptions).map(opt => opt.value);
    
    try {
        const urls = [
            `/api/profile/restrictions`,
            `http://localhost:5000/api/profile/restrictions`
        ];
        
        for (const url of urls) {
            try {
                const resp = await fetch(url, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({allergies, restrictions})
                });
                
                if (resp.ok) {
                    restrictionsStatus.innerHTML = `<span style="color: #4CAF50;">✓ Restrictions saved!</span>`;
                    updateActiveRestrictionsDisplay();
                    setTimeout(() => {
                        restrictionsStatus.innerHTML = "";
                    }, 3000);
                    return;
                }
            } catch (e) {
                continue;
            }
        }
        restrictionsStatus.innerHTML = `<span style="color: red;">Failed to save restrictions</span>`;
    } catch (e) {
        console.error("Error saving restrictions:", e);
    }
});

// Update active restrictions display
function updateActiveRestrictionsDisplay() {
    const allergies = Array.from(allergiesSelect.selectedOptions).map(opt => opt.value);
    const restrictions = Array.from(restrictionsSelect.selectedOptions).map(opt => opt.value);
    
    const activeRestrictionsList = document.getElementById("activeRestrictionsList");
    
    if (allergies.length === 0 && restrictions.length === 0) {
        activeRestrictionsList.innerHTML = "<em>No restrictions set yet. Please select and save your restrictions above.</em>";
        return;
    }
    
    let html = "";
    if (allergies.length > 0) {
        html += `<div style="margin-bottom: 8px;"><strong style="color: #ff6b6b;">Allergies:</strong> ${allergies.map(a => `<span style="background: rgba(255, 107, 107, 0.3); padding: 3px 8px; border-radius: 3px; margin: 0 3px;">${escapeHtml(a)}</span>`).join('')}</div>`;
    }
    if (restrictions.length > 0) {
        html += `<div><strong style="color: #4ecdc4;">Restrictions:</strong> ${restrictions.map(r => `<span style="background: rgba(78, 205, 196, 0.3); padding: 3px 8px; border-radius: 3px; margin: 0 3px;">${escapeHtml(r)}</span>`).join('')}</div>`;
    }
    
    activeRestrictionsList.innerHTML = html;
}

// Load restrictions from backend
async function loadRestrictions() {
    try {
        const urls = [
            `/api/profile/restrictions`,
            `http://localhost:5000/api/profile/restrictions`
        ];
        
        for (const url of urls) {
            try {
                const resp = await fetch(url);
                if (resp.ok) {
                    const data = await resp.json();
                    // Set selected options
                    Array.from(allergiesSelect.options).forEach(opt => {
                        opt.selected = data.allergies.includes(opt.value);
                    });
                    Array.from(restrictionsSelect.options).forEach(opt => {
                        opt.selected = data.restrictions.includes(opt.value);
                    });
                    updateActiveRestrictionsDisplay();
                    return;
                }
            } catch (e) {
                continue;
            }
        }
    } catch (e) {
        console.error("Error loading restrictions:", e);
    }
}

// Manual barcode search functionality
searchBarcodeBtn.addEventListener("click", () => {
    const barcode = manualBarcodeInput.value.trim();
    if (!barcode) {
        alert("Please enter a barcode number");
        return;
    }
    
    // Clear previous results
    scanOutput.innerHTML = `<strong>Manual Entry:</strong> ${barcode}`;
    checkOutput.innerHTML = "";
    productTableContainer.innerHTML = "";
    runCheckContainer.innerHTML = "";
    
    // Call the same checkProduct function used by scanner
    checkProduct(barcode);
});

// Allow Enter key to trigger search
manualBarcodeInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        searchBarcodeBtn.click();
    }
});

// Function to check product with backend API
async function checkProduct(barcode) {
    // Show loading indicator
    checkOutput.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <p>Loading product information...</p>
        </div>
    `;
    productTableContainer.innerHTML = "";
    runCheckContainer.innerHTML = "";
    
    // Try relative URL first (if served through Flask), then absolute URL
    const urls = [
        `/api/scan/${encodeURIComponent(barcode)}`,
        `http://localhost:5000/api/scan/${encodeURIComponent(barcode)}`
    ];
    
    let lastError = null;
    
    for (const apiUrl of urls) {
        try {
            console.log("Fetching from:", apiUrl);
            
            const resp = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            
            if (resp.status === 404) {
                const errorData = await resp.json().catch(() => ({}));
                const errorMsg = errorData.error || "i cant find it :)";
                
                // Clear previous content
                productTableContainer.innerHTML = "";
                
                // Display error message and similar products
                let errorHtml = `<span style="color:orange; font-size: 18px;">${errorMsg}</span>`;
                
                // Display similar products if available
                if (errorData.similarProducts && errorData.similarProducts.length > 0) {
                    errorHtml += displaySimilarProductsHTML(errorData.similarProducts);
                }
                
                checkOutput.innerHTML = errorHtml;
                return;
            }
            
            if (!resp.ok) {
                throw new Error(`HTTP error! status: ${resp.status}`);
            }
            
            const data = await resp.json();
            console.log("Received data:", data);
            
            // Store current product data for checking
            currentProductData = data;
            
            // Display the product name with image
            if (data.productName) {
                // Get image URL from allData
                const imageUrl = data.allData?.image_front_small_url || 
                                data.allData?.image_small_url || 
                                data.allData?.image_url || 
                                data.allData?.image_front_url || 
                                null;
                
                let imageHtml = "";
                if (imageUrl) {
                    imageHtml = `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(data.productName)}" 
                                    style="max-width: 150px; max-height: 150px; border-radius: 8px; margin-right: 20px; object-fit: contain;">`;
                }
                
                checkOutput.innerHTML = `<div class="product-header">
                    <div style="display: flex; align-items: center;">
                        ${imageHtml}
                        <h2 style="margin: 0; flex: 1;">${escapeHtml(data.productName)}</h2>
                    </div>
                </div>`;
                
                // Save to history
                saveToHistory(barcode, data.productName, imageUrl, data.allData);
                
                // Show Run Check button
                runCheckContainer.innerHTML = `
                    <button id="runCheckBtn" style="background-color: #28a745; padding: 12px 24px; font-size: 16px;">
                        Run Check Against Restrictions
                    </button>
                `;
                
                // Add event listener for Run Check button
                document.getElementById("runCheckBtn").addEventListener("click", () => {
                    runIngredientCheck(barcode, data.allData);
                });
            } else {
                checkOutput.innerHTML = `<span style="color:orange">Product found but no name available.</span>`;
            }
            
            // Display ingredients list instead of full table
            if (data.ingredients && data.ingredients.length > 0) {
                displayIngredientsList(data.ingredients);
            } else if (data.allData) {
                // Fallback: try to extract ingredients from allData
                const ingredients = extractIngredientsFromData(data.allData);
                if (ingredients.length > 0) {
                    displayIngredientsList(ingredients);
                }
            }
            
            return; // Success, exit function
        } catch (e) {
            console.error(`Fetch error for ${apiUrl}:`, e);
            lastError = e;
            // Try next URL
            continue;
        }
    }
    
    // If we get here, both URLs failed
    checkOutput.innerHTML = `<div style="color: red;">Error checking product: ${lastError.message}<br>` +
        `<small>Make sure the Flask backend is running on http://localhost:5000<br>` +
        `Run: <code>cd backend && python app.py</code></small></div>`;
    productTableContainer.innerHTML = "";
}

// Extract ingredients from product data
function extractIngredientsFromData(productData) {
    let ingredients = [];
    
    // Try ingredients_text
    const ingredientsText = productData.ingredients_text || productData.ingredients_text_en || "";
    if (ingredientsText) {
        ingredients = String(ingredientsText).split(",")
            .map(ing => ing.trim())
            .filter(ing => ing.length > 0);
    }
    
    // Try ingredients array
    if (ingredients.length === 0 && productData.ingredients) {
        const ingredientsArray = productData.ingredients;
        if (Array.isArray(ingredientsArray)) {
            ingredients = ingredientsArray
                .filter(ing => typeof ing === 'object' && ing !== null)
                .map(ing => ing.text || ing.id || "")
                .filter(text => text && text.length > 0);
        }
    }
    
    return ingredients;
}

// Display ingredients list
function displayIngredientsList(ingredients) {
    if (!ingredients || ingredients.length === 0) {
        productTableContainer.innerHTML = "";
        return;
    }
    
    let html = `
        <div class="ingredients-list">
            <h4>Ingredients Found:</h4>
            <ul>
    `;
    
    ingredients.forEach(ingredient => {
        html += `<li>${escapeHtml(String(ingredient))}</li>`;
    });
    
    html += `
            </ul>
        </div>
    `;
    
    productTableContainer.innerHTML = html;
}

// Function to display product information in a table (kept for reference, not used)
function displayProductTable(productData) {
    if (!productData || typeof productData !== 'object') {
        productTableContainer.innerHTML = "";
        return;
    }
    
    // Filter out null, undefined, and empty values, and sort by key
    const entries = Object.entries(productData)
        .filter(([key, value]) => value !== null && value !== undefined && value !== '')
        .sort(([a], [b]) => a.localeCompare(b));
    
    if (entries.length === 0) {
        productTableContainer.innerHTML = "<p>No additional product information available.</p>";
        return;
    }
    
    // Create table HTML
    let tableHTML = `
        <table class="product-table">
            <thead>
                <tr>
                    <th>Field</th>
                    <th>Value</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    entries.forEach(([key, value]) => {
        // Format the field name (replace underscores with spaces, capitalize)
        const formattedKey = key
            .replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
        
        // Format the value
        let formattedValue = value;
        if (typeof value === 'object') {
            formattedValue = JSON.stringify(value, null, 2);
        } else if (typeof value === 'string' && value.length > 200) {
            formattedValue = value.substring(0, 200) + '...';
        }
        
        tableHTML += `
            <tr>
                <td class="field-name">${escapeHtml(formattedKey)}</td>
                <td class="field-value">${escapeHtml(String(formattedValue))}</td>
            </tr>
        `;
    });
    
    tableHTML += `
            </tbody>
        </table>
    `;
    
    productTableContainer.innerHTML = tableHTML;
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Run ingredient check against restrictions
async function runIngredientCheck(barcode, productData) {
    // Show loading indicator
    const runCheckBtn = document.getElementById("runCheckBtn");
    if (runCheckBtn) {
        runCheckBtn.disabled = true;
        runCheckBtn.innerHTML = "Checking...";
    }
    
    try {
        const urls = [
            `/api/check`,
            `http://localhost:5000/api/check`
        ];
        
        for (const url of urls) {
            try {
                const resp = await fetch(url, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        barcode: barcode,
                        productData: productData
                    })
                });
                
                if (resp.ok) {
                    const result = await resp.json();
                    showCheckResults(result);
                    if (runCheckBtn) {
                        runCheckBtn.disabled = false;
                        runCheckBtn.innerHTML = "Run Check Against Restrictions";
                    }
                    return;
                }
            } catch (e) {
                continue;
            }
        }
        alert("Error checking ingredients. Make sure backend is running.");
        if (runCheckBtn) {
            runCheckBtn.disabled = false;
            runCheckBtn.innerHTML = "Run Check Against Restrictions";
        }
    } catch (e) {
        console.error("Error running check:", e);
        alert("Error checking ingredients.");
        if (runCheckBtn) {
            runCheckBtn.disabled = false;
            runCheckBtn.innerHTML = "Run Check Against Restrictions";
        }
    }
}

// Show check results in popup
function showCheckResults(result) {
    if (!result.hasIssues || result.flagged.length === 0) {
        // Show success message
        const popup = document.createElement('div');
        popup.className = 'popup-overlay';
        popup.innerHTML = `
            <div class="popup-content" style="border-color: #4CAF50;">
                <h3 style="color: #4CAF50;">✓ Safe to Consume</h3>
                <p style="color: white;">No dietary restrictions or allergies found in this product.</p>
                <button onclick="this.closest('.popup-overlay').remove()" 
                        style="background-color: #4CAF50; padding: 10px 20px; margin-top: 15px;">
                    Close
                </button>
            </div>
        `;
        document.body.appendChild(popup);
        return;
    }
    
    // Show warning popup
    const popup = document.createElement('div');
    popup.className = 'popup-overlay';
    
    let flaggedList = '';
    result.flagged.forEach(item => {
        flaggedList += `<li><strong>${escapeHtml(item.ingredient)}</strong> - ${escapeHtml(item.type)}: ${escapeHtml(item.item)}</li>`;
    });
    
    popup.innerHTML = `
        <div class="popup-content">
            <h3>⚠️ Dietary Restriction Alert</h3>
            <p style="color: white;">This product contains ingredients that match your restrictions:</p>
            <ul>
                ${flaggedList}
            </ul>
            <button onclick="this.closest('.popup-overlay').remove()" 
                    style="background-color: #ff4444; padding: 10px 20px; margin-top: 15px;">
                Dismiss
            </button>
        </div>
    `;
    document.body.appendChild(popup);
}

// Save item to history
async function saveToHistory(barcode, productName, imageUrl, productData) {
    try {
        const urls = [
            `/api/history`,
            `http://localhost:5000/api/history`
        ];
        
        for (const url of urls) {
            try {
                const resp = await fetch(url, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        barcode: barcode,
                        productName: productName,
                        imageUrl: imageUrl,
                        productData: productData
                    })
                });
                
                if (resp.ok) {
                    const data = await resp.json();
                    loadSavedItems();
                    return;
                }
            } catch (e) {
                continue;
            }
        }
    } catch (e) {
        console.error("Error saving to history:", e);
    }
}

// Load and display saved items
async function loadSavedItems() {
    try {
        const urls = [
            `/api/history`,
            `http://localhost:5000/api/history`
        ];
        
        for (const url of urls) {
            try {
                const resp = await fetch(url);
                if (resp.ok) {
                    const data = await resp.json();
                    displaySavedItems(data.items || []);
                    return;
                }
            } catch (e) {
                continue;
            }
        }
        savedItemsList.innerHTML = "<p style='color: #ccc; font-size: 12px;'>No recent scans</p>";
    } catch (e) {
        console.error("Error loading saved items:", e);
    }
}

// Display saved items in sidebar
function displaySavedItems(items) {
    if (!items || items.length === 0) {
        savedItemsList.innerHTML = "<p style='color: #ccc; font-size: 12px;'>No recent scans</p>";
        return;
    }
    
    let html = '';
    items.forEach(item => {
        const imageUrl = item.imageUrl || '';
        const productName = escapeHtml(item.productName || 'Unknown Product');
        const barcode = escapeHtml(item.barcode || '');
        
        html += `
            <div class="saved-item-card">
                ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${productName}">` : ''}
                <div class="item-name">${productName}</div>
                <button onclick="rerunCheck('${barcode}')" 
                        style="width: 100%; padding: 5px; font-size: 12px; background-color: #28a745;">
                    Re-run Check
                </button>
            </div>
        `;
    });
    
    savedItemsList.innerHTML = html;
}

// Re-run check for saved item (global function for onclick)
window.rerunCheck = async function(barcode) {
    // Clear previous results
    checkOutput.innerHTML = "";
    productTableContainer.innerHTML = "";
    runCheckContainer.innerHTML = "";
    scanOutput.innerHTML = `<strong>Re-checking:</strong> ${barcode}`;
    
    // Fetch product and check
    await checkProduct(barcode);
    
    // If we have the product data, run the check
    if (currentProductData && currentProductData.allData) {
        setTimeout(() => {
            runIngredientCheck(barcode, currentProductData.allData);
        }, 500);
    }
}

// Function to generate HTML for similar products
function displaySimilarProductsHTML(similarProducts) {
    if (!similarProducts || similarProducts.length === 0) {
        return "";
    }
    
    let html = `
        <div class="similar-products-container" style="margin-top: 20px; padding: 20px; background: rgba(255, 255, 255, 0.1); border-radius: 8px;">
            <h3 style="color: white; margin-bottom: 15px;">Similar Products Found:</h3>
            <div class="similar-products-list">
    `;
    
    similarProducts.forEach((product) => {
        const productName = escapeHtml(product.productName || "Unknown Product");
        const barcode = escapeHtml(product.barcode);
        const brand = product.brands ? escapeHtml(product.brands) : "";
        
        html += `
            <div class="similar-product-item" onclick="checkProduct('${barcode}')" 
                 style="cursor: pointer; padding: 15px; margin-bottom: 10px; background: rgba(255, 255, 255, 0.15); 
                        border-radius: 5px; border: 1px solid rgba(255, 255, 255, 0.2); 
                        transition: background 0.2s;">
                <div style="font-weight: bold; color: #4CAF50; font-size: 16px;">${productName}</div>
                <div style="color: #ccc; font-size: 14px; margin-top: 5px;">
                    Barcode: ${barcode}
                    ${brand ? `<br>Brand: ${brand}` : ''}
                </div>
            </div>
        `;
    });
    
    html += `
            </div>
        </div>
    `;
    
    return html;
}
