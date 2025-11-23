from flask import Flask, jsonify, request
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend communication

# Configuration
app.config['DEBUG'] = True
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')

@app.route('/')
def home():
    """Home endpoint"""
    return jsonify({
        'message': 'Welcome to Datathon API',
        'status': 'running',
        'version': '1.0.0'
    })

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'datathon-backend'
    })

@app.route('/api/data', methods=['GET', 'POST'])
def data_endpoint():
    """Example data endpoint"""
    if request.method == 'GET':
        return jsonify({
            'message': 'GET request successful',
            'data': []
        })
    elif request.method == 'POST':
        data = request.get_json()
        return jsonify({
            'message': 'POST request successful',
            'received_data': data
        }), 201

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)

