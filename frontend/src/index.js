import { initPdfWorker, getPdfDocument, extractImagesFromPage } from './services/pdfService.js';
import { callUniversalAI, getBraillePrompt, getAltaLegibilidadePrompt } from './services/aiService.js';
import { initTTS, speakText, getIsSpeaking } from './services/ttsService.js';
import { generateAndDownloadDocx } from './services/docxService.js';
import { showToast, initToast } from './utils/utils.js';
import { detectProvider, showField, hideField } from './utils/apiProviderDetector.js';
import { api } from './services/apiService.js';


// initPdfWorker removed
try { initToast(); } catch (e) { console.error("Toast init failed:", e); }
try { initTTS(); } catch (e) { console.error("TTS init failed:", e); }
try { initPdfWorker(); } catch (e) { console.error("PDF Worker init failed:", e); }

const adaptButton = document.getElementById('adapt-btn');
const loadingIndicator = document.getElementById('loading');
const pdfUpload = document.getElementById('pdf-upload');
const fileNameDisplay = document.getElementById('file-name-display');
const errorContainer = document.getElementById('error-container');
const inputSection = document.querySelector('.input-section');
const brailleOutput = document.getElementById('braille-output');
const highLegibilityOutput = document.getElementById('high-legibility-output');
const brailleDownloadBtn = document.getElementById('braille-download-btn');
const highLegibilityDownloadBtn = document.getElementById('high-legibility-download-btn');
const braillePreviewBtn = document.getElementById('braille-preview-btn');
const highLegibilityPreviewBtn = document.getElementById('high-legibility-preview-btn');
const disciplinaInput = document.getElementById('disciplina-input');
const professorInput = document.getElementById('professor-input');
const dataInput = document.getElementById('data-input');

// Academic context dropdowns
const disciplineSelect = document.getElementById('discipline-select');
const classSelect = document.getElementById('class-select');
const studentSelect = document.getElementById('student-select');
const studentAutoBadge = document.getElementById('student-auto-badge');
const studentBadgeText = document.getElementById('student-badge-text');

// Cache for academic data
let academicDisciplines = [];
let academicClasses = [];
let academicStudents = [];

const tituloInput = document.getElementById('titulo-input');
const fontSizeInput = document.getElementById('font-size-input');
const brailleCustomInstructionsInput = document.getElementById('braille-custom-instructions-input');
const highLegibilityCustomInstructionsInput = document.getElementById('high-legibility-custom-instructions-input');
// Configurações de IA agora são gerenciadas pelo backend
const previewModal = document.getElementById('preview-modal');
const modalTitle = document.getElementById('modal-title');
const modalContent = document.getElementById('modal-content');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalCloseFooterBtn = document.getElementById('modal-close-footer-btn');
const previewModalControls = document.getElementById('preview-modal-controls');
const previewFontSizeInput = document.getElementById('preview-font-size-input');
const fontDecreaseBtn = document.getElementById('font-decrease-btn');
const fontIncreaseBtn = document.getElementById('font-increase-btn');
const themeBtns = document.querySelectorAll('.theme-btn');
const removeBoldBtn = document.getElementById('remove-bold-btn');
const toggleDyslexiaBtn = document.getElementById('toggle-dyslexia-btn');
const brailleProgress = document.getElementById('braille-progress');
const highLegibilityProgress = document.getElementById('high-legibility-progress');
const loadingMainText = document.getElementById('loading-main-text');
const progressBarFill = document.getElementById('progress-bar-fill');
const brailleTtsBtn = document.getElementById('braille-tts-btn');
const highLegibilityTtsBtn = document.getElementById('high-legibility-tts-btn');
const brailleCopyBtn = document.getElementById('braille-copy-btn');
const highLegibilityCopyBtn = document.getElementById('high-legibility-copy-btn');
const brailleMp3Btn = document.getElementById('braille-mp3-btn');
const highLegibilityMp3Btn = document.getElementById('high-legibility-mp3-btn');
// Configuração de IA removida do frontend
const apiKeyHint = document.getElementById('api-key-hint');
const headerTitleInput = document.getElementById('header-title-input');
const headerLegalInput = document.getElementById('header-legal-input');
const headerExtraInput = document.getElementById('header-extra-input');
const mainNav = document.getElementById('main-nav');
const navAdapterBtn = document.getElementById('nav-adapter-btn');
const navReportsBtn = document.getElementById('nav-reports-btn');
const adapterSection = document.getElementById('adapter-section');
const complianceSection = document.getElementById('compliance-section');
const statTotal = document.getElementById('stat-total');
const statGrowth = document.getElementById('stat-growth');
const statBraille = document.getElementById('stat-braille');
const statHighLegibility = document.getElementById('stat-high-legibility');
const periodSelect = document.getElementById('period-select');
const exportReportBtn = document.getElementById('export-report-btn');



// Elementos de Autenticação
const authOverlay = document.getElementById('auth-overlay');
const loginModal = document.getElementById('login-modal');
const registerModal = document.getElementById('register-modal');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const userNav = document.getElementById('user-nav');
const appContent = document.getElementById('app-content');
const goToRegister = document.getElementById('go-to-register');
const goToLogin = document.getElementById('go-to-login');



let brailleAdaptedText = '';
let highLegibilityAdaptedText = '';
let selectedFileBase64 = null;
let selectedFileObject = null;
let originalFileName = '';
let totalPages = 0;
let isDyslexiaMode = false;
let detectedProvider = null;
let isAutoConfigured = false;
let user = null;
let currentDocumentId = null;

// Batch upload state
let batchFiles = []; // Array of { file, status: 'pending'|'processing'|'done'|'error', error?: string }
const batchFileList = document.getElementById('batch-file-list');


const toggleSplitViewBtn = document.getElementById('toggle-split-view-btn');
const pdfPreviewContainer = document.getElementById('pdf-preview-container');
const pdfRenderCanvas = document.getElementById('pdf-render-canvas');
const prevPageBtn = document.getElementById('prev-page-btn');
const nextPageBtn = document.getElementById('next-page-btn');
const pageNumDisplay = document.getElementById('page-num-display');

let isSplitViewActive = false;
let currentPdfPage = 1;
let pdfDoc = null;
let pageRendering = false;
let pageNumPending = null;

const validMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
];



function getMimeByName(fileName) {
    const ext = fileName.toLowerCase().split('.').pop();
    const map = {
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    };
    return map[ext] || 'application/octet-stream';
}

async function extractTextFromDocx(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await window.mammoth.extractRawText({ arrayBuffer });
        return result.value;
    } catch (e) {
        console.error("Erro ao extrair DOCX:", e);
        return "";
    }
}

async function extractTextFromPptx(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const zip = await window.JSZip.loadAsync(arrayBuffer);
        let fullText = "";
        const slideFiles = Object.keys(zip.files).filter(name => name.startsWith("ppt/slides/slide") && name.endsWith(".xml"));

        // Ordenar slides numericamente
        slideFiles.sort((a, b) => {
            const numA = parseInt(a.match(/\d+/)[0]);
            const numB = parseInt(b.match(/\d+/)[0]);
            return numA - numB;
        });

        for (const slideFile of slideFiles) {
            const content = await zip.files[slideFile].async("string");
            const slideNum = slideFile.match(/\d+/)[0];
            fullText += `--- SLIDE ${slideNum} ---\n`;
            // Regex simples para pegar conteúdo entre tags <a:t> (texto no XML do Office)
            const matches = content.match(/<a:t>([^<]+)<\/a:t>/g);
            if (matches) {
                fullText += matches.map(m => m.replace(/<\/?a:t>/g, "")).join(" ") + "\n\n";
            }
        }
        return fullText;
    } catch (e) {
        console.error("Erro ao extrair PPTX:", e);
        return "";
    }
}

// API Key Sanitization - Prevents key exposure in error messages
function sanitizeErrorMessage(message, key) {
    if (!key) return message;
    // Replace all occurrences of the API key with a protected placeholder
    return message.replaceAll(key, '[CHAVE PROTEGIDA]');
}

// Auth Functions
function showAuthModal(modalType = 'login') {
    authOverlay.style.display = 'flex';
    if (modalType === 'login') {
        loginModal.style.display = 'block';
        registerModal.style.display = 'none';
    } else {
        loginModal.style.display = 'none';
        registerModal.style.display = 'block';
    }
}

function hideAuthModal() {
    authOverlay.style.display = 'none';
    loginModal.style.display = 'none';
    registerModal.style.display = 'none';
}

