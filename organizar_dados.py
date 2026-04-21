import pdfplumber
import json
import os

nome_do_arquivo = "resolucao_contran.pdf"
dados_estruturados = []

print(f"Lendo as 31 páginas de {nome_do_arquivo}...")

with pdfplumber.open(nome_do_arquivo) as pdf:
    texto_completo = ""
    for pagina in pdf.pages:
        extracao = pagina.extract_text()
        if extracao:
            texto_completo += extracao + "\n"

# Debug: Ver se o texto foi realmente extraído
if not texto_completo.strip():
    print("ERRO: O texto extraído está vazio. O PDF pode ser uma imagem.")
else:
    print(f"Total de caracteres lidos: {len(texto_completo)}")
    
    # Vamos tentar separar por 'Art.' ou 'Artigo' (mais comum em resoluções)
    import re
    # Esta linha procura 'Art.' ou 'Artigo' seguido de números
    artigos = re.split(r'(?i)Art\.?\s?\d+|Artigo\s?\d+', texto_completo)
    
    print(f"Foram detectadas {len(artigos)} divisões no texto.")

    for i, trecho in enumerate(artigos):
        if len(trecho.strip()) > 20: # Ignora trechos muito pequenos
            dados_estruturados.append({
                "id": i,
                "conteudo": trecho.strip()
            })

    if dados_estruturados:
        with open("conhecimento_contran.json", "w", encoding="utf-8") as f:
            json.dump(dados_estruturados, f, ensure_ascii=False, indent=4)
        print(f"SUCESSO: Ficheiro 'conhecimento_contran.json' gerado com {len(dados_estruturados)} artigos!")
    else:
        print("AVISO: Nenhum artigo foi estruturado. Verifique o formato do texto.")