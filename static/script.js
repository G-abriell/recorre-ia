document.addEventListener('DOMContentLoaded', () => {
    // Elementos de SPA (Views)
    const viewLanding = document.getElementById('view-landing');
    const viewDashboard = document.getElementById('view-dashboard');
    const viewAnalysis = document.getElementById('view-analysis');
    
    // Modais e Navegação
    const modalLogin = document.getElementById('modal-login');
    const modalRegister = document.getElementById('modal-register');
    const modalAlert = document.getElementById('modal-alert');
    const alertTitle = document.getElementById('alert-title');
    const alertMessage = document.getElementById('alert-message');
    const navActions = document.getElementById('nav-actions');
    const navUser = document.getElementById('nav-user');
    
    const form = document.getElementById('upload-form');
    const fileInput = document.getElementById('imagem-multa');
    const overlay = document.getElementById('loading-overlay');
    const loadingMessage = document.getElementById('loading-message');
    const chatWindow = document.getElementById('chat-window');
    
    const btnEnviarDuvida = document.getElementById('send-chat');
    const inputDuvida = document.getElementById('chat-query');
    
    // Variáveis de estado da IA
    let contextoDaAnalise = "";
    let historicoChat = []; // NOVA: Memória da conversa
    let currentUserId = null;

    // Feedback visual do arquivo selecionado
    const dropAreaText = document.querySelector('.file-drop-area p');
    const originalText = dropAreaText.textContent;

    // --- SISTEMA SPA: GERENCIAMENTO DE ESTADOS ---
    function switchView(targetView) {
        // Oculta todas
        [viewLanding, viewDashboard, viewAnalysis].forEach(view => {
            if (view !== targetView) {
                view.classList.remove('active');
                setTimeout(() => view.classList.add('hidden'), 400); // Tempo da transição CSS
            }
        });
        
        // Exibe a alvo
        targetView.classList.remove('hidden');
        // Pequeno delay para acionar a transição de opacidade/deslizamento do CSS
        setTimeout(() => targetView.classList.add('active'), 50);
    }

    // --- CONTROLE DOS MODAIS ---
    function openModal(modal) { modal.classList.remove('hidden'); }
    function closeModal(modal) { modal.classList.add('hidden'); }

    // --- FUNÇÃO DE ALERTA CUSTOMIZADO ---
    function showCustomAlert(message, title = "Atenção") {
        alertTitle.textContent = title;
        alertMessage.textContent = message;
        openModal(modalAlert);
    }

    document.getElementById('btn-open-login').addEventListener('click', () => openModal(modalLogin));
    document.getElementById('btn-open-register').addEventListener('click', () => openModal(modalRegister));
    document.getElementById('btn-cta-start').addEventListener('click', () => openModal(modalRegister));
    
    document.querySelectorAll('.btn-close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => closeModal(e.target.closest('.modal')));
    });

    // Botão "Entendi" do alerta
    document.getElementById('btn-close-alert').addEventListener('click', () => closeModal(modalAlert));

    // Volta para Dashboard a partir da Análise
    document.getElementById('btn-back-dashboard').addEventListener('click', () => {
        fileInput.value = '';
        dropAreaText.textContent = originalText;
        switchView(viewDashboard);
    });

    // --- SIMULAÇÃO DE AUTENTICAÇÃO NO FRONTEND ---
    function authSuccess(userName = "Motorista", userId = null) {
        closeModal(modalLogin);
        closeModal(modalRegister);
        navActions.classList.add('hidden');
        navUser.classList.remove('hidden');
        document.querySelector('.navbar').classList.add('logged-in');
        
        currentUserId = userId;
        
        // Atualiza nome se fornecido
        navUser.querySelector('strong').textContent = userName;
        switchView(viewDashboard);
        
        if (currentUserId) carregarHistorico();
    }

    document.getElementById('btn-logout').addEventListener('click', () => {
        navActions.classList.remove('hidden');
        navUser.classList.add('hidden');
        document.querySelector('.navbar').classList.remove('logged-in');
        currentUserId = null;
        document.getElementById('history-list').innerHTML = '<p style="color: var(--color-text-muted);">Faça login para ver seu histórico de recursos.</p>';
        switchView(viewLanding);
    });

    document.getElementById('form-login').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('login-email').value;
        const senha = document.getElementById('login-password').value;

        // Efeito de Loading de botão
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.textContent;
        btn.textContent = "Autenticando...";
        btn.disabled = true;
        
        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, senha })
            });

            if (!response.ok) {
                const erroDoServidor = await response.json();
                throw new Error(erroDoServidor.detail || "Erro ao realizar o login.");
            }
            
            const data = await response.json();
            authSuccess(data.nome.split(' ')[0], data.usuario_id); // Passa o primeiro nome e ID para o dashboard
        } catch (error) {
            showCustomAlert(error.message, "Erro no Login");
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    });

    document.getElementById('form-register').addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = document.getElementById('reg-nome').value;
        const email = document.getElementById('reg-email').value;
        const senha = document.getElementById('reg-password').value;
        
        // Validação de senha forte (mínimo 8 chars, 1 maiúscula, 1 número, 1 especial)
        const senhaRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
        if (!senhaRegex.test(senha)) {
            showCustomAlert("A senha deve ter pelo menos 8 caracteres, incluindo uma letra maiúscula, um número e um caractere especial.", "Senha Fraca");
            return;
        }

        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.textContent;
        btn.textContent = "Criando conta...";
        btn.disabled = true;
        
        try {
            const response = await fetch('/cadastro', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome, email, senha })
            });

            if (!response.ok) {
                const erroDoServidor = await response.json();
                throw new Error(erroDoServidor.detail || "Erro ao realizar o cadastro.");
            }
            
            const data = await response.json();

            // Cadastro bem-sucedido
            authSuccess(nome.split(' ')[0], data.usuario_id);
        } catch (error) {
            showCustomAlert(error.message, "Erro no Cadastro");
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const tiposPermitidos = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
            
            if (!tiposPermitidos.includes(file.type)) {
                showCustomAlert('Arquivo inválido. Por favor, tente enviar um arquivo em formato de imagem comum, como JPG, PNG ou WEBP.', "Formato Inválido");
                fileInput.value = ''; // Limpa o campo para bloquear o envio
                dropAreaText.textContent = originalText; // Restaura o texto original
                return;
            }

            dropAreaText.textContent = `Arquivo selecionado: ${file.name}`;
        } else {
            dropAreaText.textContent = originalText;
        }
    });

    // 1. ENVIO DA IMAGEM
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!fileInput.files || fileInput.files.length === 0) {
            showCustomAlert('Por favor, selecione uma imagem da notificação de multa para continuar.', "Nenhum arquivo");
            return;
        }

        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        if (currentUserId) formData.append('user_id', currentUserId);

        overlay.classList.remove('hidden');
        chatWindow.innerHTML = ""; // Limpa chats antigos
        historicoChat = []; // Limpa a memória para a nova multa

        try {
            const response = await fetch('/analisar-multa', { method: 'POST', body: formData });
            
            if (!response.ok) {
                const erroDoServidor = await response.json();
                throw new Error(erroDoServidor.detail || `Erro no servidor (Status ${response.status})`);
            }

            const data = await response.json();
            overlay.classList.add('hidden');
            
            const extraidos = data.dados_extraidos || {};
            contextoDaAnalise = `[DADOS EXTRAÍDOS DA IMAGEM]\nNome: ${extraidos.nome || 'Não identificado'}\nCPF: ${extraidos.cpf || 'Não identificado'}\nEndereço: ${extraidos.endereco || 'Não identificado'}\nPlaca: ${extraidos.placa || 'Não identificada'}\nNotificação: ${extraidos.numero_notificacao || 'Não identificada'}\nDetalhes da Infração: ${extraidos.detalhes_infracao || 'Não identificada'}\n\n[FUNDAMENTAÇÃO]\n${data.fundamentacao}`;
            
            const htmlExtraidos = `<strong>Dados Lidos da Imagem:</strong><br>Nome: ${extraidos.nome || 'Não lido'}<br>Placa: ${extraidos.placa || 'Não lida'}<br>Notificação: ${extraidos.numero_notificacao || 'Não lida'}`;
            const msgInicial = `<strong>Análise Concluída!</strong><br><br>${htmlExtraidos}<br><br><strong>Erros Formais:</strong><br>- ${data.erros_formais.join('<br>- ')}<br><br><strong>Fundamentação:</strong><br>${data.fundamentacao.replace(/\n/g, '<br>')}`;
            
            // Transição SPA para a Área de Análise
            switchView(viewAnalysis);
            adicionarMensagem('ia', msgInicial);
            
            if (currentUserId) carregarHistorico(); // Atualiza histórico na dashboard

        } catch (error) {
            overlay.classList.add('hidden');
            showCustomAlert(`Falha ao processar a imagem.\nDetalhe do erro: ${error.message}`, "Erro na Análise");
            console.error(error);
        }
    });

    // 2. ENVIO DE MENSAGENS NO CHAT
    async function enviarDuvida() {
        const pergunta = inputDuvida.value.trim();
        if (!pergunta) return;

        adicionarMensagem('user', pergunta);
        inputDuvida.value = ""; 

        const idPensando = adicionarMensagem('ia', '<em>Analisando a sua dúvida...</em>');

        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    pergunta: pergunta,
                    contexto: contextoDaAnalise,
                    historico: historicoChat // Enviamos a memória para o servidor
                })
            });

            if (!response.ok) throw new Error("Erro ao responder ao chat.");

            const data = await response.json();
            
            let respostaDaIA = data.resposta;

            // Intercepta o pedido de geração de PDF
            if (respostaDaIA.includes("[GERAR_PDF]")) {
                let textoParaPDF = respostaDaIA.replace("[GERAR_PDF]", "").trim();
                // Substitui a mensagem da IA por um aviso amigável e limpo na tela
                respostaDaIA = "Entendido! O seu recurso foi formatado nos padrões exigidos e o download do documento em PDF começará em instantes.";
                gerarDownloadPDF(textoParaPDF);
            }
            
            let respostaFormatada = respostaDaIA.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            
            const balaoResposta = document.getElementById(idPensando);
            efeitoDigitacao(balaoResposta, respostaFormatada, 15);
            
            // ATUALIZA A MEMÓRIA DA CONVERSA
            historicoChat.push({"role": "user", "content": pergunta});
            historicoChat.push({"role": "assistant", "content": respostaDaIA});
            
        } catch (error) {
            document.getElementById(idPensando).innerHTML = "<span style='color:red;'>Erro de conexão ao tentar responder.</span>";
        }
    }

    btnEnviarDuvida.addEventListener('click', enviarDuvida);
    inputDuvida.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') enviarDuvida();
    });

    // --- FUNÇÃO PARA GERAR O DOWNLOAD DO PDF ---
    async function gerarDownloadPDF(textoFundamentacao) {
        const originalLoadingMsg = loadingMessage.textContent;
        loadingMessage.textContent = "Gerando o seu PDF com formatação oficial...";
        overlay.classList.remove('hidden');
        
        try {
            const response = await fetch('/gerar-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fundamentacao: textoFundamentacao })
            });

            if (!response.ok) throw new Error("Erro ao gerar PDF no servidor.");

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'recurso_infracao.pdf';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            showCustomAlert("Não foi possível baixar o PDF. Tente novamente.", "Erro no PDF");
        } finally {
            overlay.classList.add('hidden');
            loadingMessage.textContent = originalLoadingMsg;
        }
    }

    // --- CARREGAR HISTÓRICO DO BANCO DE DADOS ---
    async function carregarHistorico() {
        if (!currentUserId) return;
        try {
            const response = await fetch(`/analises/${currentUserId}`);
            if (!response.ok) throw new Error("Erro ao carregar histórico");
            const analises = await response.json();
            
            const historyList = document.getElementById('history-list');
            if (analises.length === 0) {
                historyList.innerHTML = '<p style="color: var(--color-text-muted);">Você ainda não possui recursos gerados.</p>';
                return;
            }
            
            historyList.innerHTML = '';
            analises.reverse().forEach(analise => {
                let errosFormais = [];
                try { errosFormais = JSON.parse(analise.erros_formais); } 
                catch(e) { errosFormais = [analise.erros_formais]; }
                
                const item = document.createElement('div');
                item.className = 'history-item';
                
                const dataFormatada = new Date(analise.data_criacao).toLocaleDateString('pt-BR', {
                    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                });

                item.innerHTML = `
                    <div class="history-header">
                        <span class="history-date">${dataFormatada}</span>
                        <span class="badge" style="background: rgba(249, 115, 22, 0.15); color: var(--color-orange); padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.8rem; font-weight: 600;">Análise #${analise.id}</span>
                    </div>
                    <div class="history-content">
                        <h4>Erros Encontrados:</h4>
                        <p style="margin-bottom: 0.5rem;">${errosFormais.join(' • ')}</p>
                        <p class="truncado"><strong>Fundamentação:</strong> ${analise.fundamentacao}</p>
                    </div>
                    <div class="history-actions">
                        <button type="button" class="btn-primary btn-sm btn-ver-analise">Rever no Chat</button>
                    </div>
                `;

                item.querySelector('.btn-ver-analise').addEventListener('click', () => {
                    contextoDaAnalise = analise.fundamentacao;
                    chatWindow.innerHTML = "";
                    historicoChat = [];
                    const msgInicial = `<strong>Análise Restaurada #${analise.id}</strong><br><br><strong>Erros Formais:</strong><br>- ${errosFormais.join('<br>- ')}<br><br><strong>Fundamentação:</strong><br>${analise.fundamentacao.replace(/\n/g, '<br>')}`;
                    adicionarMensagem('ia', msgInicial);
                    switchView(viewAnalysis);
                });

                historyList.appendChild(item);
            });
        } catch (error) {
            console.error("Falha ao carregar histórico", error);
        }
    }

    // --- FUNÇÕES VISUAIS ---
    function adicionarMensagem(remetente, conteudo) {
        const div = document.createElement('div');
        div.className = `chat-message ${remetente}`;
        div.id = 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9); 
        div.innerHTML = conteudo;
        chatWindow.appendChild(div);
        chatWindow.scrollTop = chatWindow.scrollHeight;
        return div.id;
    }

    function efeitoDigitacao(elemento, textoHtml, velocidade = 15) {
        elemento.innerHTML = ''; 
        let i = 0;
        let htmlAtual = '';
        
        function digitar() {
            if (i < textoHtml.length) {
                if (textoHtml[i] === '<') {
                    let tag = '';
                    while (textoHtml[i] !== '>' && i < textoHtml.length) {
                        tag += textoHtml[i];
                        i++;
                    }
                    tag += '>';
                    htmlAtual += tag;
                } else {
                    htmlAtual += textoHtml[i]; 
                    i++;
                }
                
                elemento.innerHTML = htmlAtual;
                chatWindow.scrollTop = chatWindow.scrollHeight; 
                
                setTimeout(digitar, velocidade);
            }
        }
        digitar();
    }
});