function updateUserNav() {
    if (user) {
        userNav.innerHTML = `
            <div class="user-info">
                <span>Olá, ${user.name}</span>
                <button id="logout-btn" class="btn-secondary" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;">Sair</button>
            </div>
            <button id="billing-btn" class="btn btn-primary" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;">Minha Assinatura</button>
        `;
        appContent.style.display = 'flex';
        if (mainNav) mainNav.style.display = 'flex';
        appContent.classList.remove('logged-out');
        hideAuthModal();

        // Event Listeners for Nav
        document.getElementById('logout-btn').addEventListener('click', () => {
            api.logout();
            user = null;
            localStorage.removeItem('user');
            if (mainNav) mainNav.style.display = 'none';
            showSection('adapter');
            updateUserNav();
        });

        document.getElementById('billing-btn').addEventListener('click', async () => {
            try {
                const { portalUrl } = await api.createPortalSession();
                window.location.href = portalUrl;
            } catch (err) {
                if (user.email === 'aragaovictor31@gmail.com') {
                    const setup = confirm('Você é o Dev! Como não tem assinatura ativa, o portal do Stripe não abre. Deseja iniciar um checkout de teste para gerar um ID de cliente?');
                    if (setup) {
                        const { checkoutUrl } = await api.createCheckoutSession();
                        window.location.href = checkoutUrl;
                    }
                } else {
                    showToast('Assinatura inativa: Você precisa assinar um plano para acessar o portal.', 'warning');
                }
            }
        });

    } else {
        userNav.innerHTML = `<button id="show-login-btn" class="btn btn-primary">Entrar / Cadastrar</button>`;
        appContent.style.display = 'flex'; // Permitir ver a tela, mas com blur via CSS
        appContent.classList.add('logged-out');
        showAuthModal('login'); // Abre automaticamente o modal de login

        document.getElementById('show-login-btn').addEventListener('click', () => showAuthModal('login'));
    }
}

async function checkSession() {
    // console.log('Iniciando verificação de sessão...');
    if (api.token) {
        // console.log('Token encontrado, buscando dados do usuário...');
        try {
            const response = await api.getMe();
            user = response.user;
            localStorage.setItem('user', JSON.stringify(user));
            // console.log('Usuário autenticado:', user.name);
            updateUserNav();
            loadAcademicData(); // Load academic dropdowns after session
        } catch (err) {
            console.error('Falha ao restaurar sessão:', err);
            // Só faz logout se for erro de autenticação (401/403)
            if (err.status === 401 || err.status === 403) {
                // console.log('Token inválido ou expirado. Deslogando...');
                api.logout();
                user = null;
            }
            updateUserNav();
        }
    } else {
        // console.log('Nenhum token encontrado.');
        updateUserNav();
    }
}

function showError(message) {
    if (!errorContainer) return;


    // Get the API key to sanitize it from error messages (Hotfix 4.2: removido acesso a apiKeyInput)
    const apiKey = '';

    // Apply security filter to prevent key exposure
    const cleanMessage = sanitizeErrorMessage(message, apiKey);

    errorContainer.textContent = `⚠️ ${cleanMessage}`;
    errorContainer.style.display = 'block';

    // Toast shows generic message without technical details
    showToast('Ocorreu um erro na adaptação. Verifique o aviso na tela.', 'error');
}

function clearError() {
    if (!errorContainer) return;
    errorContainer.textContent = '';
    errorContainer.style.display = 'none';
}

function updateProgress(percent) {
    if (progressBarFill) progressBarFill.style.width = `${percent}%`;
}

async function handleFile(file) {
    const resetFileState = () => {
        if (pdfUpload) pdfUpload.value = '';
        if (fileNameDisplay) fileNameDisplay.textContent = 'Nenhum arquivo selecionado';
        selectedFileBase64 = null;
        selectedFileObject = null;
        originalFileName = '';
        totalPages = 0;
        const existingCanvas = inputSection.querySelector('canvas');
        if (existingCanvas) existingCanvas.remove();
    };

    if (!file) { resetFileState(); return; }
    const isAllowedExtension = file.name.toLowerCase().match(/\.(pdf|doc|docx|pptx)$/);
    if (!validMimeTypes.includes(file.type) && !isAllowedExtension) {
        showError('Formato de arquivo inválido. Por favor, selecione um arquivo PDF, Word ou PowerPoint.');
        resetFileState();
        return;
    }

    const MAX_FILE_SIZE_MB = 10;
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) { showError(`O arquivo é muito grande. Por favor, selecione um arquivo com menos de ${MAX_FILE_SIZE_MB} MB.`); resetFileState(); return; }

    clearError();
    if (fileNameDisplay) fileNameDisplay.textContent = `Arquivo selecionado: ${file.name}`;
    originalFileName = file.name;
    selectedFileObject = file;
    selectedFileBase64 = null;
    if (tituloInput) tituloInput.value = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    if (dataInput) dataInput.value = new Date().toISOString().split('T')[0];

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (isPdf) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await getPdfDocument(arrayBuffer);
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 0.5 });
            const existingCanvas = inputSection.querySelector('canvas');
            if (existingCanvas) existingCanvas.remove();
            const canvas = document.createElement('canvas');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
            const label = inputSection.querySelector('label');
            const oldCanvasInLabel = label.querySelector('canvas');
            if (oldCanvasInLabel) oldCanvasInLabel.remove();
            label.insertBefore(canvas, label.firstChild);
        } catch (e) { console.error("Erro ao gerar preview do PDF:", e); }
    } else {
        const existingCanvas = inputSection.querySelector('canvas');
        if (existingCanvas) existingCanvas.remove();
        const label = inputSection.querySelector('label');
        const oldCanvasInLabel = label.querySelector('canvas');
        if (oldCanvasInLabel) oldCanvasInLabel.remove();
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
        const isDocx = file.name.toLowerCase().endsWith('.docx');
        const isPptx = file.name.toLowerCase().endsWith('.pptx');
        let extractedText = null;

        if (isDocx) extractedText = await extractTextFromDocx(file);
        else if (isPptx) extractedText = await extractTextFromPptx(file);

        selectedFileBase64 = {
            mimeType: file.type || getMimeByName(file.name),
            data: reader.result.substring(reader.result.indexOf(',') + 1),
            extractedText: extractedText
        };
    };

    if (isPdf) {
        const arrayBufferReader = new FileReader();
        arrayBufferReader.onloadend = async () => {
            try {
                const pdf = await getPdfDocument(new Uint8Array(arrayBufferReader.result));
                totalPages = pdf.numPages;
                if (fileNameDisplay) fileNameDisplay.textContent = `Arquivo selecionado: ${file.name} (${totalPages} páginas)`;
            } catch (error) { totalPages = 0; }
        };
        arrayBufferReader.readAsArrayBuffer(file);
    } else {
        totalPages = 0;
    }

    reader.readAsDataURL(file);
}


// Lógica de Temas do Modal
function applyModalTheme(theme) {
    if (!modalContent) return;

    // Remove classes anteriores
    modalContent.classList.remove('theme-dark', 'theme-high-contrast');

    // Atualiza botões
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.theme === theme) btn.classList.add('active');
    });

    // Aplica novo tema
    if (theme === 'dark') {
        modalContent.classList.add('theme-dark');
    } else if (theme === 'high-contrast') {
        modalContent.classList.add('theme-high-contrast');
    }
}

// Event Listeners para Temas
themeBtns.forEach(btn => {
    btn.addEventListener('click', () => applyModalTheme(btn.dataset.theme));
});


function updateKanbanCounters() {
    ['waiting', 'processing', 'done'].forEach(col => {
        const body = document.querySelector(`#kanban-${col}-col .kanban-body`);
        const badge = document.getElementById(`kanban-${col}-count`);
        if (body && badge) {
            badge.textContent = body.querySelectorAll('.kanban-card').length;
        }
    });
}

function moveCardToColumn(cardId, columnSuffix) {
    const card = document.getElementById(cardId);
    const columnBody = document.querySelector(`#kanban-${columnSuffix}-col .kanban-body`);
    if (card && columnBody) {
        columnBody.appendChild(card);
        updateKanbanCounters();
    }
}

function clearResultsSection() {
    ['waiting', 'processing', 'done'].forEach(col => {
        const body = document.querySelector(`#kanban-${col}-col .kanban-body`);
        if (body) body.innerHTML = '';
        const count = document.getElementById(`kanban-${col}-count`);
        if (count) count.textContent = '0';
    });
    
    const resultsSection = document.querySelector('.results-section');
    if (resultsSection) {
        resultsSection.style.display = 'flex';
    }
}

