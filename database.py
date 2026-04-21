from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
import datetime
import os

DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    # O SQLAlchemy exige 'postgresql://', mas alguns provedores enviam 'postgres://'
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    engine = create_engine(DATABASE_URL)
else:
    SQLALCHEMY_DATABASE_URL = "sqlite:///./recorreia.db"
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    senha = Column(String)
    
    # Relacionamento: Um usuário pode ter várias análises
    analises = relationship("Analyse", back_populates="dono")

class Analyse(Base):
    __tablename__ = "analyses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    erros_formais = Column(String) 
    fundamentacao = Column(String)
    data_criacao = Column(DateTime, default=datetime.datetime.utcnow)

    # Relacionamento: Uma análise pertence a um usuário
    dono = relationship("User", back_populates="analises")