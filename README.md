
# RecorreIA

**RecorreIA** is an automated legal assistant platform leveraging Large Language Models (LLMs) and Retrieval-Augmented Generation (RAG) to streamline the process of traffic ticket analysis and legal appeal generation in the Brazilian jurisdiction.

## Technical Architecture

The system implements a RAG pipeline to overcome the inherent knowledge cutoff and hallucination risks of standard LLMs. By integrating official CONTRAN resolutions directly into the model's context, the application ensures that every generated defense is grounded in current legislation.



### Key Functionalities

* **Legal Data Ingestion:** Automated extraction and structuring of normative PDF documents using `pdfplumber`.
* **Semantic Context Injection:** Dynamic retrieval of relevant legal articles based on user queries to populate the LLM prompt.
* **Advanced Text Processing:** Utilization of Regular Expressions (Regex) and string manipulation for cleaning LLM outputs and ensuring professional formatting.
* **Performance-Oriented UI:** A responsive web interface featuring glassmorphism design principles for an optimized user experience.

## Technology Stack

* **Backend:** Python 3.10+ | FastAPI
* **Intelligence:** Llama 3.3-70b via Groq Cloud API
* **Data Handling:** pdfplumber | SQLite | JSON
* **Frontend:** Vanilla JavaScript | CSS3 (Modern Glassmorphism)

## Installation and Deployment

### Prerequisites
* Python 3.10 or higher
* Groq API Key

### Configuration

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/RecorreIA.git
   cd RecorreIA/WEB
   ```

2. **Environment Setup**
   Install the required dependencies:
   ```bash
   python -m uvicorn main:app --reload
   ```

3. **Data Ingestion**
   Place the official CONTRAN PDF (e.g., `resolucao_contran.pdf`) in the project root and run the ingestion script to build the knowledge base:
   ```bash
   python organizar_dados.py
   ```

4. **Execution**
   Start the development server:
   ```bash
   uvicorn main:app --reload
   ```

## Development Context

This project is a core component of the Analysis and Systems Development (ADS) curriculum, designed to demonstrate proficiency in Full-stack development.