function createResultCard(title, type, documentId, initialColumn = 'done') {
    const columnBody = document.querySelector(`#kanban-${initialColumn}-col .kanban-body`);
    if (!columnBody) return null;

    const cardId = `result-card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const isBraille = type === 'braille';
    const isAutism = type === 'autism';
    
    let typeLabel, typeDesc;
    if (isBraille) {
        typeLabel = 'Versão para Braille';
        typeDesc = '(Foco em Transcrição Braille)';
    } else if (isAutism) {
        typeLabel = 'Versão para Autismo (TEA)';
        typeDesc = '(Adaptação Multi-Agente Científica)';
    } else {
        typeLabel = 'Versão para Alta Legibilidade';
        typeDesc = '(Foco em Baixa Visão/Dislexia)';
    }

    const card = document.createElement('div');
    card.className = 'result-card kanban-card dynamic-card';
    card.id = cardId;
    card.style.display = 'flex'; // Importante para CSS

    // HTML Estruturado do Card
    card.innerHTML = `
        <div class="card-header">
            <h3>${typeLabel}</h3>
            <p>${typeDesc}</p>
            <p style="font-size: 0.85rem; color: var(--primary-color); font-weight: 500; margin-top: 0.25rem; display: flex; align-items: center; gap: 0.25rem;"><i data-lucide="file" style="width: 14px; height: 14px;"></i> ${title}</p>
        </div>
        <div class="card-content">
            <textarea id="${cardId}-output" aria-label="Texto adaptado: ${title}" readonly placeholder="Aguardando geração..."></textarea>
        </div>
        <div class="card-footer">
            <button class="btn-secondary tts-btn" type="button" disabled title="Ouvir texto">
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0z" fill="none"/><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                <span>Ouvir</span>
            </button>
            <button class="btn-secondary copy-btn" type="button" disabled title="Copiar texto">
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0z" fill="none"/><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                <span>Copiar</span>
            </button>
            <button class="btn-secondary preview-btn" type="button" disabled>Visualizar</button>
            
            <button class="email-btn btn-secondary" type="button" disabled title="Enviar para Aluno">
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor" style="margin-right:4px"><path d="M0 0h24v24H0z" fill="none"/><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
                <span>Email</span>
            </button>

            <button class="download-btn" type="button" disabled>
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><rect fill="none" height="24" width="24"/><path d="M18,15v3H6v-3H4v3c0,1.1,0.9,2,2,2h12c1.1,0,2-0.9,2-2v-3H18z M17,11l-1.41-1.41L13,12.17V4h-2v8.17L8.41,9.59L7,11l5,5 L17,11z"/></svg>
                <span>Baixar .docx</span>
            </button>
        </div>
    `;

    columnBody.appendChild(card);
    updateKanbanCounters();
    
    const textarea = card.querySelector('textarea');

    // Setup Buttons
    const ttsBtn = card.querySelector('.tts-btn');
    const copyBtn = card.querySelector('.copy-btn');
    const previewBtn = card.querySelector('.preview-btn');
    const emailBtn = card.querySelector('.email-btn');
    const downloadBtn = card.querySelector('.download-btn');

    // Return interface to update card state
    return {
        id: cardId,
        setText: (text) => {
            textarea.value = text;
            textarea.scrollTop = textarea.scrollHeight;
        },
        enableButtons: (text) => {
            [ttsBtn, copyBtn, previewBtn, emailBtn, downloadBtn].forEach(b => b.disabled = false);

            // Event Listeners
            ttsBtn.onclick = () => {
                const icon = ttsBtn.querySelector('svg'); // Simplificado, ideal usar updateTTSBtns logic
                speakText(text, () => { }, () => { });
            };
            copyBtn.onclick = () => copyText(text, copyBtn);

            previewBtn.onclick = () => {
                // Set globals for preview helper (legacy support)
                if (isBraille) brailleAdaptedText = text;
                else highLegibilityAdaptedText = text;
                generatePreview(type);
            };

            emailBtn.onclick = async () => {
                try {
                    emailBtn.disabled = true;
                    emailBtn.innerHTML = '<span>Enviando...</span>';
                    await api.sendDocumentEmail(documentId);
                    showToast('Email enviado com sucesso para o aluno!', 'success');
                    emailBtn.innerHTML = '<span>Enviado!</span>';
                } catch (err) {
                    showError(err.message);
                    emailBtn.innerHTML = '<span>Erro</span>';
                } finally {
                    setTimeout(() => {
                        emailBtn.disabled = false;
                        if (emailBtn.innerHTML.includes('Erro') || emailBtn.innerHTML.includes('Enviado')) {
                            emailBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor" style="margin-right:4px"><path d="M0 0h24v24H0z" fill="none"/><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg><span>Email</span>`;
                        }
                    }, 3000);
                }
            };

            downloadBtn.onclick = () => {
                const person = isBraille ? 'braille' : 'alta-legibilidade';
                // Re-use existing download logic
                // We need to set globals or pass explicitly. 
                // generateAndDownloadDocx uses 'brailleAdaptedText' or 'highLegibilityAdaptedText' OR accepts text.
                // We will update the global trigger logic or call generate directly

                triggerDownload(text, person, downloadBtn, title);
            };
        }
    };
}


async function handleAdaptation(shouldClearResults = true) {
    if (!selectedFileBase64) { showError('Por favor, selecione um arquivo PDF para adaptar.'); return; }

    clearError();

    // Verificação de Autenticação para SaaS
    if (!user) {
        showToast('Por favor, faça login para adaptar documentos.', 'warning');
        showAuthModal('login');
        return;
    }

    if (!studentSelect?.value) {
        showError('Por favor, selecione um Aluno para adaptar.');
        studentSelect?.focus();
        return;
    }

    setLoading(true);
    updateProgress(0);

    // Limpar área de resultados apenas se for uma nova bateria de adaptação (ou clique manual)
    if (shouldClearResults) {
        clearResultsSection();
        brailleAdaptedText = ''; // Legacy globals
        highLegibilityAdaptedText = '';
    }

    try {
        // 0. Verificar status da assinatura
        const billing = await api.getBillingStatus();
        if (billing.status !== 'ACTIVE' && user.email !== 'aragaovictor31@gmail.com') {
            const goToCheckout = confirm('O seu Plano Enterprise não está ativo. Deseja assinar agora por R$ 2.000,00 para continuar?');
            if (goToCheckout) {
                const { url } = await api.createCheckoutSession();
                window.location.href = url;
            }
            return;
        }


        // 1. Upload do documento para o backend

        loadingMainText.textContent = 'Enviando arquivo para o servidor...';
        // Build metadata with relational IDs when available
        const uploadMeta = {
            titulo: tituloInput?.value,
        };
        // Use relational IDs from dropdowns (preferred) or legacy free-text
        if (disciplineSelect?.value) {
            uploadMeta.disciplineId = disciplineSelect.value;
            const disc = academicDisciplines.find(d => d.id === disciplineSelect.value);
            uploadMeta.disciplina = disc?.name || '';
            if (disc?.teacher?.user?.name) uploadMeta.professor = disc.teacher.user.name;
        } else {
            uploadMeta.disciplina = disciplinaInput?.value;
            uploadMeta.professor = professorInput?.value;
        }
        if (classSelect?.value) uploadMeta.classId = classSelect.value;
        if (studentSelect?.value) uploadMeta.studentId = studentSelect.value;

        const uploadResult = await api.uploadDocument(selectedFileObject, uploadMeta);
        currentDocumentId = uploadResult.document.id;
        // console.log('Documento registrado com ID:', currentDocumentId);

        loadingMainText.textContent = 'Adaptando... Por favor, aguarde.';

        // Determinar perfil de adaptação
        const selectedStudent = academicStudents.find(s => s.id === studentSelect.value);

        // Lógica Condicional: 
        // Se aluno prefere braille -> Braille
        // Se aluno prefere ampliada/baixa visão -> Alta Legibilidade
        // Se ambos ou nenhum -> Priorizar Alta Legibilidade (mais comum) ou fazer ambos? 
        // O usuário pediu eficiência. Vamos fazer ESTRITAMENTE o que o aluno precisa.

        let targetModes = [];
        if (selectedStudent) {
            if (selectedStudent.prefersBraille) targetModes.push('braille');
            // Se prefere ampliada, audio (geralmente alta legibilidade base), dislexia, etc.
            if (selectedStudent.prefersLargePrint || selectedStudent.accessibilityTypes.includes('LOW_VISION') || selectedStudent.accessibilityTypes.includes('DYSLEXIA')) {
                if (!targetModes.includes('high-legibility')) {
                    targetModes.push('high-legibility');
                }
            }
            // NOVO: TEA / Autismo
            if (selectedStudent.accessibilityTypes.includes('AUTISM') || selectedStudent.accessibilityTypes.includes('TEA')) {
                targetModes.push('autism');
            }
            
            // Fallback se nada marcado mas aluno selecionado: Alta Legibilidade (seguro)
            if (targetModes.length === 0) targetModes.push('high-legibility');
        } else {
            // Genérico -> Alta Legibilidade (padrão)
            targetModes.push('high-legibility');
        }

        // Criar cards para os modos selecionados
        const cards = {};
        targetModes.forEach(mode => {
            cards[mode] = createResultCard(originalFileName, mode, currentDocumentId, 'waiting');
        });

        // Garantir visibilidade da area de resultados
        const resultsSection = document.querySelector('.results-section');
        if (resultsSection) resultsSection.style.display = 'flex';


        const processStream = async (prompt, resultCardObj, isBraille, type) => {
            const currentType = type || (isBraille ? 'braille' : 'high-legibility');

            if (brailleProgress) brailleProgress.textContent = ''; // Limpar legacy
            if (highLegibilityProgress) highLegibilityProgress.textContent = '';

            if (resultCardObj && resultCardObj.id) {
                moveCardToColumn(resultCardObj.id, 'processing');
            }

            const streamBody = await callUniversalAI({
                prompt,
                fileData: selectedFileBase64,
                type: currentType,
                customInstructions: isBraille ? brailleCustomInstructionsInput?.value : highLegibilityCustomInstructionsInput?.value
            });

            const reader = streamBody.getReader();
            const decoder = new TextDecoder();
            let accumulatedText = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                if (chunk) {
                    accumulatedText += chunk;
                    if (resultCardObj) resultCardObj.setText(accumulatedText);

                    // Manter compatibilidade com globais (para preview/download legado)
                    if (isBraille) brailleAdaptedText = accumulatedText;
                    else highLegibilityAdaptedText = accumulatedText;
                }
            }

            if (resultCardObj) resultCardObj.enableButtons(accumulatedText);
            
            if (resultCardObj && resultCardObj.id) {
                moveCardToColumn(resultCardObj.id, 'done');
            }
        };


        if (targetModes.includes('braille')) {
            await processStream(getBraillePrompt(brailleCustomInstructionsInput?.value), cards['braille'], true);
        }

        if (targetModes.includes('high-legibility')) {
            await processStream(getAltaLegibilidadePrompt(highLegibilityCustomInstructionsInput?.value), cards['high-legibility'], false);
        }

        if (targetModes.includes('autism')) {
            // Reaproveita as instruções de alta legibilidade ou cria um novo se houver
            await processStream("Simplifique para TEA", cards['autism'], false, 'autism'); 
        }

        // Atualizar status final
        updateProgress(100);
        enableResults(); // (Legacy function, maybe not needed for dynamic cards but keeps other UI state consistent)
        showToast('Adaptação concluída com sucesso!', 'success');

        saveSettings();
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        showError(`Erro na adaptação: ${errorMessage}`);
    } finally {
        setLoading(false);
    }
}

