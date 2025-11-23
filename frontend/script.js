// frontend/script.js
const startBtn = document.getElementById("startScanner");
const stopBtn = document.getElementById("stopScanner");
const scanOutput = document.getElementById("scanOutput");
const checkOutput = document.getElementById("checkOutput");

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
                checkOutput.textContent = "";
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
                checkOutput.innerHTML = `<span style="color:orange">Product not in database — try saving it first or use a different barcode.</span>`;
                return;
            }
            
            if (!resp.ok) {
                throw new Error(`HTTP error! status: ${resp.status}`);
            }
            
            const data = await resp.json();
            console.log("Received data:", data);
            
            // Display the product name
            if (data.productName) {
                checkOutput.innerHTML = `<div style="font-size: 20px; font-weight: bold; margin-top: 12px;">Item: ${data.productName}</div>`;
                
                if (data.safe) {
                    checkOutput.innerHTML += `<div class="safe">SAFE ✔</div>`;
                } else {
                    checkOutput.innerHTML += `<div class="unsafe">NOT SAFE ✘</div>` +
                        `<div style="margin-top:8px;"><strong>Flagged:</strong><br>` +
                        data.flagged.map(f => `${f.type.toUpperCase()}: ${f.item}`).join("<br>") +
                        `</div>`;
                }
            } else {
                checkOutput.innerHTML = `<span style="color:orange">Product found but no name available.</span>`;
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
}
