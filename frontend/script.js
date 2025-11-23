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
const allergyCheckboxes = document.querySelectorAll(".allergy-checkbox");
const restrictionCheckboxes = document.querySelectorAll(".restriction-checkbox");
const restrictionsStatus = document.getElementById("restrictionsStatus");
const notificationsList = document.getElementById("notificationsList");
const historyList = document.getElementById("historyList");
const showSafeBtn = document.getElementById("showSafe");
const showUnsafeBtn = document.getElementById("showUnsafe");
const notificationCount = document.getElementById("notificationCount");
const themeToggle = document.getElementById("themeToggle");
const themeIcon = document.getElementById("themeIcon");
const themeText = document.getElementById("themeText");

let html5QrcodeScanner = null;
let isScanning = false;
let currentProductData = null;
let currentBarcode = null;
let notifications = JSON.parse(localStorage.getItem('notifications') || '[]');
let scanHistory = JSON.parse(localStorage.getItem('scanHistory') || '[]');
let currentHistoryFilter = 'all'; // 'all', 'safe', 'unsafe'

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    if (theme === 'dark') {
        themeIcon.textContent = '☀️';
        themeText.textContent = 'Light Mode';
    } else {
        themeIcon.textContent = '🌙';
        themeText.textContent = 'Dark Mode';
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

// Make toggleTheme globally accessible
window.toggleTheme = toggleTheme;

// Initialize theme on page load
initTheme();

// Function to run after the DOM is ready
function docReady(fn) {
    if (document.readyState === "complete" || document.readyState === "interactive") {
        setTimeout(fn, 1);
    } else {
        document.addEventListener("DOMContentLoaded", fn);
    }
}

docReady(function() {
    loadRestrictions();
    updateActiveRestrictionsDisplay();
    displayNotifications();
    displayHistory();
    
    // Update display when selections change
    allergyCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updateActiveRestrictionsDisplay);
    });
    restrictionCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updateActiveRestrictionsDisplay);
    });
    
    // History filter buttons
    showSafeBtn.addEventListener('click', () => {
        currentHistoryFilter = 'safe';
        showSafeBtn.style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
        showUnsafeBtn.style.background = '#6c757d';
        displayHistory();
    });
    
    showUnsafeBtn.addEventListener('click', () => {
        currentHistoryFilter = 'unsafe';
        showUnsafeBtn.style.background = '#dc3545';
        showSafeBtn.style.background = '#6c757d';
        displayHistory();
    });
});