// ============================================================================
// BATCH ADAPTATION: Process multiple files sequentially
// ============================================================================
async function handleBatchAdaptation() {
    if (batchFiles.length === 0) return;

    if (!user) { showToast('Por favor, faça login para adaptar documentos.', 'warning'); showAuthModal('login'); return; }

    // Limpar resultados anteriores antes de começar o lote
    clearResultsSection();
    brailleAdaptedText = '';
    highLegibilityAdaptedText = '';

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < batchFiles.length; i++) {
        const bf = batchFiles[i];
        bf.status = 'processing';
        renderBatchList();

        if (fileNameDisplay) fileNameDisplay.textContent = `Processando ${i + 1} de ${batchFiles.length}: ${bf.file.name}`;

        try {
            // Load this file
            await new Promise((resolve, reject) => {
                const file = bf.file;
                const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
                if (!isPdf) { reject(new Error('Apenas PDFs são suportados no lote')); return; }
                if (file.size > 10 * 1024 * 1024) { reject(new Error('Arquivo maior que 10MB')); return; }

                selectedFileObject = file;
                originalFileName = file.name;
                if (tituloInput) tituloInput.value = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;

                const reader = new FileReader();
                reader.onloadend = () => {
                    selectedFileBase64 = {
                        mimeType: 'application/pdf',
                        data: reader.result.substring(reader.result.indexOf(',') + 1),
                        extractedText: null
                    };
                    resolve();
                };
                reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
                reader.readAsDataURL(file);
            });

            // Run adaptation - FALSE indicates DO NOT clear previous results (accumulate cards)
            await handleAdaptation(false);
            bf.status = 'done';
            successCount++;
        } catch (err) {
            bf.status = 'error';
            bf.error = err.message || 'Erro desconhecido';
            errorCount++;
        }
        renderBatchList();
    }

    showToast(`Lote concluído: ${successCount} sucesso, ${errorCount} erro(s)`, errorCount > 0 ? 'warning' : 'success');
    if (fileNameDisplay) fileNameDisplay.textContent = `Lote concluído: ${successCount}/${batchFiles.length} adaptados`;
}

function setLoading(isLoading) {
    const btns = [adaptButton, brailleDownloadBtn, highLegibilityDownloadBtn, braillePreviewBtn, highLegibilityPreviewBtn, brailleTtsBtn, highLegibilityTtsBtn, brailleMp3Btn, highLegibilityMp3Btn, brailleCopyBtn, highLegibilityCopyBtn];
    if (isLoading) {
        loadingIndicator.style.display = 'flex';
        loadingMainText.textContent = 'Adaptando... Por favor, aguarde.';
        btns.forEach(btn => { if (btn) btn.disabled = true; });
    } else {
        loadingIndicator.style.display = 'none';
        if (adaptButton) adaptButton.disabled = false;
        const hasBraille = !!brailleAdaptedText, hasHighLegibility = !!highLegibilityAdaptedText;
        if (brailleDownloadBtn) brailleDownloadBtn.disabled = !hasBraille;
        if (braillePreviewBtn) braillePreviewBtn.disabled = !hasBraille;
        if (brailleTtsBtn) brailleTtsBtn.disabled = !hasBraille;
        if (brailleMp3Btn) brailleMp3Btn.disabled = !hasBraille;
        if (brailleCopyBtn) brailleCopyBtn.disabled = !hasBraille;

        if (highLegibilityDownloadBtn) highLegibilityDownloadBtn.disabled = !hasHighLegibility;

        if (highLegibilityPreviewBtn) highLegibilityPreviewBtn.disabled = !hasHighLegibility;
        if (highLegibilityTtsBtn) highLegibilityTtsBtn.disabled = !hasHighLegibility;
        if (highLegibilityMp3Btn) highLegibilityMp3Btn.disabled = !hasHighLegibility;
        if (highLegibilityCopyBtn) highLegibilityCopyBtn.disabled = !hasHighLegibility;
    }
}

function enableResults() { if (brailleOutput) brailleOutput.readOnly = false; if (highLegibilityOutput) highLegibilityOutput.readOnly = false; }

// Batch file list UI
function renderBatchList() {
    if (!batchFileList) return;
    if (batchFiles.length <= 1) {
        batchFileList.style.display = 'none';
        return;
    }
    batchFileList.style.display = 'block';
    batchFileList.innerHTML = batchFiles.map((bf, i) => {
        const statusIcons = { pending: '<i data-lucide="clock" style="width: 16px; height: 16px;"></i>', processing: '<i data-lucide="loader" style="width: 16px; height: 16px;"></i>', done: '<i data-lucide="check-circle-2" style="width: 16px; height: 16px;"></i>', error: '<i data-lucide="alert-circle" style="width: 16px; height: 16px;"></i>' };
        const statusLabels = { pending: 'Aguardando', processing: 'Processando...', done: 'Concluído', error: bf.error || 'Erro' };
        const bgColors = { pending: '#f8f9fa', processing: '#fff8e1', done: '#e8f5e9', error: '#ffebee' };
        return `<div style="display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0.75rem; margin-bottom: 0.25rem; border-radius: 8px; background: ${bgColors[bf.status]}; font-size: 0.9rem;">
            <span style="display: flex; align-items: center; gap: 0.5rem;">${statusIcons[bf.status]} ${bf.file.name}</span>
            <span style="font-size: 0.8rem; color: #666;">${statusLabels[bf.status]}</span>
        </div>`;
    }).join('');
    
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

if (pdfUpload) pdfUpload.addEventListener('change', e => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (files.length === 1) {
        batchFiles = [];
        handleFile(files[0]);
    } else {
        // Batch mode: load first file and queue all
        batchFiles = files.map(f => ({ file: f, status: 'pending' }));
        handleFile(files[0]);
        if (fileNameDisplay) fileNameDisplay.textContent = `${files.length} arquivos selecionados (lote)`;
        renderBatchList();
    }
});
if (inputSection) {
    inputSection.addEventListener('dragover', e => { e.preventDefault(); inputSection.classList.add('drag-over'); });
    inputSection.addEventListener('dragleave', e => { e.preventDefault(); inputSection.classList.remove('drag-over'); });
    inputSection.addEventListener('drop', e => {
        e.preventDefault();
        inputSection.classList.remove('drag-over');
        const files = Array.from(e.dataTransfer?.files || []);
        if (files.length === 0) return;
        if (pdfUpload) pdfUpload.files = e.dataTransfer.files;
        if (files.length === 1) {
            batchFiles = [];
            handleFile(files[0]);
        } else {
            batchFiles = files.map(f => ({ file: f, status: 'pending' }));
            handleFile(files[0]);
            if (fileNameDisplay) fileNameDisplay.textContent = `${files.length} arquivos selecionados (lote)`;
            renderBatchList();
        }
    });
}
if (adaptButton) adaptButton.addEventListener('click', async () => {
    // Batch mode: process all files sequentially
    if (batchFiles.length > 1) {
        await handleBatchAdaptation();
    } else {
        handleAdaptation();
    }
});

