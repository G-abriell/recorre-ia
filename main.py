from fastapi import FastAPI, Request, UploadFile, File, Form, HTTPException, Depends, BackgroundTasks
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import uvicorn
import json
import base64
import os
import tempfile
from datetime import datetime, timedelta
from dotenv import load_dotenv
from groq import Groq
from jose import JWTError, jwt
from fpdf import FPDF
from typing import List

from sqlalchemy.orm import Session
from database import SessionLocal, engine, Base, User, Analyse
from passlib.context import CryptContext
from pydantic import BaseModel

# Inicialização da aplicação FastAPI
app = FastAPI(
    title="RecorreIA",
    description="API para análise de multas com Groq API",
    version="1.0.0"
)

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# --- BANCO DE DADOS E AUTENTICAÇÃO ---
# Cria as tabelas no banco de dados automaticamente
Base.metadata.create_all(bind=engine)

# Configuração do hash de senhas
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Configurações para JWT (Recuperação de Senha)
SECRET_KEY = os.getenv("SECRET_KEY", "sua_chave_secreta_super_segura_aqui") # Recomendado colocar no mainpy.env
ALGORITHM = "HS256"
RESET_TOKEN_EXPIRE_MINUTES = 30

# Schema Pydantic para receber dados de cadastro
class UserCreate(BaseModel):
    nome: str
    email: str
    senha: str

class UserLogin(BaseModel):
    email: str
    senha: str

class PasswordRecovery(BaseModel):
    email: str

class PasswordReset(BaseModel):
    token: str
    nova_senha: str

class AnalyseResponse(BaseModel):
    id: int
    user_id: int
    erros_formais: str
    fundamentacao: str
    data_criacao: datetime
    
    class Config:
        from_attributes = True # Compatibilidade do Pydantic para ler objetos do SQLAlchemy

class PDFRequest(BaseModel):
    fundamentacao: str

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/", response_class=HTMLResponse)
async def render_index(request: Request):
    return templates.TemplateResponse(request=request, name="index.html", context={})

# --- FUNÇÕES AUXILIARES JWT ---
def create_password_reset_token(email: str):
    expire = datetime.utcnow() + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)
    to_encode = {"sub": email, "exp": expire}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_password_reset_token(token: str) -> str:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            return None
        return email
    except JWTError:
        return None

# --- CONFIGURAÇÃO DA IA (GROQ) ---
# 1. Carrega as variáveis especificamente do arquivo mainpy.env
load_dotenv("mainpy.env")

# 2. O Python busca a chave nas variáveis de ambiente
API_KEY = os.getenv("GROQ_API_KEY") 
client = Groq(api_key=API_KEY)

