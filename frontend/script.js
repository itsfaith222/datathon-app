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
const profileSelect = document.getElementById("profileSelect");
const createProfileBtn = document.getElementById("createProfileBtn");
const deleteProfileBtn = document.getElementById("deleteProfileBtn");
const profileStatus = document.getElementById("profileStatus");

let currentProfileId = null;
let profiles = [];
const notificationsList = document.getElementById("notificationsList");
const historyList = document.getElementById("historyList");
const showAllBtn = document.getElementById("showAll");
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
let notifications = JSON.parse(sessionStorage.getItem('notifications') || '[]');
let scanHistory = JSON.parse(sessionStorage.getItem('scanHistory') || '[]');
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
    try {
        // Initialize only if elements exist
        if (profileSelect && createProfileBtn && deleteProfileBtn) {
            loadProfiles().catch(err => {
                console.error("Error loading profiles:", err);
                // Fallback: try to load restrictions directly
                loadRestrictions();
            });
            
            // Profile management
            profileSelect.addEventListener('change', onProfileChange);
            createProfileBtn.addEventListener('click', showCreateProfileDialog);
            deleteProfileBtn.addEventListener('click', deleteCurrentProfile);
        } else {
            // Fallback: try to load restrictions directly if profile system not available
            loadRestrictions();
        }
        
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
    } catch (error) {
        console.error("Error during initialization:", error);
        // Still try to load basic functionality
        try {
            loadRestrictions();
            displayHistory();
        } catch (e) {
            console.error("Failed to load basic functionality:", e);
        }
    }
    
    // History filter buttons (only if elements exist)
    if (showAllBtn && showSafeBtn && showUnsafeBtn) {
        showAllBtn.addEventListener('click', () => {
            currentHistoryFilter = 'all';
            showAllBtn.style.background = 'linear-gradient(135deg, #4a90e2 0%, #357abd 100%)';
            showAllBtn.style.color = 'white';
            showSafeBtn.style.background = '#6c757d';
            showSafeBtn.style.color = 'white';
            showUnsafeBtn.style.background = '#6c757d';
            showUnsafeBtn.style.color = 'white';
            displayHistory();
        });
        
        showSafeBtn.addEventListener('click', () => {
            currentHistoryFilter = 'safe';
            showSafeBtn.style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
            showSafeBtn.style.color = 'white';
            showAllBtn.style.background = '#6c757d';
            showAllBtn.style.color = 'white';
            showUnsafeBtn.style.background = '#6c757d';
            showUnsafeBtn.style.color = 'white';
            displayHistory();
        });
        
        showUnsafeBtn.addEventListener('click', () => {
            currentHistoryFilter = 'unsafe';
            showUnsafeBtn.style.background = '#dc3545';
            showUnsafeBtn.style.color = 'white';
            showAllBtn.style.background = '#6c757d';
            showAllBtn.style.color = 'white';
            showSafeBtn.style.background = '#6c757d';
            showSafeBtn.style.color = 'white';
            displayHistory();
        });
        
        // Set initial state for "All" button (default filter)
        showAllBtn.style.background = 'linear-gradient(135deg, #4a90e2 0%, #357abd 100%)';
        showAllBtn.style.color = 'white';
    }
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

// Load profiles and set active one
async function loadProfiles() {
    try {
        const urls = [
            `/api/profiles`,
            `http://localhost:5000/api/profiles`
        ];
        
        for (const url of urls) {
            try {
                const resp = await fetch(url);
                if (resp.ok) {
                    const data = await resp.json();
                    profiles = data.profiles || [];
                    currentProfileId = data.activeProfileId || (profiles[0]?.id);
                    
                    // Populate profile dropdown (only if element exists)
                    if (profileSelect) {
                        profileSelect.innerHTML = '';
                        profiles.forEach(profile => {
                            const option = document.createElement('option');
                            option.value = profile.id;
                            option.textContent = profile.name;
                            if (profile.id === currentProfileId) {
                                option.selected = true;
                            }
                            profileSelect.appendChild(option);
                        });
                    }
                    
                    // Show/hide delete button (can't delete if only one profile)
                    if (deleteProfileBtn) {
                        deleteProfileBtn.style.display = profiles.length > 1 ? 'block' : 'none';
                    }
                    
                    // Load restrictions for active profile
                    await loadRestrictions();
                    return;
                }
            } catch (e) {
                console.error(`Error fetching from ${url}:`, e);
                continue;
            }
        }
        console.warn("Could not load profiles from any URL");
    } catch (e) {
        console.error("Error loading profiles:", e);
    }
}

