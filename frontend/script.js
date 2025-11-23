// frontend/script.js
const startBtn = document.getElementById("startScanner");
const stopBtn = document.getElementById("stopScanner");
const video = document.getElementById("video");
const scanOutput = document.getElementById("scanOutput");
const checkOutput = document.getElementById("checkOutput");

let codeReader = null;

startBtn.addEventListener("click", async () => {
  startBtn.disabled = true;
  stopBtn.disabled = false;
  scanOutput.textContent = "Starting camera...";

  codeReader = new ZXing.BrowserBarcodeReader();

  try {
    await codeReader.decodeFromVideoDevice(null, "video", async (result, err) => {
      if (result) {
        // We got a barcode
        const barcode = result.text;
        scanOutput.innerHTML = `<strong>Scanned:</strong> ${barcode}`;
        // Immediately call backend
        // (make sure backend is running on port 5000)
        try {
          const resp = await fetch(`/api/scan/${encodeURIComponent(barcode)}`);
          if (resp.status === 404) {
            checkOutput.innerHTML = `<span style="color:orange">Product not in database — try saving it first or use a different barcode.</span>`;
            return;
          }
          const data = await resp.json();
          if (data.safe) {
            checkOutput.innerHTML = `<div class="safe">SAFE ✔ — ${data.productName}</div>`;
          } else {
            // flash a big warning
            checkOutput.innerHTML = `<div class="unsafe">NOT SAFE ✘ — ${data.productName}</div>` +
              `<div style="margin-top:8px;"><strong>Flagged:</strong><br>` +
              data.flagged.map(f => `${f.type.toUpperCase()}: ${f.item}`).join("<br>") +
              `</div>`;
          }
        } catch (e) {
          console.error(e);
          checkOutput.textContent = "Error checking product (backend unreachable).";
        }
      }
      if (err && !(err instanceof ZXing.NotFoundException)) {
        // ignore NotFound (no barcode in frame)
        // console.debug(err);
      }
    });
  } catch (e) {
    console.error("Camera start failed", e);
    scanOutput.textContent = "Camera permission denied or no camera available.";
    startBtn.disabled = false;
    stopBtn.disabled = true;
  }
});

stopBtn.addEventListener("click", () => {
  if (codeReader) {
    codeReader.reset();
    codeReader = null;
  }
  startBtn.disabled = false;
  stopBtn.disabled = true;
  scanOutput.textContent = "";
  checkOutput.textContent = "";
});
