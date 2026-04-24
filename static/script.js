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
    let historicoChat = [];
    let currentUserId = null;

    // Feedback visual do arquivo selecionado
    const dropAreaText = document.querySelector('.file-drop-area p');
    const originalText = dropAreaText.textContent;
    
    // --- FUNÇÃO PARA MOSTRAR/ESCONDER SEÇÕES (SLIDESHOW) ---
    function showSection(sectionId) {
        const allSections = document.querySelectorAll('.view');
        allSections.forEach(section => {
            section.classList.remove('active');
            section.classList.add('hidden');
        });
        
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.classList.remove('hidden');
            targetSection.classList.add('active');
        }
    }

    // --- FUNÇÃO PARA MOSTRAR/ESCONDER SUB-SEÇÕES DENTRO DO DASHBOARD ---
    window.mostrarSubSecao = function(idAlvo) {
        // 1. Esconde todas as sub-seções dentro do dashboard
        const subSecoes = document.querySelectorAll('.sub-secao');
        subSecoes.forEach(sec => sec.style.display = 'none');

        // 2. Mostra apenas a que você quer
        const alvo = document.getElementById(idAlvo);
        if (alvo) {
            alvo.style.display = 'block';
            
            // 3. Se a seção for a de recursos, já carrega os dados
            if (idAlvo === 'section-recursos') {
                carregarHistorico(); 
            }
        }
    }
    
    // --- FUNÇÃO AUXILIAR DE LIMPEZA E FORMATAÇÃO (EXTREMA) ---
    function limparEFormatarTexto(texto) {
        if (!texto) return "";
        let limpo = texto.replace(/[>]/g, '').replace(/&gt;/gi, '').replace(/&#62;/g, '').replace(/#/g, '');
        limpo = limpo.replace(/^[ \t]+/gm, '');
        limpo = limpo.replace(/\n{3,}/g, '\n\n');
        let formatado = limpo.trim().replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        return formatado.replace(/\n/g, '<br>');
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

    document.getElementById('btn-close-alert').addEventListener('click', () => closeModal(modalAlert));

    document.getElementById('btn-back-dashboard').addEventListener('click', () => {
        fileInput.value = '';
        dropAreaText.textContent = originalText;
        showSection('view-dashboard');
        mostrarSubSecao('section-upload');
    });

    // --- SIMULAÇÃO DE AUTENTICAÇÃO NO FRONTEND ---
    function authSuccess(userName = "Motorista", userId = null) {
        closeModal(modalLogin);
        closeModal(modalRegister);
        navActions.classList.add('hidden');
        navUser.classList.remove('hidden');
        document.querySelector('.navbar').classList.add('logged-in');
        
        currentUserId = userId;
        navUser.querySelector('strong').textContent = userName;
        showSection('view-dashboard');
        mostrarSubSecao('section-upload');
        
        if (currentUserId) carregarHistorico();
    }

    // --- MENU DE PERFIL ---
    const btnProfileMenu = document.getElementById('btn-profile-menu');
    if (btnProfileMenu) {
        btnProfileMenu.addEventListener('click', (e) => {
            e.preventDefault();
            navUser.classList.toggle('open');
        });
        
        document.addEventListener('click', (e) => {
            if (!navUser.contains(e.target)) {
                navUser.classList.remove('open');
            }
        });
    }

    // --- CLIQUE NO LOGO ---
    const logoHome = document.getElementById('logo-home');
    if (logoHome) {
        logoHome.addEventListener('click', (e) => {
            e.preventDefault();
            showSection('view-landing');
        });
    }

    // --- ATUALIZAÇÃO DOS CLIQUES DO MENU ---
    document.querySelectorAll('[data-profile-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const action = e.currentTarget.getAttribute('data-profile-action');
            
            if (action === 'history') {
                // Meus Recursos
                showSection('view-dashboard');
                mostrarSubSecao('section-recursos');
            } else if (action === 'upload') {
                // Novo Recurso
                showSection('view-dashboard');
                mostrarSubSecao('section-upload');
            } else if (action === 'dashboard') {
                showSection('view-dashboard');
                mostrarSubSecao('section-upload');
            }
            
            navUser.classList.remove('open');
        });
    });

    document.getElementById('btn-logout').addEventListener('click', () => {
        navActions.classList.remove('hidden');
        navUser.classList.add('hidden');
        document.querySelector('.navbar').classList.remove('logged-in');
        currentUserId = null;
        document.getElementById('history-list').innerHTML = '<p style="color: var(--color-text-muted);">Faça login para ver seu histórico de recursos.</p>';
        showSection('view-landing');
    });

    document.getElementById('form-login').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('login-email').value;
        const senha = document.getElementById('login-password').value;

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
            authSuccess(data.nome.split(' ')[0], data.usuario_id);
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
                fileInput.value = '';
                dropAreaText.textContent = originalText;
                return;
            }

            dropAreaText.textContent = `Arquivo selecionado: ${file.name}`;
        } else {
            dropAreaText.textContent = originalText;
        }
    });

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
        chatWindow.innerHTML = "";
        historicoChat = [];

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
            const msgInicial = `<strong>Análise Concluída!</strong><br><br>${htmlExtraidos}<br><br><strong>Erros Formais:</strong><br>- ${data.erros_formais.join('<br>- ')}<br><br><strong>Fundamentação:</strong><br>${limparEFormatarTexto(data.fundamentacao)}`;
            
            showSection('view-analysis');
            adicionarMensagem('ia', msgInicial);
            
            if (currentUserId) carregarHistorico();

        } catch (error) {
            overlay.classList.add('hidden');
            showCustomAlert(`Falha ao processar a imagem.\nDetalhe do erro: ${error.message}`, "Erro na Análise");
            console.error(error);
        }
    });

    async function enviarDuvida() {
        const pergunta = inputDuvida.value.trim();
        if (!pergunta) return;

        adicionarMensagem('user', pergunta);
        inputDuvida.value = "";

        const idPensando = adicionarMensagem('ia', '');
        const elementoPensando = document.getElementById(idPensando).querySelector('span');
        const spanEm = document.createElement("em");
        spanEm.textContent = "Analisando a sua dúvida...";
        elementoPensando.appendChild(spanEm);

        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    pergunta: pergunta,
                    contexto: contextoDaAnalise,
                    historico: historicoChat
                })
            });

            if (!response.ok) throw new Error("Erro ao responder ao chat.");

            const data = await response.json();
            
            let respostaDaIA = data.resposta;

            if (respostaDaIA.includes("[GERAR_PDF]")) {
                let textoParaPDF = respostaDaIA.replace("[GERAR_PDF]", "").trim();
                respostaDaIA = "Entendido! O seu recurso foi formatado nos padrões exigidos e o download do documento em PDF começará em instantes.";
                gerarDownloadPDF(textoParaPDF);
            }
            
            let respostaFormatada = limparEFormatarTexto(respostaDaIA);
            
            const balaoResposta = document.getElementById(idPensando);
            efeitoDigitacao(balaoResposta, respostaFormatada, 15);
            
            historicoChat.push({"role": "user", "content": pergunta});
            historicoChat.push({"role": "assistant", "content": respostaDaIA});
            
        } catch (error) {
            const balaoErro = document.getElementById(idPensando).querySelector('span');
            balaoErro.textContent = "";
            const spanErro = document.createElement("span");
            spanErro.style.color = "red";
            spanErro.textContent = "Erro de conexão ao tentar responder.";
            balaoErro.appendChild(spanErro);
        }
    }

    btnEnviarDuvida.addEventListener('click', enviarDuvida);
    inputDuvida.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') enviarDuvida();
    });

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

    async function carregarHistorico() {
        if (!currentUserId) {
            return;
        }
        
        const historyList = document.getElementById('history-list');
        historyList.innerHTML = '<p style="color: var(--color-text-muted);">Carregando seu histórico...</p>';

        try {
            const response = await fetch(`/analises/${currentUserId}`);
            
            if (!response.ok) throw new Error(`Erro ao carregar histórico (Status: ${response.status})`);
            const analises = await response.json();
            
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
                    const msgInicial = `<strong>Análise Restaurada #${analise.id}</strong><br><br><strong>Erros Formais:</strong><br>- ${errosFormais.join('<br>- ')}<br><br><strong>Fundamentação:</strong><br>${limparEFormatarTexto(analise.fundamentacao)}`;
                    adicionarMensagem('ia', msgInicial);
                    showSection('view-analysis');
                });

                historyList.appendChild(item);
            });
        } catch (error) {
            console.error("ERRO FATAL NA BUSCA DE RECURSOS:", error);
            historyList.innerHTML = '<p style="color: var(--color-danger);">Não foi possível carregar seu histórico. Verifique o console para mais detalhes.</p>';
        }
    }

    function adicionarMensagem(remetente, conteudo) {
        const div = document.createElement('div');
        div.className = `chat-message ${remetente}`;
        div.id = 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
        
        // SEGURANÇA MÁXIMA: Criar um elemento e usar textContent
        const textSpan = document.createElement('span');
        textSpan.textContent = conteudo; // Isso transforma <script> em texto inofensivo
        
        div.appendChild(textSpan);
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

    const footerYear = document.getElementById('footer-year');
    if (footerYear) {
        footerYear.textContent = new Date().getFullYear();
    }
});
