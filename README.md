# Datathon Web App

Simple Flask + Node.js web app setup for hackathons.

## 📁 Project Structure

```
NvPmf/
├── app.py              # Flask backend (Python)
├── index.html          # Frontend (HTML/JS)
├── requirements.txt    # Python dependencies
├── package.json        # Node.js config (optional)
├── .env                # API keys (NOT in git)
├── .env.example        # Template for API keys
├── datasets/           # Put your datasets here
└── README.md           # This file
```

## 🚀 Quick Start

### 1. Install Python Dependencies

```bash
pip install -r requirements.txt
```

### 2. Set Up API Keys

1. Copy `.env.example` to `.env`:
   ```bash
   copy .env.example .env
   ```

2. Edit `.env` and add your actual API keys:
   ```
   API_KEY=your-actual-api-key-here
   ```

### 3. Add Your Datasets

Put your dataset files in the `datasets/` folder:
```
datasets/
  ├── data.csv
  ├── data.json
  └── ...
```

### 4. Run the App

**Start Flask Backend:**
```bash
python app.py
```

**Open Frontend:**
- Open `index.html` in your browser, OR
- Use a simple server: `python -m http.server 8000` then go to `http://localhost:8000`

## 📝 How It Works

1. **Flask (Backend)**: `app.py` handles API requests
   - Reads API keys from `.env` file
   - Serves data to frontend
   - Can read datasets from `datasets/` folder

2. **Frontend**: `index.html` is your web interface
   - Makes requests to Flask API
   - Displays results

3. **API Keys**: Stored in `.env` (never commit this file!)

## 🔧 Adding New Features

### Add a New API Endpoint

In `app.py`:
```python
@app.route('/api/your-endpoint', methods=['GET'])
def your_function():
    # Use API_KEY here if needed
    return jsonify({"data": "your data"})
```

### Use a Dataset

In `app.py`:
```python
import pandas as pd  # Add to requirements.txt: pandas==2.0.0

@app.route('/api/load-dataset', methods=['GET'])
def load_dataset():
    df = pd.read_csv('datasets/your-data.csv')
    return jsonify(df.to_dict())
```

### Call External API

In `app.py`:
```python
import requests  # Add to requirements.txt: requests==2.31.0

@app.route('/api/external', methods=['GET'])
def call_external():
    headers = {'Authorization': f'Bearer {API_KEY}'}
    response = requests.get('https://api.example.com/data', headers=headers)
    return jsonify(response.json())
```

## 🛡️ Security Notes

- ✅ `.env` is in `.gitignore` - your keys won't be committed
- ✅ Never share your `.env` file
- ✅ Use `.env.example` as a template for teammates

## 📚 Learning Resources

- **Flask**: https://flask.palletsprojects.com/
- **Python dotenv**: Loads `.env` files automatically
- **CORS**: Allows frontend to call backend from different ports

## 🐛 Troubleshooting

**Port 5000 already in use?**
- Change `PORT=5001` in `.env`

**CORS errors?**
- Make sure Flask-CORS is installed
- Check that `CORS(app)` is in `app.py`

**Can't find API key?**
- Make sure `.env` file exists
- Check that variable name matches: `API_KEY=...`