// Real-time API provider detection (Hotfix 4.2: checks for null)
if (typeof apiKeyInput !== 'undefined' && apiKeyInput) {
    apiKeyInput.addEventListener('input', (e) => {
        const apiKey = e.target.value.trim();

        if (!apiKey) {
            if (apiKeyHint) apiKeyHint.textContent = '';
            detectedProvider = null;
            isAutoConfigured = false;
            return;
        }

        const provider = detectProvider(apiKey);

        if (provider) {
            detectedProvider = provider;
            isAutoConfigured = true;

            // Auto-configure fields
            if (typeof baseUrlInput !== 'undefined' && baseUrlInput) baseUrlInput.value = provider.baseUrl;
            if (typeof modelNameInput !== 'undefined' && modelNameInput) modelNameInput.value = provider.defaultModel;

            // Show success hint
            if (apiKeyHint) {
                apiKeyHint.className = 'success';
                apiKeyHint.textContent = `✓ ${provider.name} detectado! Modelo: ${provider.defaultModel}`;
            }

            // Keep fields hidden since auto-configuration worked
            if (typeof baseUrlField !== 'undefined') hideField(baseUrlField);
            if (typeof modelNameField !== 'undefined') hideField(modelNameField);
        } else {
            detectedProvider = null;
            isAutoConfigured = false;

            // Show warning hint
            if (apiKeyHint) {
                apiKeyHint.className = 'warning';
                apiKeyHint.textContent = '⚠ Provedor não detectado. Você precisará configurar manualmente.';
            }
        }
    });
}

