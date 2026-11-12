# StudyPilot

**An AI-powered study assistant for document-based learning.**

[Live Demo](https://studypilot-agent.netlify.app) · [GitHub Repository](https://github.com/princy21aj/studypilot-agent)

## Overview

StudyPilot is a web-based AI study assistant that allows users to interact with learning materials through natural-language questions. It combines Retrieval-Augmented Generation (RAG), semantic search, and large language models to generate responses using relevant document context.

The project explores how retrieval-based AI can make academic materials easier to search, understand, and interact with.

## Core Technologies

| Layer | Technology |
|---|---|
| Frontend | React, Vite |
| Backend | Python, FastAPI |
| LLM Integration | Groq API |
| Vector Database | ChromaDB |
| Embeddings | Sentence Transformers |
| API Communication | REST |

## Architecture

```text
              User
                |
                v
         React Frontend
                |
                v
          FastAPI API
                |
         +------+------+
         |             |
         v             v
   Document/RAG     Groq LLM
    Processing          |
         |              |
         v              |
    Embeddings          |
         |              |
         v              |
      ChromaDB          |
         |              |
         v              |
   Retrieved Context ---+
                |
                v
          AI Response
                |
                v
         React Frontend
```

## Project Structure

```text
studypilot-agent/
│
├── agent/
│   ├── config.py
│   ├── loop.py
│   ├── rag.py
│   └── study.py
│
├── frontend/
│   └── React + Vite application
│
├── api.py
├── app.py
├── streamlit_app.py
├── requirements-api.txt
├── requirements.txt
└── README.md
```

## Getting Started

### Prerequisites

- Python
- Node.js and npm
- Groq API key

### 1. Clone the repository

```bash
git clone https://github.com/princy21aj/studypilot-agent.git
cd studypilot-agent
```

### 2. Set up the Python environment

```bash
python -m venv venv
```

Activate on Windows:

```powershell
.\venv\Scripts\Activate.ps1
```

Install backend dependencies:

```bash
pip install -r requirements-api.txt
```

### 3. Configure environment variables

Create a `.env` file in the project root and add the required API credentials using the variable names expected by the application.

Do not commit `.env` or expose API keys.

### 4. Start the backend

From the project root:

```bash
python -m uvicorn api:app --reload --host 127.0.0.1 --port 8000
```

API documentation:

`http://127.0.0.1:8000/docs`

### 5. Start the frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL displayed by Vite, usually:

`http://localhost:5173`

Keep both the backend and frontend running during local development.

## Development Direction

Areas being explored for future development:

- Improved document extraction and retrieval.
- OCR for scanned documents and images.
- Better understanding of diagrams and tables.
- More accurate retrieval and source references.
- Deeper contextual reasoning across study materials.

These are development goals, not claims that every capability is already implemented.

## Project Status

**Active Development**

Built with Python, React, and AI technologies.