@app.post("/analisar-multa")
async def analisar_multa(file: UploadFile = File(...), user_id: int = Form(None), db: Session = Depends(get_db)):
    # 1. Lê a imagem e converte para Base64 
    image_data = await file.read()
    base64_image = base64.b64encode(image_data).decode('utf-8')
    mime_type = file.content_type
    
    prompt = """
    Analise esta imagem de multa de trânsito.
    1. Extraia o máximo de informações visíveis (nome, cpf, endereço, placa, número da notificação, local, data, hora, descrição da infração). Se algo não estiver legível, retorne "Não identificado".
    2. Identifique possíveis erros formais e crie uma fundamentação jurídica baseada no CTB.
    
    Responda EXCLUSIVAMENTE em formato JSON puro, sem formatação Markdown, com esta estrutura exata:
    {
      "dados_extraidos": {
        "nome": "",
        "cpf": "",
        "endereco": "",
        "placa": "",
        "numero_notificacao": "",
        "detalhes_infracao": ""
      },
      "erros_formais": ["erro 1", "erro 2"],
      "fundamentacao": "texto aqui"
    }
    """

    try:
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{base64_image}",
                            }
                        }
                    ]
                }
            ],
            # Substituído por um modelo de visão suportado pela Groq
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            temperature=0.2, 
        )
        
        response_text = chat_completion.choices[0].message.content
        json_text = response_text.replace("```json", "").replace("```", "").strip()
        dados_ia = json.loads(json_text)
        
        # Salva no banco de dados caso o usuário esteja logado
        if user_id:
            try:
                # Prepara o contexto completo com dados extraídos para o histórico
                dados_ext = dados_ia.get("dados_extraidos", {})
                contexto_completo = (
                    f"[DADOS EXTRAÍDOS]\n"
                    f"Nome: {dados_ext.get('nome', 'Não identificado')}\n"
                    f"CPF: {dados_ext.get('cpf', 'Não identificado')}\n"
                    f"Endereço: {dados_ext.get('endereco', 'Não identificado')}\n"
                    f"Placa: {dados_ext.get('placa', 'Não identificada')}\n"
                    f"Notificação: {dados_ext.get('numero_notificacao', 'Não identificada')}\n"
                    f"Detalhes: {dados_ext.get('detalhes_infracao', 'Não identificada')}\n\n"
                    f"[FUNDAMENTAÇÃO]\n{dados_ia.get('fundamentacao', '')}"
                )
                
                nova_analise = Analyse(
                    user_id=user_id,
                    erros_formais=json.dumps(dados_ia.get("erros_formais", [])),
                    fundamentacao=contexto_completo
                )
                db.add(nova_analise)
                db.commit()
            except Exception as db_e:
                print(f"Erro ao salvar análise no BD: {str(db_e)}")
                db.rollback()
        
        return JSONResponse(content=dados_ia)

    except Exception as e:
        erro_real = f"Erro detalhado na Groq: {str(e)}"
        print(erro_real)
        raise HTTPException(status_code=500, detail=erro_real)

@app.post("/chat")
async def chat_duvida(request: Request):
    dados = await request.json()
    pergunta_usuario = dados.get("pergunta")
    contexto_multa = dados.get("contexto")
    historico_front = dados.get("historico", []) 

    mensagens_api = [
    {
        "role": "system",
        "content": f"""Você é a IA do RecorreIA, um assistente jurídico de trânsito sério e focado.
        
Contexto da multa analisada: {contexto_multa}

REGRAS DE INTERAÇÃO:
1. EDUCAÇÃO: Você pode responder a agradecimentos de forma breve e gentil.
2. BLOQUEIO DE ASSUNTO: Proibido responder sobre temas fora de trânsito.
3. GERAÇÃO DE PDF E COLETA DE DADOS: O seu sistema gera o PDF automaticamente quando você emite a tag secreta [GERAR_PDF].
Se o usuário pedir para gerar o PDF, ANTES de emitir a tag, VERIFIQUE se você possui TODAS as informações essenciais para preencher o documento:
- Nome completo do recorrente
- CPF e Endereço completo
- Placa do veículo
- Número da Notificação (Auto de Infração)
- Descrição da Infração, Local, Data e Hora
- Detalhes específicos (ex: velocidade registrada/limite, se for o caso)

- SE FALTAR ALGUMA INFORMAÇÃO: NÃO use a tag [GERAR_PDF]. Em vez disso, peça ao usuário no chat, de forma educada, para fornecer EXATAMENTE os dados que faltam (ex: "Para preparar o seu PDF, por favor, me informe o seu Nome Completo, CPF e Endereço.").
- SE VOCÊ TIVER TODAS AS INFORMAÇÕES (ou após o usuário informá-las no chat): Escreva o recurso de multa formal, profissional e completo para o Detran/JARI. PREENCHA todos os dados. NUNCA deixe campos com colchetes indicando para preencher, como [Seu Nome] ou [especifique o que falta].
Você DEVE iniciar a resposta EXATAMENTE com a tag [GERAR_PDF] seguida imediatamente pelo texto formal preenchido. NÃO inclua nenhum outro texto antes ou depois da tag.
4. COMO BLOQUEAR: Para assuntos fora de contexto, use: "Desculpe, meu foco é ajudar com infrações de trânsito."
5. CONCISÃO: Em conversas normais (não-PDF), use no máximo 2 parágrafos."""
    }
]

    for mensagem_antiga in historico_front:
        mensagens_api.append(mensagem_antiga)
        
    mensagens_api.append({"role": "user", "content": pergunta_usuario})

    try:
        chat_completion = client.chat.completions.create(
            messages=mensagens_api,
            model="llama-3.3-70b-versatile", 
        )
        
        return {"resposta": chat_completion.choices[0].message.content}
    except Exception as e:
        erro_real = f"Erro no chat da Groq: {str(e)}"
        print(erro_real)
        raise HTTPException(status_code=500, detail=erro_real)