function triggerDownload(text, person, btn, fileNameOverride = null) {
    if (!text) return;
    const metadata = { disciplina: disciplinaInput?.value.trim() || 'Não informado', professor: professorInput?.value.trim() || 'Não informado', data: dataInput?.value ? new Date(dataInput.value).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Não informada', titulo: tituloInput?.value.trim() || 'Não informado' };
    const headerConfig = {
        title: headerTitleInput?.value.trim() || null,
        legalText: headerLegalInput?.value.trim() || null,
        extraInfo: headerExtraInput?.value.trim() || null,
    };
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<div class="btn-spinner"></div><span>Gerando...</span>`;

    // Registrar download para compliance
    if (currentDocumentId) {
        api.markDownload(currentDocumentId, person === 'braille' ? 'braille' : 'high_legibility').catch(console.error);
    }

    const finalFileName = fileNameOverride || originalFileName;

    generateAndDownloadDocx({ text, person, metadata, fontSize: fontSizeInput ? parseInt(fontSizeInput.value, 10) : 20, isDyslexia: isDyslexiaMode, originalFileName: finalFileName, fileObject: selectedFileObject, headerConfig, onSuccess: () => { btn.disabled = false; btn.innerHTML = originalText; showToast('Download iniciado!', 'success'); }, onError: (msg) => { btn.disabled = false; btn.innerHTML = originalText; showError(msg); } });
}

if (brailleDownloadBtn) brailleDownloadBtn.addEventListener('click', () => triggerDownload(brailleAdaptedText, 'braille', brailleDownloadBtn));
if (highLegibilityDownloadBtn) highLegibilityDownloadBtn.addEventListener('click', () => triggerDownload(highLegibilityAdaptedText, 'alta-legibilidade', highLegibilityDownloadBtn));





async function generatePreview(person) {
    if (!modalContent || !modalTitle) return;
    openModal();
    modalContent.innerHTML = `<div class="loading-indicator" style="justify-content: center; padding: 2rem;"><div class="spinner"></div><span>Gerando visualização...</span></div>`;
    modalTitle.textContent = `Visualização: ${person === 'braille' ? 'Versão para Braille' : 'Versão para Alta Legibilidade'}`;
    const customFontSize = fontSizeInput ? parseInt(fontSizeInput.value, 10) : 20;
    if (previewModalControls) previewModalControls.style.display = 'flex';
    if (previewFontSizeInput) previewFontSizeInput.value = customFontSize;
    if (modalContent) { modalContent.className = 'modal-content'; modalContent.style.fontSize = `${customFontSize}pt`; if (isDyslexiaMode) document.body.classList.add('dyslexia-mode'); }

    const text = person === 'braille' ? brailleAdaptedText : highLegibilityAdaptedText;
    if (person === 'braille') {
        const fragment = document.createDocumentFragment();
        text.split('\n').filter(p => p.trim() !== '').forEach(p => { const isBold = p.startsWith('**') && p.endsWith('**'); const cleanText = p.replace(/\*\*/g, ''); const pElement = document.createElement('p'); pElement.textContent = cleanText; if (isBold) pElement.style.fontWeight = 'bold'; fragment.appendChild(pElement); });
        modalContent.innerHTML = '';
        modalContent.appendChild(fragment);
    } else {
        try {
            if (!selectedFileObject) throw new Error("PDF original não encontrado.");
            const pdf = await getPdfDocument(await selectedFileObject.arrayBuffer());
            const parts = text.split(/\[IMAGEM_PAGINA_(\d+)\]/g);
            const fragment = document.createDocumentFragment();
            for (let i = 0; i < parts.length; i++) {
                if (i % 2 === 0) { parts[i].split('\n').filter(p => p.trim() !== '').forEach(p => { const isBold = p.startsWith('**') && p.endsWith('**'); const pEl = document.createElement('p'); pEl.textContent = isBold ? p.slice(2, -2) : p; if (isBold) pEl.style.fontWeight = 'bold'; fragment.appendChild(pEl); }); }
                else { const pageNum = parseInt(parts[i], 10); if (!isNaN(pageNum)) { try { const page = await pdf.getPage(pageNum); const imageUrls = await extractImagesFromPage(page, true); if (imageUrls.length > 0) { imageUrls.forEach(url => { const img = document.createElement('img'); img.src = url; img.className = 'preview-image'; fragment.appendChild(img); }); } } catch (e) { console.error(e); } } }
            }
            modalContent.innerHTML = '';
            modalContent.appendChild(fragment);
        } catch (e) { modalContent.innerHTML = `<p>Erro: ${e.message}</p>`; }
    }
}

function openModal() { if (previewModal) previewModal.style.display = 'flex'; }
function closeModal() { if (previewModal) previewModal.style.display = 'none'; if (modalContent) modalContent.innerHTML = ''; const modalContainer = document.querySelector('.modal-container'); if (modalContainer) modalContainer.classList.remove('fullscreen'); isSplitViewActive = false; if (pdfPreviewContainer) pdfPreviewContainer.style.display = 'none'; }

if (braillePreviewBtn) braillePreviewBtn.addEventListener('click', () => generatePreview('braille'));
if (highLegibilityPreviewBtn) highLegibilityPreviewBtn.addEventListener('click', () => generatePreview('alta-legibilidade'));
if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
if (modalCloseFooterBtn) modalCloseFooterBtn.addEventListener('click', closeModal);
if (fontIncreaseBtn) fontIncreaseBtn.addEventListener('click', () => { const val = parseInt(previewFontSizeInput.value, 10) + 2; previewFontSizeInput.value = val; modalContent.style.fontSize = `${val}pt`; });
if (fontDecreaseBtn) fontDecreaseBtn.addEventListener('click', () => { const val = Math.max(10, parseInt(previewFontSizeInput.value, 10) - 2); previewFontSizeInput.value = val; modalContent.style.fontSize = `${val}pt`; });
if (removeBoldBtn) removeBoldBtn.addEventListener('click', () => { modalContent.querySelectorAll('p').forEach(p => p.style.fontWeight = 'normal'); });
if (toggleDyslexiaBtn) toggleDyslexiaBtn.addEventListener('click', () => { isDyslexiaMode = !isDyslexiaMode; document.body.classList.toggle('dyslexia-mode', isDyslexiaMode); });

async function renderPage(num) {
    if (!pdfDoc) return;
    pageRendering = true;
    try {
        const page = await pdfDoc.getPage(num);
        // Ajustar escala para a largura do contêiner, descontando o padding (32px)
        const viewport = page.getViewport({ scale: 1 });
        const containerWidth = pdfPreviewContainer.clientWidth - 32;
        const scale = containerWidth / viewport.width;

        const scaledViewport = page.getViewport({ scale });
        pdfRenderCanvas.height = scaledViewport.height;
        pdfRenderCanvas.width = scaledViewport.width;

        const renderContext = {
            canvasContext: pdfRenderCanvas.getContext('2d'),
            viewport: scaledViewport
        };

        await page.render(renderContext).promise;
        pageRendering = false;

        if (pageNumPending !== null) {
            renderPage(pageNumPending);
            pageNumPending = null;
        }

        pageNumDisplay.textContent = `Página ${num} de ${pdfDoc.numPages}`;
        prevPageBtn.disabled = num <= 1;
        nextPageBtn.disabled = num >= pdfDoc.numPages;
    } catch (e) {
        console.error('Erro ao renderizar página:', e);
        pageRendering = false;
    }
}

// Re-renderizar PDF ao redimensionar a janela se o Split View estiver ativo
window.addEventListener('resize', () => {
    if (isSplitViewActive && pdfDoc) {
        renderPage(currentPdfPage);
    }
});

if (toggleSplitViewBtn) toggleSplitViewBtn.addEventListener('click', async () => {
    isSplitViewActive = !isSplitViewActive;
    const modalContainer = document.querySelector('.modal-container');
    const modalContentContainer = document.getElementById('modal-content-container');

    if (isSplitViewActive) {
        if (!selectedFileObject) { isSplitViewActive = false; return; }
        if (modalContainer) modalContainer.classList.add('fullscreen');
        if (modalContentContainer) modalContentContainer.classList.add('split-view-active');

        pdfPreviewContainer.style.display = 'flex';

        if (!pdfDoc && selectedFileObject) {
            try {
                pdfDoc = await getPdfDocument(await selectedFileObject.arrayBuffer());
            } catch (e) {
                console.error("Erro ao carregar PDF para preview:", e);
            }
        }

        if (pdfDoc) {
            setTimeout(() => renderPage(currentPdfPage), 100);
        }
    } else {
        if (modalContainer) modalContainer.classList.remove('fullscreen');
        if (modalContentContainer) modalContentContainer.classList.remove('split-view-active');
        pdfPreviewContainer.style.display = 'none';
    }
});

if (prevPageBtn) prevPageBtn.addEventListener('click', () => { if (currentPdfPage > 1) { currentPdfPage--; renderPage(currentPdfPage); } });
if (nextPageBtn) nextPageBtn.addEventListener('click', () => { if (pdfDoc && currentPdfPage < pdfDoc.numPages) { currentPdfPage++; renderPage(currentPdfPage); } });

function updateTTSBtns() {
    const isSpeaking = getIsSpeaking();
    const icon = isSpeaking ? '<svg height="24" viewBox="0 0 24 24" width="24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg><span>Parar</span>' : '<svg height="24" viewBox="0 0 24 24" width="24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg><span>Ouvir</span>';
    if (brailleTtsBtn) brailleTtsBtn.innerHTML = icon;
    if (highLegibilityTtsBtn) highLegibilityTtsBtn.innerHTML = icon;
}

if (brailleTtsBtn) brailleTtsBtn.addEventListener('click', () => { speakText(brailleAdaptedText, updateTTSBtns, updateTTSBtns); updateTTSBtns(); });
if (highLegibilityTtsBtn) highLegibilityTtsBtn.addEventListener('click', () => { speakText(highLegibilityAdaptedText, updateTTSBtns, updateTTSBtns); updateTTSBtns(); });

async function copyText(text, btn) {
    if (!text) return;
    try { await navigator.clipboard.writeText(text); const orig = btn.innerHTML; btn.innerHTML = '<span>Copiado!</span>'; showToast('Copiado com sucesso!', 'success'); setTimeout(() => { btn.innerHTML = orig; }, 2000); } catch (e) { showError('Falha ao copiar.'); }
}
if (brailleCopyBtn) brailleCopyBtn.addEventListener('click', () => copyText(brailleAdaptedText, brailleCopyBtn));
if (highLegibilityCopyBtn) highLegibilityCopyBtn.addEventListener('click', () => copyText(highLegibilityAdaptedText, highLegibilityCopyBtn));

if (brailleMp3Btn) brailleMp3Btn.addEventListener('click', () => showToast('Download de MP3 em breve!', 'info'));
if (highLegibilityMp3Btn) highLegibilityMp3Btn.addEventListener('click', () => showToast('Download de MP3 em breve!', 'info'));

function saveSettings() {
    localStorage.setItem('ada_settings', JSON.stringify({
        disciplina: disciplinaInput?.value,
        professor: professorInput?.value,
        braille: brailleCustomInstructionsInput?.value,
        highLegibility: highLegibilityCustomInstructionsInput?.value,
        fontSize: fontSizeInput?.value,
        headerTitle: headerTitleInput?.value,
        headerLegal: headerLegalInput?.value,
        headerExtra: headerExtraInput?.value
    }));
}
function loadSettings() {
    try {
        const s = JSON.parse(localStorage.getItem('ada_settings') || '{}');
        if (disciplinaInput) disciplinaInput.value = s.disciplina || '';
        if (professorInput) professorInput.value = s.professor || '';
        if (brailleCustomInstructionsInput) brailleCustomInstructionsInput.value = s.braille || '';
        if (highLegibilityCustomInstructionsInput) highLegibilityCustomInstructionsInput.value = s.highLegibility || '';
        if (fontSizeInput) fontSizeInput.value = s.fontSize || '20';

        // Carregar configurações do cabeçalho
        if (headerTitleInput) headerTitleInput.value = s.headerTitle || '';
        if (headerLegalInput) headerLegalInput.value = s.headerLegal || '';
        if (headerExtraInput) headerExtraInput.value = s.headerExtra || '';

    } catch (e) { /* ignore error loading settings */ }
}

[disciplinaInput, professorInput, brailleCustomInstructionsInput, highLegibilityCustomInstructionsInput, fontSizeInput, headerTitleInput, headerLegalInput, headerExtraInput].forEach(i => { if (i) { i.addEventListener('input', saveSettings); i.addEventListener('change', saveSettings); } });
document.addEventListener('DOMContentLoaded', loadSettings);
if (brailleOutput) brailleOutput.addEventListener('input', e => { brailleAdaptedText = e.target.value; setLoading(false); });
if (highLegibilityOutput) highLegibilityOutput.addEventListener('input', e => { highLegibilityAdaptedText = e.target.value; setLoading(false); });
window.addEventListener('unhandledrejection', e => console.error('Unhandled rejection:', e.reason));

// Auth Modal Navigation
if (goToRegister) goToRegister.addEventListener('click', (e) => { e.preventDefault(); showAuthModal('register'); });
if (goToLogin) goToLogin.addEventListener('click', (e) => { e.preventDefault(); showAuthModal('login'); });

// Form Submissions
if (loginForm) loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const data = await api.login(email, password);
        user = data.user;
        localStorage.setItem('user', JSON.stringify(user));
        updateUserNav();
        loadAcademicData(); // Load academic dropdowns after login
        showToast('Bem-vindo de volta!');
    } catch (err) {
        showToast(err.message, 'error');
    }
});

if (registerForm) registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const organizationName = document.getElementById('register-org').value;
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;

    try {
        const data = await api.register(name, email, password, organizationName);
        user = data.user;
        updateUserNav();
        showToast('Conta criada com sucesso!');
    } catch (err) {
        showToast(err.message, 'error');
    }
});

// Compliance Dashboard Logic
function showSection(sectionId) {
    const appTitle = document.getElementById('current-page-title');
    const appDesc = document.querySelector('.page-header p');
    const studioSection = document.getElementById('studio-section');
    const navStudioBtn = document.getElementById('nav-studio-btn');
    const adapterSection = document.getElementById('adapter-section');
    const complianceSection = document.getElementById('compliance-section');
    const navAdapterBtn = document.getElementById('nav-adapter-btn');
    const navReportsBtn = document.getElementById('nav-reports-btn');

    // Reset visibility
    if (adapterSection) adapterSection.style.display = 'none';
    if (complianceSection) complianceSection.style.display = 'none';
    if (studioSection) studioSection.style.display = 'none';

    // Reset active nav style (Sidebar uses 'active' class, not btn-primary/btn-secondary)
    [navAdapterBtn, navReportsBtn, navStudioBtn].forEach(btn => {
        if (btn) btn.classList.remove('active');
    });

    if (sectionId === 'adapter') {
        if (adapterSection) adapterSection.style.display = 'block';
        if (navAdapterBtn) navAdapterBtn.classList.add('active');
        if (appTitle) appTitle.textContent = 'Mesa de Triagem';
        if (appDesc) appDesc.textContent = 'Processe e acompanhe as adaptações de documentos.';
    } else if (sectionId === 'studio') {
        if (studioSection) studioSection.style.display = 'block';
        if (navStudioBtn) navStudioBtn.classList.add('active');
        if (appTitle) appTitle.textContent = 'Base de Conhecimento';
        if (appDesc) appDesc.textContent = 'Gere resumos, áudios e artefatos derivados na base.';
    } else if (sectionId === 'reports') {
        if (complianceSection) complianceSection.style.display = 'block';
        if (navReportsBtn) navReportsBtn.classList.add('active');
        if (appTitle) appTitle.textContent = 'Cobertura & Compliance';
        if (appDesc) appDesc.textContent = 'Acompanhamento de materiais adaptados para MEC e SEDUC.';
        loadStats();
    }
}

async function loadStats() {
    try {
        const stats = await api.getReportStats(periodSelect.value);
        if (statTotal) statTotal.textContent = stats.total;
        if (statBraille) statBraille.textContent = stats.byType.braille;
        if (statHighLegibility) statHighLegibility.textContent = stats.byType.highLegibility;
        if (statGrowth) {
            statGrowth.textContent = `${stats.growth >= 0 ? '+' : ''}${stats.growth}%`;
            statGrowth.style.color = stats.growth >= 0 ? '#00b894' : '#d63031';
        }
    } catch (err) {
        console.error('Erro ao carregar estatísticas:', err);
    }
}

if (navAdapterBtn) navAdapterBtn.addEventListener('click', () => showSection('adapter'));
if (navReportsBtn) navReportsBtn.addEventListener('click', () => showSection('reports'));
if (periodSelect) periodSelect.addEventListener('change', loadStats);
if (exportReportBtn) exportReportBtn.addEventListener('click', () => {
    showToast('Gerando relatório...');
    api.downloadReport().catch(err => showError(err.message));
});

// ============================================================================
// ACADEMIC CONTEXT: Cascading Dropdowns + Auto-Adaptation (P0 Features)
// ============================================================================

async function loadAcademicData() {
    if (!user) return;
    try {
        // Load disciplines
        const discData = await api.listDisciplines(1, 100);
        academicDisciplines = discData.disciplines || [];
        if (disciplineSelect) {
            disciplineSelect.innerHTML = '<option value="">Selecione uma disciplina...</option>';
            academicDisciplines.forEach(d => {
                const teacherName = d.teacher?.user?.name ? ` (Prof. ${d.teacher.user.name})` : '';
                disciplineSelect.innerHTML += `<option value="${d.id}">${d.name} ${d.code ? '(' + d.code + ')' : ''}${teacherName}</option>`;
            });
        }

        // Load students
        const pcdData = await api.listAllStudents();
        academicStudents = pcdData.students || [];
        if (studentSelect) {
            studentSelect.innerHTML = '<option value="" disabled selected>Selecione um aluno...</option>';
            academicStudents.forEach(s => {
                const types = (s.accessibilityTypes || []).join(', ');
                studentSelect.innerHTML += `<option value="${s.id}" data-prefers-braille="${s.prefersBraille}" data-prefers-large="${s.prefersLargePrint}" data-prefers-audio="${s.prefersAudio}">${s.name} ${s.registration ? '(' + s.registration + ')' : ''} — ${types || 'Acessibilidade definida'}</option>`;
            });
        }
    } catch (err) {
        console.warn('Dados acadêmicos não disponíveis:', err.message);
    }
}

// Cascade: Discipline → load Classes for that discipline
if (disciplineSelect) {
    disciplineSelect.addEventListener('change', async () => {
        const discId = disciplineSelect.value;
        if (classSelect) {
            classSelect.innerHTML = '<option value="">Carregando turmas...</option>';
            classSelect.disabled = true;
        }

        if (!discId) {
            if (classSelect) {
                classSelect.innerHTML = '<option value="">Selecione a disciplina primeiro...</option>';
                classSelect.disabled = true;
            }
            return;
        }

        try {
            const classData = await api.listClasses(discId, 1, 100);
            academicClasses = classData.classes || [];
            if (classSelect) {
                classSelect.innerHTML = '<option value="">Selecione a turma (opcional)...</option>';
                academicClasses.forEach(c => {
                    const shiftLabel = { MORNING: 'Manhã', AFTERNOON: 'Tarde', NIGHT: 'Noite' }[c.shift] || c.shift;
                    classSelect.innerHTML += `<option value="${c.id}">${c.name} — ${shiftLabel} (${c.year}/${c.semester})</option>`;
                });
                classSelect.disabled = false;
            }
        } catch (err) {
            console.warn('Erro ao carregar turmas:', err.message);
            if (classSelect) {
                classSelect.innerHTML = '<option value="">Erro ao carregar turmas</option>';
                classSelect.disabled = true;
            }
        }
    });
}

// Auto-Adaptation: When PCD student is selected, auto-configure preferences
if (studentSelect) {
    studentSelect.addEventListener('change', () => {
        const studentId = studentSelect.value;
        if (!studentId) {
            selectedStudentProfile = null;
            if (studentAutoBadge) studentAutoBadge.style.display = 'none';
            return;
        }

        const student = academicStudents.find(s => s.id === studentId);
        if (!student) return;

        selectedStudentProfile = student;

        // Auto-configure font size from student preferences
        const fontSizeInput = document.getElementById('font-size-input');
        if (student.prefersLargePrint && fontSizeInput) {
            fontSizeInput.value = '24'; // Larger font for low-vision students
        }

        // Build badge text
        const prefs = [];
        if (student.prefersBraille) prefs.push('Braille');
        if (student.prefersLargePrint) prefs.push('Fonte Ampliada');
        if (student.prefersAudio) prefs.push('Áudio');

        const accessTypes = (student.accessibilityTypes || []).map(t => {
            const labels = {
                'BLIND': 'Cego', 'LOW_VISION': 'Baixa Visão', 'DYSLEXIA': 'Dislexia',
                'DEAF': 'Surdo', 'MOTOR': 'Motora', 'COGNITIVE': 'Cognitiva', 'OTHER': 'Outra'
            };
            return labels[t] || t;
        });

        if (studentAutoBadge && studentBadgeText) {
            studentBadgeText.textContent = `Adaptação personalizada para ${student.name} — ${accessTypes.join(', ')} | Preferências: ${prefs.join(', ') || 'Padrão'}`;
            studentAutoBadge.style.display = 'flex';
        }
    });
}

// ============================================================================
// THEME TOGGLE: Dark Mode + High Contrast
// ============================================================================
const themes = ['light', 'dark', 'high-contrast'];
const themeLabels = { 'light': 'Claro', 'dark': 'Escuro', 'high-contrast': 'Alto Contraste' };

function setTheme(theme) {
    // Always set the attribute to override system preference
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ada_theme', theme);
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) btn.innerHTML = `<i data-lucide="moon"></i> Tema ${themeLabels[theme] || ''}`;
    if (window.lucide) window.lucide.createIcons();
}

function loadTheme() {
    const saved = localStorage.getItem('ada_theme');
    if (saved && themes.includes(saved)) {
        setTheme(saved);
    }
    // If no saved preference, CSS handles prefers-color-scheme automatically
}

function cycleTheme() {
    const current = localStorage.getItem('ada_theme') || 'light';
    const idx = themes.indexOf(current);
    const next = themes[(idx + 1) % themes.length];
    setTheme(next);
}

const themeToggleBtn = document.getElementById('theme-toggle-btn');
if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', cycleTheme);
}
loadTheme();

// ============================================================================
// TUTORIAL ENGINE: Section-based Help System
// ============================================================================
const tutorialSections = [
    {
        id: 'upload',
        title: 'Upload de Arquivo',
        steps: [
            { target: '.input-section', title: 'Área de Upload', text: 'Arraste um PDF aqui ou clique para selecionar. Você pode selecionar múltiplos arquivos para upload em lote.' },
            { target: '.file-upload-label', title: 'Botão de Upload', text: 'Clique aqui para abrir o seletor de arquivos do seu computador.' },
        ]
    },
    {
        id: 'config',
        title: 'Configuração da API',
        steps: [
            { target: '#api-config-container', title: 'Chave da API', text: 'Cole sua chave de API aqui. O sistema detecta automaticamente o provedor (OpenAI, Gemini, etc.).' },
        ]
    },
    {
        id: 'metadata',
        title: 'Dados do Documento',
        steps: [
            { target: '.metadata-section', title: 'Informações do Documento', text: 'Preencha os dados do documento: disciplina, turma, aluno PCD. Estes dados são usados para relatórios de cobertura.' },
        ]
    },
    {
        id: 'results',
        title: 'Resultados',
        steps: [
            { target: '.results-section', title: 'Resultados da Adaptação', text: 'Após adaptar, os resultados aparecem aqui em duas versões: Braille e Alta Legibilidade.' },
        ]
    },
];

let currentTour = null;
let currentStepIndex = 0;

function openTutorialMenu() {
    // Remove existing menu
    closeTutorialMenu();

    const overlay = document.createElement('div');
    overlay.id = 'tutorial-menu-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9998;display:flex;justify-content:center;align-items:center;';

    const menu = document.createElement('div');
    menu.style.cssText = `background:var(--card-background);border-radius:12px;padding:2rem;max-width:400px;width:90%;box-shadow:0 10px 30px rgba(0,0,0,0.3);color:var(--text-color);`;

    menu.innerHTML = `
        <h2 style="margin:0 0 0.5rem;font-size:1.3rem;">Central de Ajuda</h2>
        <p style="color:var(--muted-text);font-size:0.9rem;margin-bottom:1.5rem;">Escolha uma seção para ver o tutorial:</p>
        <div id="tutorial-section-list" style="display:flex;flex-direction:column;gap:0.75rem;"></div>
        <button id="tutorial-menu-close" class="btn btn-secondary" style="margin-top:1.5rem;width:100%;padding:0.75rem;cursor:pointer;font-size:0.95rem;">Fechar</button>
    `;

    overlay.appendChild(menu);
    document.body.appendChild(overlay);

    const listContainer = document.getElementById('tutorial-section-list');
    const seenTutorials = JSON.parse(localStorage.getItem('ada_tutorials_seen') || '[]');

    tutorialSections.forEach(section => {
        const seen = seenTutorials.includes(section.id);
        const btn = document.createElement('button');
        btn.style.cssText = `display:flex;justify-content:space-between;align-items:center;padding:0.75rem 1rem;background:var(--card-header-bg);border:1px solid var(--border-color);border-radius:8px;cursor:pointer;font-size:0.95rem;color:var(--text-color);transition:all 0.2s;`;
        btn.innerHTML = `<span>${section.title}</span>${seen ? '<span style="font-size:0.75rem;color:var(--success-color);">✓ Visto</span>' : '<span style="font-size:0.75rem;color:var(--primary-color);">Novo</span>'}`;
        btn.addEventListener('mouseenter', () => { btn.style.borderColor = 'var(--primary-color)'; });
        btn.addEventListener('mouseleave', () => { btn.style.borderColor = 'var(--border-color)'; });
        btn.addEventListener('click', () => {
            closeTutorialMenu();
            startSectionTour(section);
        });
        listContainer.appendChild(btn);
    });

    document.getElementById('tutorial-menu-close').addEventListener('click', closeTutorialMenu);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeTutorialMenu(); });
}

function closeTutorialMenu() {
    document.getElementById('tutorial-menu-overlay')?.remove();
}

function startSectionTour(section) {
    currentTour = section;
    currentStepIndex = 0;
    showTutorialStep();
}

function showTutorialStep() {
    // Cleanup previous tooltip
    document.getElementById('tutorial-tooltip')?.remove();
    document.getElementById('tutorial-overlay-bg')?.remove();
    document.querySelectorAll('.tutorial-highlighted').forEach(el => el.classList.remove('tutorial-highlighted'));

    if (!currentTour || currentStepIndex >= currentTour.steps.length) {
        // Tour complete
        endTour();
        return;
    }

    const step = currentTour.steps[currentStepIndex];
    const targetEl = document.querySelector(step.target);

    if (!targetEl) {
        // Skip step if target not found
        currentStepIndex++;
        showTutorialStep();
        return;
    }

    // Scroll into view
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Highlight element
    targetEl.classList.add('tutorial-highlighted');

    // Create overlay background
    const overlayBg = document.createElement('div');
    overlayBg.id = 'tutorial-overlay-bg';
    overlayBg.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);z-index:9996;';
    document.body.appendChild(overlayBg);

    // Elevate target element
    targetEl.style.position = targetEl.style.position || 'relative';
    targetEl.style.zIndex = '9997';

    // Create tooltip
    setTimeout(() => {
        const rect = targetEl.getBoundingClientRect();
        const tooltip = document.createElement('div');
        tooltip.id = 'tutorial-tooltip';
        tooltip.style.cssText = `
            position:fixed;z-index:9999;background:var(--card-background);border:2px solid var(--primary-color);
            border-radius:12px;padding:1.25rem;max-width:320px;width:90%;
            box-shadow:0 8px 24px rgba(0,0,0,0.2);color:var(--text-color);
            top:${Math.min(rect.bottom + 12, window.innerHeight - 200)}px;
            left:${Math.max(10, Math.min(rect.left, window.innerWidth - 340))}px;
        `;

        const stepCount = `${currentStepIndex + 1}/${currentTour.steps.length}`;
        tooltip.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
                <h4 style="margin:0;font-size:1rem;color:var(--primary-color);">${step.title}</h4>
                <span style="font-size:0.75rem;color:var(--muted-text);">${stepCount}</span>
            </div>
            <p style="margin:0 0 1rem;font-size:0.9rem;line-height:1.5;color:var(--muted-text);">${step.text}</p>
            <div style="display:flex;gap:0.5rem;justify-content:flex-end;">
                ${currentStepIndex > 0 ? '<button id="tutorial-prev" style="padding:0.4rem 1rem;background:var(--card-header-bg);border:1px solid var(--border-color);border-radius:6px;cursor:pointer;font-size:0.85rem;color:var(--text-color);">← Anterior</button>' : ''}
                <button id="tutorial-skip" style="padding:0.4rem 1rem;background:var(--card-header-bg);border:1px solid var(--border-color);border-radius:6px;cursor:pointer;font-size:0.85rem;color:var(--text-color);">Fechar</button>
                <button id="tutorial-next" style="padding:0.4rem 1rem;background:var(--primary-color);border:none;border-radius:6px;cursor:pointer;font-size:0.85rem;color:white;">${currentStepIndex < currentTour.steps.length - 1 ? 'Próximo →' : '✓ Concluir'}</button>
            </div>
        `;

        document.body.appendChild(tooltip);

        document.getElementById('tutorial-next')?.addEventListener('click', () => {
            currentStepIndex++;
            showTutorialStep();
        });

        document.getElementById('tutorial-prev')?.addEventListener('click', () => {
            currentStepIndex--;
            showTutorialStep();
        });

        document.getElementById('tutorial-skip')?.addEventListener('click', endTour);
    }, 400);
}

