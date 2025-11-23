# Datathon Application

A full-stack web application built for the Datathon hackathon.

## Project Structure

```
NvPmf/
├── backend/          # Python Flask backend
│   ├── app.py       # Main Flask application
│   ├── requirements.txt
│   └── README.md
├── frontend/        # Node.js frontend
│   ├── server.js    # Express server
│   ├── package.json
│   └── public/      # Static files (HTML, CSS, JS)
└── datasets/        # Data files
```

## Quick Start

### Prerequisites
- Python 3.8+
- Node.js 14+
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment:
```bash
python -m venv venv
```

3. Activate the virtual environment:
- Windows: `venv\Scripts\activate`
- Mac/Linux: `source venv/bin/activate`

4. Install dependencies:
```bash
pip install -r requirements.txt
```

5. Run the Flask server:
```bash
python app.py
```

The backend will be available at `http://localhost:5000`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the frontend server:
```bash
npm start
```

The frontend will be available at `http://localhost:3000`

## Development

- Backend API: `http://localhost:5000`
- Frontend App: `http://localhost:3000`

Make sure both servers are running for full functionality.

## API Endpoints

- `GET /` - Home endpoint
- `GET /api/health` - Health check
- `GET /api/data` - Get data
- `POST /api/data` - Post data

## Technologies

- **Backend**: Python, Flask, Flask-CORS
- **Frontend**: Node.js, Express, HTML, CSS, JavaScript

## License

MIT

