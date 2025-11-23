// frontend/script.js
const startBtn = document.getElementById("startScanner");
const stopBtn = document.getElementById("stopScanner");
const scanOutput = document.getElementById("scanOutput");
const checkOutput = document.getElementById("checkOutput");
const productTableContainer = document.getElementById("productTableContainer");

let html5QrcodeScanner = null;
let isScanning = false;

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

// Function to check product with backend API
async function checkProduct(barcode) {
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
            } else {
                checkOutput.innerHTML = `<span style="color:orange">Product found but no name available.</span>`;
            }
            
            // Display all product data in a table
            if (data.allData) {
                displayProductTable(data.allData);
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

// Function to display product information in a table
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