// Load restrictions from active profile
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

// Handle profile change
async function onProfileChange() {
    const selectedProfileId = profileSelect.value;
    if (!selectedProfileId || selectedProfileId === currentProfileId) {
        return;
    }
    
    try {
        const urls = [
            `/api/profiles/active`,
            `http://localhost:5000/api/profiles/active`
        ];
        
        for (const url of urls) {
            try {
                const resp = await fetch(url, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({profileId: selectedProfileId})
                });
                
                if (resp.ok) {
                    currentProfileId = selectedProfileId;
                    profileStatus.textContent = "Profile switched";
                    setTimeout(() => {
                        profileStatus.textContent = "";
                    }, 2000);
                    
                    // Load restrictions for new profile
                    await loadRestrictions();
                    return;
                }
            } catch (e) {
                continue;
            }
        }
    } catch (e) {
        console.error("Error switching profile:", e);
        alert("Failed to switch profile");
    }
}

// Show create profile dialog
function showCreateProfileDialog() {
    const name = prompt("Enter profile name:");
    if (!name || !name.trim()) {
        return;
    }
    
    createProfile(name.trim());
}

// Create new profile
async function createProfile(name) {
    const allergies = Array.from(allergyCheckboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
    const restrictions = Array.from(restrictionCheckboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
    
    try {
        const urls = [
            `/api/profiles`,
            `http://localhost:5000/api/profiles`
        ];
        
        for (const url of urls) {
            try {
                const resp = await fetch(url, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        name: name,
                        allergies: allergies,
                        restrictions: restrictions
                    })
                });
                
                if (resp.ok) {
                    const data = await resp.json();
                    profileStatus.textContent = "Profile created!";
                    setTimeout(() => {
                        profileStatus.textContent = "";
                    }, 2000);
                    
                    // Reload profiles and switch to new one
                    await loadProfiles();
                    profileSelect.value = data.profile.id;
                    await onProfileChange();
                    return;
                } else {
                    const error = await resp.json().catch(() => ({}));
                    alert(error.error || "Failed to create profile");
                    return;
                }
            } catch (e) {
                continue;
            }
        }
        alert("Failed to create profile");
    } catch (e) {
        console.error("Error creating profile:", e);
        alert("Failed to create profile");
    }
}