function endTour() {
    document.getElementById('tutorial-tooltip')?.remove();
    document.getElementById('tutorial-overlay-bg')?.remove();
    document.querySelectorAll('.tutorial-highlighted').forEach(el => {
        el.classList.remove('tutorial-highlighted');
        el.style.zIndex = '';
    });

    if (currentTour) {
        const seen = JSON.parse(localStorage.getItem('ada_tutorials_seen') || '[]');
        if (!seen.includes(currentTour.id)) {
            seen.push(currentTour.id);
            localStorage.setItem('ada_tutorials_seen', JSON.stringify(seen));
        }
        currentTour = null;
    }
}

const tutorialBtn = document.getElementById('tutorial-btn');
if (tutorialBtn) {
    tutorialBtn.addEventListener('click', openTutorialMenu);
}

// First-login welcome toast
function checkFirstLogin() {
    const seen = JSON.parse(localStorage.getItem('ada_tutorials_seen') || '[]');
    if (seen.length === 0 && localStorage.getItem('ada_token')) {
        setTimeout(() => {
            if (typeof showToast !== 'undefined') showToast('Bem-vindo! Clique em "Ajuda" para conhecer as funcionalidades.', 'info');
        }, 2000);
    }
}

// Run Initial Check
checkSession();
checkFirstLogin();

// Sidebar toggle
const sidebarToggleBtn = document.querySelector('.sidebar-toggle-icon');
const sidebar = document.querySelector('.sidebar');
if (sidebarToggleBtn && sidebar) {
    sidebarToggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebar_collapsed', sidebar.classList.contains('collapsed'));
    });
    if (localStorage.getItem('sidebar_collapsed') === 'true') {
        sidebar.classList.add('collapsed');
    }
}
