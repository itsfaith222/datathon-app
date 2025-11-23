// Backend API URL
const API_URL = 'http://localhost:5000';

// Check backend status on page load
document.addEventListener('DOMContentLoaded', async () => {
    await checkBackendStatus();
    
    // Set up test button
    const testBtn = document.getElementById('testBtn');
    testBtn.addEventListener('click', testBackendConnection);
});

// Check if backend is running
async function checkBackendStatus() {
    const statusDiv = document.getElementById('status');
    statusDiv.innerHTML = '<span class="loading">Checking backend status...</span>';
    statusDiv.className = 'status-indicator loading';
    
    try {
        const response = await fetch(`${API_URL}/api/health`);
        if (response.ok) {
            const data = await response.json();
            statusDiv.innerHTML = `<span class="healthy">✓ Backend is running: ${data.status}</span>`;
            statusDiv.className = 'status-indicator healthy';
        } else {
            throw new Error('Backend responded with error');
        }
    } catch (error) {
        statusDiv.innerHTML = `<span class="error">✗ Backend is not reachable. Make sure Flask server is running on port 5000</span>`;
        statusDiv.className = 'status-indicator error';
    }
}

// Test backend connection
async function testBackendConnection() {
    const responseBox = document.getElementById('apiResponse');
    responseBox.textContent = 'Testing connection...';
    responseBox.className = 'response-box';
    
    try {
        // Test GET request
        const getResponse = await fetch(`${API_URL}/api/data`);
        const getData = await getResponse.json();
        
        // Test POST request
        const postResponse = await fetch(`${API_URL}/api/data`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                test: true,
                message: 'Hello from frontend!',
                timestamp: new Date().toISOString()
            })
        });
        const postData = await postResponse.json();
        
        responseBox.textContent = `GET Response:\n${JSON.stringify(getData, null, 2)}\n\nPOST Response:\n${JSON.stringify(postData, null, 2)}`;
        responseBox.className = 'response-box success';
    } catch (error) {
        responseBox.textContent = `Error: ${error.message}\n\nMake sure the Flask backend is running on http://localhost:5000`;
        responseBox.className = 'response-box error';
    }
}

