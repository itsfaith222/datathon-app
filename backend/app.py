from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
import os

# Load environment variables (including API keys)
load_dotenv()

app = Flask(__name__)
CORS(app)  # Allow frontend to talk to backend

# Example: Get API key from environment
API_KEY = os.getenv('API_KEY', 'your-api-key-here')

@app.route('/api/health', methods=['GET'])
def health():
    """Check if API is running"""
    return jsonify({"status": "ok", "message": "Flask API is working!"})

@app.route('/api/data', methods=['GET'])
def get_data():
    """Example endpoint that uses API key"""
    # In real app, you'd use API_KEY to make external API calls
    return jsonify({
        "message": "Data endpoint",
        "api_key_set": bool(API_KEY and API_KEY != 'your-api-key-here')
    })

@app.route('/api/dataset', methods=['GET'])
def get_dataset():
    """Example endpoint for dataset operations"""
    # You can read datasets from the datasets/ folder here
    # Path: ../datasets/ (one level up from backend/)
    return jsonify({
        "message": "Dataset endpoint ready",
        "note": "Add code here to read from ../datasets/ folder"
    })

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    print(f"🚀 Flask server starting on http://localhost:{port}")
    app.run(debug=True, host='0.0.0.0', port=port)