# --- ROTAS DE AUTENTICAÇÃO ---
@app.post("/cadastro")
def cadastrar_usuario(user: UserCreate, db: Session = Depends(get_db)):
    # Verifica se o email já existe
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email já cadastrado.")
    
    hashed_password = pwd_context.hash(user.senha)
    novo_usuario = User(nome=user.nome, email=user.email, senha=hashed_password)
    
    db.add(novo_usuario)
    db.commit()
    db.refresh(novo_usuario)
    
    return {"mensagem": "Usuário cadastrado com sucesso", "usuario_id": novo_usuario.id}

@app.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    # Compara a senha enviada com o hash salvo no banco de dados
    if not db_user or not pwd_context.verify(user.senha, db_user.senha):
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos.")
    return {"mensagem": "Login bem-sucedido", "usuario_id": db_user.id, "nome": db_user.nome}

@app.post("/recuperar-senha")
def recuperar_senha(request: PasswordRecovery, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == request.email).first()
    if not user:
        # Retornamos sucesso mesmo se o usuário não existir para evitar vazamento de dados (user enumeration)
        return {"mensagem": "Se o e-mail estiver cadastrado, enviaremos as instruções de recuperação."}
    
    token = create_password_reset_token(email=user.email)
    
    # SIMULAÇÃO DE ENVIO DE E-MAIL
    # Em produção, você integraria com smtplib, Amazon SES, SendGrid, etc.
    print("\n" + "="*50)
    print(f"📧 SIMULAÇÃO DE E-MAIL PARA: {user.email}")
    print(f"Assunto: Recuperação de Senha - RecorreIA")
    print(f"Para criar uma nova senha, utilize este token: {token}")
    print("="*50 + "\n")
    
    return {"mensagem": "Se o e-mail estiver cadastrado, enviaremos as instruções de recuperação."}

@app.post("/redefinir-senha")
def redefinir_senha(request: PasswordReset, db: Session = Depends(get_db)):
    email = verify_password_reset_token(request.token)
    if not email:
        raise HTTPException(status_code=400, detail="Token inválido ou expirado.")
        
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
        
    # Atualiza a senha com o hash
    hashed_password = pwd_context.hash(request.nova_senha)
    user.senha = hashed_password
    db.commit()
    
    return {"mensagem": "Senha redefinida com sucesso."}

# --- ROTAS DE ANÁLISES E PDF ---
@app.get("/analises/{user_id}", response_model=List[AnalyseResponse])
def listar_analises_usuario(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
        
    analises = db.query(Analyse).filter(Analyse.user_id == user_id).all()
    return analises

@app.post("/gerar-pdf")
def gerar_pdf(request: PDFRequest, background_tasks: BackgroundTasks):
    pdf = FPDF()
    pdf.add_page()
    
    # Formatação de Documento Formal (Margens e Fonte)
    pdf.set_margins(left=20, top=20, right=20)
    pdf.set_font("Arial", size=12)
    texto_formatado = request.fundamentacao.encode('latin-1', 'replace').decode('latin-1')
    pdf.multi_cell(0, 7, texto_formatado)
    
    # Salvamos num arquivo temporário, retornamos ao usuário, e delegamos ao FastAPI para excluir o arquivo depois
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    temp_file.close()
    pdf.output(temp_file.name)
    
    background_tasks.add_task(os.remove, temp_file.name)
    
    return FileResponse(
        path=temp_file.name, 
        filename="recurso_infracao.pdf", 
        media_type="application/pdf"
    )