// Delete current profile
async function deleteCurrentProfile() {
    if (!currentProfileId) {
        return;
    }
    
    const currentProfile = profiles.find(p => p.id === currentProfileId);
    if (!currentProfile) {
        return;
    }
    
    if (!confirm(`Are you sure you want to delete "${currentProfile.name}"?`)) {
        return;
    }
    
    try {
        const urls = [
            `/api/profiles/${currentProfileId}`,
            `http://localhost:5000/api/profiles/${currentProfileId}`
        ];
        
        for (const url of urls) {
            try {
                const resp = await fetch(url, {
                    method: 'DELETE'
                });
                
                if (resp.ok) {
                    profileStatus.textContent = "Profile deleted";
                    setTimeout(() => {
                        profileStatus.textContent = "";
                    }, 2000);
                    
                    // Reload profiles (will switch to another profile automatically)
                    await loadProfiles();
                    return;
                } else {
                    const error = await resp.json().catch(() => ({}));
                    alert(error.error || "Failed to delete profile");
                    return;
                }
            } catch (e) {
                continue;
            }
        }
        alert("Failed to delete profile");
    } catch (e) {
        console.error("Error deleting profile:", e);
        alert("Failed to delete profile");
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
                <button class="close-popup-btn">Close</button>
            </div>
        `;
        
        // Add event listener to close button
        const closeBtn = popup.querySelector('.close-popup-btn');
        closeBtn.addEventListener('click', function() {
            closePopup(this, barcode, true, []);
        });
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
                <button class="close-popup-btn">Close</button>
            </div>
        `;
        
        // Add event listener to close button (using closure to access variables)
        const closeBtn = popup.querySelector('.close-popup-btn');
        closeBtn.addEventListener('click', function() {
            closePopup(this, barcode, false, result.flagged);
        });
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
        
        sessionStorage.setItem('notifications', JSON.stringify(notifications));
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
    
    // Get current profile info
    const currentProfile = profiles.find(p => p.id === currentProfileId);
    const profileName = currentProfile?.name || "Unknown Profile";
    const profileAllergies = currentProfile?.allergies || [];
    const profileRestrictions = currentProfile?.restrictions || [];
    
    const historyItem = {
        barcode: barcode,
        productName: productName,
        imageUrl: imageUrl,
        productData: productData,
        isSafe: isSafe,
        timestamp: new Date().toISOString(),
        profileId: currentProfileId,
        profileName: profileName,
        profileAllergies: [...profileAllergies], // Copy array
        profileRestrictions: [...profileRestrictions] // Copy array
    };
    
    scanHistory.unshift(historyItem);
    
    // Keep only last 100 items
    if (scanHistory.length > 100) {
        scanHistory = scanHistory.slice(0, 100);
    }
    
    sessionStorage.setItem('scanHistory', JSON.stringify(scanHistory));
    displayHistory();
}

// Update history item status
function updateHistoryItemStatus(barcode, isSafe, flagged) {
    const item = scanHistory.find(h => h.barcode === barcode);
    if (item) {
        item.isSafe = isSafe;
        item.flagged = flagged;
        item.checkedAt = new Date().toISOString();
        
        // Preserve profile info from scan time - only add if it wasn't saved initially
        // This ensures we keep the profile that was active when the scan was performed,
        // not the current profile (which might have changed)
        if (!item.profileId && currentProfileId) {
            const currentProfile = profiles.find(p => p.id === currentProfileId);
            if (currentProfile) {
                item.profileId = currentProfileId;
                item.profileName = currentProfile.name || "Unknown Profile";
                item.profileAllergies = [...(currentProfile.allergies || [])];
                item.profileRestrictions = [...(currentProfile.restrictions || [])];
            }
        }
        // Note: We don't update profile info if it already exists, to preserve the original scan context
        
        sessionStorage.setItem('scanHistory', JSON.stringify(scanHistory));
        displayHistory(); // Refresh display to show updated info
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
        
        // Show profile info if available
        let profileInfo = '';
        if (item.profileName) {
            const allergiesCount = item.profileAllergies?.length || 0;
            const restrictionsCount = item.profileRestrictions?.length || 0;
            const restrictionsText = [];
            if (allergiesCount > 0) {
                restrictionsText.push(`${allergiesCount} allerg${allergiesCount === 1 ? 'y' : 'ies'}`);
            }
            if (restrictionsCount > 0) {
                restrictionsText.push(`${restrictionsCount} restriction${restrictionsCount === 1 ? '' : 's'}`);
            }
            const restrictionsSummary = restrictionsText.length > 0 ? ` • ${restrictionsText.join(', ')}` : '';
            profileInfo = `<div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">Profile: ${escapeHtml(item.profileName)}${restrictionsSummary}</div>`;
        }
        
        html += `
            <div class="history-item ${statusClass}" onclick="showHistoryPopup('${item.barcode}')">
                <h4>${escapeHtml(item.productName)} ${statusBadge}</h4>
                <p>${new Date(item.timestamp).toLocaleString()}</p>
                ${profileInfo}
            </div>
        `;
    });
    
    historyList.innerHTML = html;
}