// Update active restrictions display
function updateActiveRestrictionsDisplay() {
    const allergies = Array.from(allergyCheckboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
    const restrictions = Array.from(restrictionCheckboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
    
    const activeRestrictionsList = document.getElementById("activeRestrictionsList");
    
    if (allergies.length === 0 && restrictions.length === 0) {
        activeRestrictionsList.innerHTML = "<em style='color: #999; font-size: 12px;'>No restrictions set</em>";
        return;
    }
    
    let html = "";
    if (allergies.length > 0) {
        html += `<div style="margin-bottom: 6px;">${allergies.map(a => `<span class="restriction-badge badge-allergy">${escapeHtml(a)}</span>`).join('')}</div>`;
    }
    if (restrictions.length > 0) {
        html += `<div>${restrictions.map(r => `<span class="restriction-badge badge-restriction">${escapeHtml(r)}</span>`).join('')}</div>`;
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
                    allergyCheckboxes.forEach(checkbox => {
                        checkbox.checked = data.allergies.includes(checkbox.value);
                    });
                    restrictionCheckboxes.forEach(checkbox => {
                        checkbox.checked = data.restrictions.includes(checkbox.value);
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

// Save restrictions functionality
saveRestrictionsBtn.addEventListener("click", async () => {
    const allergies = Array.from(allergyCheckboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
    const restrictions = Array.from(restrictionCheckboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
    
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
                    restrictionsStatus.innerHTML = "✓ Saved!";
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
        restrictionsStatus.innerHTML = "Failed to save";
    } catch (e) {
        console.error("Error saving restrictions:", e);
    }
});

// Scanner setup
docReady(function() {
    const readerElementId = "reader";

    function onScanSuccess(decodedText, decodedResult) {
        if (isScanning) {
            console.log(`Scan result: ${decodedText}`, decodedResult);
            scanOutput.innerHTML = `<strong>Scanned:</strong> ${decodedText}`;
            
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
            
            checkProduct(decodedText);
        }
    }

    function onScanError(errorMessage) {
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
            return;
        }

        startBtn.disabled = true;
        stopBtn.disabled = false;
        scanOutput.textContent = "Starting camera...";
        checkOutput.innerHTML = "";
        productTableContainer.innerHTML = "";
        runCheckContainer.innerHTML = "";

        try {
            html5QrcodeScanner = new Html5QrcodeScanner(
                readerElementId,
                config,
                false
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
                runCheckContainer.innerHTML = "";
            } catch (err) {
                console.error("Error stopping scanner:", err);
            }
        }
    });
});

// Manual barcode search
searchBarcodeBtn.addEventListener("click", () => {
    const barcode = manualBarcodeInput.value.trim();
    if (!barcode) {
        alert("Please enter a barcode number");
        return;
    }
    
    scanOutput.innerHTML = `<strong>Manual Entry:</strong> ${barcode}`;
    checkOutput.innerHTML = "";
    productTableContainer.innerHTML = "";
    runCheckContainer.innerHTML = "";
    
    checkProduct(barcode);
});

manualBarcodeInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        searchBarcodeBtn.click();
    }
});

// Check product with backend API
async function checkProduct(barcode) {
    currentBarcode = barcode;
    
    checkOutput.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <p>Loading product information...</p>
        </div>
    `;
    productTableContainer.innerHTML = "";
    runCheckContainer.innerHTML = "";
    
    const urls = [
        `/api/scan/${encodeURIComponent(barcode)}`,
        `http://localhost:5000/api/scan/${encodeURIComponent(barcode)}`
    ];
    
    let lastError = null;
    
    for (const apiUrl of urls) {
        try {
            const resp = await fetch(apiUrl, {
                method: 'GET',
                headers: {'Content-Type': 'application/json'},
            });
            
            if (resp.status === 404) {
                const errorData = await resp.json().catch(() => ({}));
                const errorMsg = errorData.error || "i cant find it :)";
                
                checkOutput.innerHTML = `<div style="color: #dc3545; padding: 20px; background: #f8d7da; border-radius: 8px;">${errorMsg}</div>`;
                
                if (errorData.similarProducts && errorData.similarProducts.length > 0) {
                    displaySimilarProductsHTML(errorData.similarProducts);
                }
                return;
            }
            
            if (!resp.ok) {
                throw new Error(`HTTP error! status: ${resp.status}`);
            }
            
            const data = await resp.json();
            currentProductData = data;
            
            // Display product
            if (data.productName) {
                const imageUrl = data.allData?.image_front_small_url || 
                                data.allData?.image_small_url || 
                                data.allData?.image_url || 
                                data.allData?.image_front_url || 
                                null;
                
                let imageHtml = "";
                if (imageUrl) {
                    imageHtml = `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(data.productName)}">`;
                }
                
                checkOutput.innerHTML = `<div class="product-header">
                    ${imageHtml}
                    <h2>${escapeHtml(data.productName)}</h2>
                </div>`;
                
                // Save to history (will be marked safe/unsafe after check)
                saveToHistory(barcode, data.productName, imageUrl, data.allData, null);
                
                // Show Run Check button
                runCheckContainer.innerHTML = `
                    <button id="runCheckBtn" class="btn btn-success" style="width: 100%;">
                        Run Check Against Restrictions
                    </button>
                `;
                
                document.getElementById("runCheckBtn").addEventListener("click", () => {
                    runIngredientCheck(barcode, data.allData);
                });
            }
            
            // Display ingredients
            if (data.ingredients && data.ingredients.length > 0) {
                displayIngredientsList(data.ingredients);
            } else if (data.allData) {
                const ingredients = extractIngredientsFromData(data.allData);
                if (ingredients.length > 0) {
                    displayIngredientsList(ingredients);
                }
            }
            
            return;
        } catch (e) {
            console.error(`Fetch error for ${apiUrl}:`, e);
            lastError = e;
            continue;
        }
    }
    
    checkOutput.innerHTML = `<div style="color: #dc3545; padding: 20px;">Error: ${lastError.message}</div>`;
}

// Extract ingredients from product data
function extractIngredientsFromData(productData) {
    let ingredients = [];
    
    const ingredientsText = productData.ingredients_text || productData.ingredients_text_en || "";
    if (ingredientsText) {
        ingredients = String(ingredientsText).split(",")
            .map(ing => ing.trim())
            .filter(ing => ing.length > 0);
    }
    
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
    
    html += `</ul></div>`;
    productTableContainer.innerHTML = html;
}

// Run ingredient check
async function runIngredientCheck(barcode, productData) {
    const runCheckBtn = document.getElementById("runCheckBtn");
    if (runCheckBtn) {
        runCheckBtn.disabled = true;
        runCheckBtn.innerHTML = "Checking...";
    }
    
    try {
        const urls = [`/api/check`, `http://localhost:5000/api/check`];
        
        for (const url of urls) {
            try {
                const resp = await fetch(url, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({barcode, productData})
                });
                
                if (resp.ok) {
                    const result = await resp.json();
                    showCheckResults(result, barcode);
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
        alert("Error checking ingredients.");
        if (runCheckBtn) {
            runCheckBtn.disabled = false;
            runCheckBtn.innerHTML = "Run Check Against Restrictions";
        }
    } catch (e) {
        console.error("Error running check:", e);
    }
}

// Show check results in popup
function showCheckResults(result, barcode) {
    const productName = currentProductData?.productName || "Unknown Product";
    const isSafe = !result.hasIssues || result.flagged.length === 0;
    
    // Update history with safe/unsafe status
    updateHistoryItemStatus(barcode, isSafe, result.flagged);
    
    const popup = document.createElement('div');
    popup.className = 'popup-overlay';
    
    if (isSafe) {
        popup.innerHTML = `
            <div class="popup-content safe">
                <h3>✓ Safe to Consume</h3>
                <p style="color: #555;">No dietary restrictions or allergies found in this product.</p>
                <button onclick="closePopup(this, '${barcode}', true, [])">Close</button>
            </div>
        `;
    } else {
        let flaggedList = '';
        result.flagged.forEach(item => {
            flaggedList += `<li><strong>${escapeHtml(item.ingredient)}</strong> - ${escapeHtml(item.type)}: ${escapeHtml(item.item)}</li>`;
        });
        
        popup.innerHTML = `
            <div class="popup-content">
                <h3>⚠️ Dietary Restriction Alert</h3>
                <p style="color: #555;">This product contains ingredients that match your restrictions:</p>
                <ul>${flaggedList}</ul>
                <button onclick="closePopup(this, '${barcode}', false, ${JSON.stringify(result.flagged)})">Close</button>
            </div>
        `;
    }
    
    document.body.appendChild(popup);
}

// Close popup and save to notifications
window.closePopup = function(btn, barcode, isSafe, flagged) {
    const popup = btn.closest('.popup-overlay');
    if (popup) {
        popup.remove();
    }
    
    // Save to notifications if unsafe
    if (!isSafe) {
        const productName = currentProductData?.productName || "Unknown Product";
        const notification = {
            id: Date.now(),
            barcode: barcode,
            productName: productName,
            timestamp: new Date().toISOString(),
            flagged: flagged
        };
        
        notifications.unshift(notification);
        // Keep only last 50 notifications
        if (notifications.length > 50) {
            notifications = notifications.slice(0, 50);
        }
        
        localStorage.setItem('notifications', JSON.stringify(notifications));
        displayNotifications();
    }
    
    // Update history display
    displayHistory();
};

// Display notifications
function displayNotifications() {
    if (!notifications || notifications.length === 0) {
        notificationsList.innerHTML = '<div class="empty-state">No notifications yet</div>';
        notificationCount.style.display = 'none';
        return;
    }
    
    notificationCount.textContent = notifications.length;
    notificationCount.style.display = 'inline-block';
    
    let html = '';
    notifications.forEach(notif => {
        html += `
            <div class="notification-item unsafe" onclick="showNotificationProduct('${notif.barcode}')">
                <h4>⚠️ ${escapeHtml(notif.productName)}</h4>
                <p>${notif.flagged.length} restriction(s) found • ${new Date(notif.timestamp).toLocaleString()}</p>
            </div>
        `;
    });
    
    notificationsList.innerHTML = html;
}

// Show product from notification
window.showNotificationProduct = function(barcode) {
    checkProduct(barcode);
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Save to history
function saveToHistory(barcode, productName, imageUrl, productData, isSafe) {
    // Remove existing entry with same barcode
    scanHistory = scanHistory.filter(item => item.barcode !== barcode);
    
    const historyItem = {
        barcode: barcode,
        productName: productName,
        imageUrl: imageUrl,
        productData: productData,
        isSafe: isSafe,
        timestamp: new Date().toISOString()
    };
    
    scanHistory.unshift(historyItem);
    
    // Keep only last 100 items
    if (scanHistory.length > 100) {
        scanHistory = scanHistory.slice(0, 100);
    }
    
    localStorage.setItem('scanHistory', JSON.stringify(scanHistory));
    displayHistory();
}

// Update history item status
function updateHistoryItemStatus(barcode, isSafe, flagged) {
    const item = scanHistory.find(h => h.barcode === barcode);
    if (item) {
        item.isSafe = isSafe;
        item.flagged = flagged;
        item.checkedAt = new Date().toISOString();
        localStorage.setItem('scanHistory', JSON.stringify(scanHistory));
    }
}

// Display history
function displayHistory() {
    let filteredHistory = scanHistory;
    
    if (currentHistoryFilter === 'safe') {
        filteredHistory = scanHistory.filter(item => item.isSafe === true);
    } else if (currentHistoryFilter === 'unsafe') {
        filteredHistory = scanHistory.filter(item => item.isSafe === false);
    }
    
    if (!filteredHistory || filteredHistory.length === 0) {
        historyList.innerHTML = '<div class="empty-state">No scan history yet</div>';
        return;
    }
    
    let html = '';
    filteredHistory.forEach(item => {
        const statusClass = item.isSafe ? 'safe' : 'unsafe';
        const statusBadge = item.isSafe ? 
            '<span class="status-badge status-safe">Safe</span>' : 
            '<span class="status-badge status-unsafe">Unsafe</span>';
        
        html += `
            <div class="history-item ${statusClass}" onclick="showHistoryProduct('${item.barcode}')">
                <h4>${escapeHtml(item.productName)} ${statusBadge}</h4>
                <p>${new Date(item.timestamp).toLocaleString()}</p>
            </div>
        `;
    });
    
    historyList.innerHTML = html;
}

// Show product from history
window.showHistoryProduct = function(barcode) {
    checkProduct(barcode);
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Display similar products (from previous implementation)
function displaySimilarProductsHTML(similarProducts) {
    if (!similarProducts || similarProducts.length === 0) {
        return "";
    }
    
    let html = `<div style="margin-top: 20px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
        <h4 style="color: #2c3e50; margin-bottom: 15px;">Similar Products Found:</h4>`;
    
    similarProducts.forEach((product) => {
        const productName = escapeHtml(product.productName || "Unknown Product");
        const barcode = escapeHtml(product.barcode);
        
        html += `
            <div style="cursor: pointer; padding: 12px; margin-bottom: 8px; background: white; 
                        border-radius: 6px; border-left: 3px solid #4a90e2;" 
                 onclick="checkProduct('${barcode}')">
                <strong style="color: #4a90e2;">${productName}</strong>
                <div style="color: #999; font-size: 12px; margin-top: 4px;">Barcode: ${barcode}</div>
            </div>
        `;
    });
    
    html += `</div>`;
    productTableContainer.innerHTML = html;
}