// Show history popup with flagged items and profile info
window.showHistoryPopup = function(barcode) {
    // Find the history item
    const historyItem = scanHistory.find(item => item.barcode === barcode);
    if (!historyItem) {
        return;
    }
    
    const popup = document.createElement('div');
    popup.className = 'popup-overlay';
    
    const isSafe = historyItem.isSafe !== false;
    const statusClass = isSafe ? 'safe' : '';
    
    // Build flagged items list
    let flaggedSection = '';
    if (isSafe) {
        flaggedSection = `
            <div style="margin-bottom: 16px;">
                <strong>Result:</strong> <span style="color: #28a745; font-weight: 600;">✓ No dietary restrictions or allergies found in this product.</span>
            </div>
        `;
    } else {
        let flaggedList = '';
        if (historyItem.flagged && historyItem.flagged.length > 0) {
            historyItem.flagged.forEach(item => {
                flaggedList += `<li><strong>${escapeHtml(item.ingredient)}</strong> - ${escapeHtml(item.type)}: ${escapeHtml(item.item)}</li>`;
            });
        } else {
            flaggedList = '<li><em>No flagged ingredients</em></li>';
        }
        flaggedSection = `
            <div style="margin-bottom: 16px;">
                <strong>Flagged Ingredients:</strong>
                <ul style="margin-top: 8px; padding-left: 20px;">${flaggedList}</ul>
            </div>
        `;
    }
    
    // Build profile information
    let profileInfo = '';
    if (historyItem.profileName) {
        const allergies = historyItem.profileAllergies || [];
        const restrictions = historyItem.profileRestrictions || [];
        
        let allergiesHtml = '';
        if (allergies.length > 0) {
            allergiesHtml = `<div style="margin-top: 8px;"><strong>Allergies:</strong> ${allergies.map(a => `<span class="restriction-badge badge-allergy">${escapeHtml(a)}</span>`).join(' ')}</div>`;
        }
        
        let restrictionsHtml = '';
        if (restrictions.length > 0) {
            restrictionsHtml = `<div style="margin-top: 8px;"><strong>Dietary Restrictions:</strong> ${restrictions.map(r => `<span class="restriction-badge badge-restriction">${escapeHtml(r)}</span>`).join(' ')}</div>`;
        }
        
        profileInfo = `
            <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid var(--border-color);">
                <h4 style="color: var(--accent-blue); margin-bottom: 12px;">Profile Used:</h4>
                <div style="font-weight: 600; margin-bottom: 8px;">${escapeHtml(historyItem.profileName)}</div>
                ${allergiesHtml}
                ${restrictionsHtml}
            </div>
        `;
    }
    
    popup.innerHTML = `
        <div class="popup-content ${statusClass}">
            <h3>${isSafe ? '✓ Safe to Consume' : '⚠️ Dietary Restriction Alert'}</h3>
            <div style="margin-bottom: 16px;">
                <strong>Product:</strong> ${escapeHtml(historyItem.productName || 'Unknown Product')}
            </div>
            <div style="margin-bottom: 16px;">
                <strong>Scanned:</strong> ${new Date(historyItem.timestamp).toLocaleString()}
            </div>
            ${flaggedSection}
            ${profileInfo}
            <button class="close-popup-btn" style="margin-top: 20px;">Close</button>
        </div>
    `;
    
    // Add event listener to close button
    const closeBtn = popup.querySelector('.close-popup-btn');
    closeBtn.addEventListener('click', function() {
        popup.remove();
    });
    
    // Also allow closing by clicking outside
    popup.addEventListener('click', function(e) {
        if (e.target === popup) {
            popup.remove();
        }
    });
    
    document.body.appendChild(popup);
};

// Show product from history (alternative function for direct product view)
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
