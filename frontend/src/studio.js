/**
 * STUDIO MODULE — Lógica de UI do Estúdio de Conteúdo Educacional
 * Gerencia modais, geração de artefatos, quiz player, flashcard viewer, e RBAC visual.
 */
import { api } from './services/apiService.js';
import { showToast } from './utils/utils.js';

// ==============================================================================
// STATE
// ==============================================================================
let selectedDocumentId = null;
let currentUser = null;
let pollInterval = null;

// ==============================================================================
// INITIALIZATION
// ==============================================================================
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initStudio, 500); // Aguardar index.js carregar user
});

function initStudio() {
    currentUser = JSON.parse(localStorage.getItem('user') || 'null');

    // Nav switching
    const navStudioBtn = document.getElementById('nav-studio-btn');
    const navAdapterBtn = document.getElementById('nav-adapter-btn');
    const navReportsBtn = document.getElementById('nav-reports-btn');
    const studioSection = document.getElementById('studio-section');
    const adapterSection = document.getElementById('adapter-section');
    const complianceSection = document.getElementById('compliance-section');
    const appTitle = document.querySelector('.app-header h1');
    const appDesc = document.querySelector('.app-header p');

    if (navStudioBtn) {
        navStudioBtn.addEventListener('click', () => {
            adapterSection.style.display = 'none';
            complianceSection.style.display = 'none';
            studioSection.style.display = 'block';

            navAdapterBtn.className = 'btn btn-secondary';
            navReportsBtn.className = 'btn btn-secondary';
            navStudioBtn.className = 'btn btn-primary';

            if (appTitle) appTitle.textContent = '🎨 Estúdio de Conteúdo';
            if (appDesc) appDesc.textContent = 'Gere áudio, slides, infográficos, testes e flashcards com IA a partir dos seus documentos.';

            loadDocumentsForStudio();
            applyRoleVisibility();
        });
    }

    // Retornar ao Adaptador da nav precisa esconder o Estúdio
    if (navAdapterBtn) {
        const origClick = navAdapterBtn.onclick;
        navAdapterBtn.addEventListener('click', () => {
            if (studioSection) studioSection.style.display = 'none';
            navStudioBtn.className = 'btn btn-secondary';
        });
    }
    if (navReportsBtn) {
        navReportsBtn.addEventListener('click', () => {
            if (studioSection) studioSection.style.display = 'none';
            navStudioBtn.className = 'btn btn-secondary';
        });
    }

    // Generate buttons → open modal
    document.querySelectorAll('.studio-generate-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.type;
            if (!selectedDocumentId) {
                showToast('Selecione um documento primeiro.', 'warning');
                return;
            }
            openStudioModal(type);
        });
    });

    // Modal cancel buttons
    document.querySelectorAll('.studio-modal-cancel').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.studio-modal').style.display = 'none';
        });
    });

    // Modal overlay click to close
    document.querySelectorAll('.studio-modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });
    });

    // Modal confirm buttons → submit generation
    document.querySelectorAll('.studio-modal-confirm').forEach(btn => {
        btn.addEventListener('click', () => handleGenerate(btn.dataset.type));
    });

    // Infographic style grid toggle
    const styleGrid = document.getElementById('infographic-style-grid');
    if (styleGrid) {
        styleGrid.addEventListener('click', (e) => {
            const btn = e.target.closest('.studio-style-btn');
            if (!btn) return;
            styleGrid.querySelectorAll('.studio-style-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    }

    // Document selector
    const docSelect = document.getElementById('studio-doc-select');
    if (docSelect) {
        docSelect.addEventListener('change', () => {
            selectedDocumentId = docSelect.value;
            loadArtifacts();
        });
    }
}

// ==============================================================================
// RBAC Visual — Esconde cards baseado no role do user
// ==============================================================================
function applyRoleVisibility() {
    currentUser = JSON.parse(localStorage.getItem('user') || 'null');
    if (!currentUser) return;

    const role = currentUser.role;
    document.querySelectorAll('.studio-card[data-role-required]').forEach(card => {
        const required = card.dataset.roleRequired;
        if (required === 'TEACHER' && role !== 'TEACHER' && role !== 'OWNER' && role !== 'ADMIN') {
            card.style.opacity = '0.4';
            card.style.pointerEvents = 'none';
            card.querySelector('.studio-generate-btn').disabled = true;
        } else if (required === 'STUDENT' && role !== 'STUDENT') {
            card.style.opacity = '0.4';
            card.style.pointerEvents = 'none';
            card.querySelector('.studio-generate-btn').disabled = true;
        } else {
            card.style.opacity = '1';
            card.style.pointerEvents = 'auto';
            card.querySelector('.studio-generate-btn').disabled = false;
        }
    });
}

// ==============================================================================
// LOAD DOCUMENTS (para o seletor)
// ==============================================================================
async function loadDocumentsForStudio() {
    try {
        const data = await api.listDocuments(1);
        const docs = data.documents || [];
        const select = document.getElementById('studio-doc-select');
        if (!select) return;

        select.innerHTML = '<option value="" disabled selected>Selecione um documento já enviado...</option>';
        docs.forEach(doc => {
            const date = new Date(doc.createdAt).toLocaleDateString('pt-BR');
            select.innerHTML += `<option value="${doc.id}">📄 ${doc.originalName} — ${date}</option>`;
        });
    } catch (err) {
        console.error('Erro ao carregar documentos para o estúdio:', err);
    }
}

// ==============================================================================
// OPEN MODAL
// ==============================================================================
function openStudioModal(type) {
    const modal = document.getElementById(`studio-modal-${type}`);
    if (modal) modal.style.display = 'flex';
}

// ==============================================================================
// HANDLE GENERATE — Coleta config do modal e chama API
// ==============================================================================
async function handleGenerate(type) {
    const modal = document.getElementById(`studio-modal-${type}`);

    try {
        let config = {};

        switch (type) {
            case 'audio':
                config = {
                    format: document.getElementById('audio-format').value,
                    duration: getRadioValue('audio-duration'),
                    language: document.getElementById('audio-language').value,
                };
                await api.studioGenerateAudio(selectedDocumentId, config);
                break;

            case 'slides':
                config = {
                    format: getRadioValue('slides-format'),
                    duration: getRadioValue('slides-duration'),
                    language: document.getElementById('slides-language').value,
                };
                await api.studioGenerateSlides(selectedDocumentId, config);
                break;

            case 'infographic':
                config = {
                    language: document.getElementById('infographic-language').value,
                    orientation: getRadioValue('infographic-orientation'),
                    visual_style: document.querySelector('#infographic-style-grid .studio-style-btn.active')?.dataset.style || 'SKETCH',
                    detail_level: getRadioValue('infographic-detail'),
                };
                await api.studioGenerateInfographic(selectedDocumentId, config);
                break;

            case 'quiz':
                config = {
                    questionCount: getRadioValue('quiz-count'),
                    difficulty: getRadioValue('quiz-difficulty'),
                    topic: document.getElementById('quiz-topic')?.value || undefined,
                };
                await api.studioGenerateQuiz(selectedDocumentId, config);
                break;

            case 'flashcards':
                config = {
                    language: document.getElementById('flashcards-language').value,
                };
                await api.studioGenerateFlashcards(selectedDocumentId, config);
                break;
        }

        showToast(`${getTypeName(type)} em geração! ⏳`, 'success');
        if (modal) modal.style.display = 'none';

        // Iniciar polling para atualizar status
        loadArtifacts();
        startPolling();

    } catch (err) {
        showToast(`Erro: ${err.message}`, 'error');
    }
}

function getRadioValue(name) {
    return document.querySelector(`input[name="${name}"]:checked`)?.value;
}

// ==============================================================================
// ARTEFATOS — Lista e renderiza
// ==============================================================================
async function loadArtifacts() {
    if (!selectedDocumentId) return;

    try {
        const data = await api.studioListArtifacts(selectedDocumentId);
        const artifacts = data.artifacts || [];

        const container = document.getElementById('studio-artifacts-container');
        const listSection = document.getElementById('studio-artifacts-list');
        if (!container || !listSection) return;

        if (artifacts.length === 0) {
            listSection.style.display = 'none';
            return;
        }

        listSection.style.display = 'block';
        container.innerHTML = artifacts.map(a => renderArtifactCard(a)).join('');

        // Bind action buttons
        container.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', () => handleArtifactAction(btn.dataset.action, btn.dataset.id));
        });

        // Check if any artifacts still processing → keep polling
        const stillProcessing = artifacts.some(a => a.status === 'QUEUED' || a.status === 'PROCESSING');
        if (!stillProcessing) stopPolling();

    } catch (err) {
        console.error('Erro ao carregar artefatos:', err);
    }
}

function renderArtifactCard(artifact) {
    const icons = {
        AUDIO_SUMMARY: '🎧',
        SLIDES: '📊',
        INFOGRAPHIC: '🖼️',
        QUIZ: '📝',
        FLASHCARDS: '🃏',
    };
    const names = {
        AUDIO_SUMMARY: 'Resumo em Áudio',
        SLIDES: 'Apresentação',
        INFOGRAPHIC: 'Infográfico',
        QUIZ: 'Teste',
        FLASHCARDS: 'Flashcards',
    };
    const statusLabels = {
        QUEUED: 'Na fila',
        PROCESSING: 'Gerando...',
        COMPLETED: 'Pronto',
        FAILED: 'Falhou',
    };

    const icon = icons[artifact.type] || '📦';
    const name = names[artifact.type] || artifact.type;
    const statusLabel = statusLabels[artifact.status] || artifact.status;
    const statusClass = artifact.status.toLowerCase();
    const date = new Date(artifact.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    let actions = '';
    if (artifact.status === 'COMPLETED') {
        if (artifact.type === 'QUIZ') {
            actions = `<button data-action="play-quiz" data-id="${artifact.id}" aria-label="Jogar quiz">▶️ Jogar</button>`;
        } else if (artifact.type === 'FLASHCARDS') {
            actions = `<button data-action="view-flashcards" data-id="${artifact.id}" aria-label="Ver flashcards">🃏 Ver</button>`;
        } else {
            actions = `<button data-action="view" data-id="${artifact.id}" aria-label="Visualizar">👁️ Ver</button>`;
        }
        actions += `<button data-action="favorite" data-id="${artifact.id}" aria-label="Favoritar">⭐</button>`;
    }

    return `
        <div class="studio-artifact-card">
            <div class="studio-artifact-info">
                <span class="studio-artifact-icon">${icon}</span>
                <div class="studio-artifact-meta">
                    <h4>${name}</h4>
                    <p>${date} · <span class="studio-status-badge ${statusClass}">${statusLabel}</span></p>
                    ${artifact.errorMessage ? `<p style="color:#dc3545;font-size:0.8rem;">${artifact.errorMessage}</p>` : ''}
                </div>
            </div>
            <div class="studio-artifact-actions">${actions}</div>
        </div>
    `;
}

// ==============================================================================
// ARTIFACT ACTIONS
// ==============================================================================
async function handleArtifactAction(action, artifactId) {
    try {
        switch (action) {
            case 'play-quiz':
                const quizData = await api.studioGetArtifact(artifactId);
                openQuizPlayer(quizData.artifact);
                break;

            case 'view-flashcards':
                const fcData = await api.studioGetArtifact(artifactId);
                openFlashcardViewer(fcData.artifact);
                break;

            case 'view':
                const viewData = await api.studioGetArtifact(artifactId);
                showArtifactDetail(viewData.artifact);
                break;

            case 'favorite':
                const result = await api.studioToggleFavorite(artifactId);
                showToast(result.favorited ? '⭐ Adicionado aos favoritos!' : 'Removido dos favoritos.', 'success');
                break;
        }
    } catch (err) {
        showToast(`Erro: ${err.message}`, 'error');
    }
}

// ==============================================================================
// QUIZ PLAYER
// ==============================================================================
function openQuizPlayer(artifact) {
    const modal = document.getElementById('studio-modal-quiz-player');
    const body = document.getElementById('quiz-player-body');
    const submitBtn = document.getElementById('quiz-submit-btn');
    const title = document.getElementById('quiz-player-title');
    if (!modal || !body) return;

    const resultData = artifact.resultData || {};
    const questions = resultData.questions || [];

    if (title) title.textContent = `📝 Teste — ${questions.length} questões`;

    body.innerHTML = questions.map((q, i) => `
        <div class="quiz-question" data-index="${i}">
            <h4>${i + 1}. ${q.question}</h4>
            ${q.options.map((opt, j) => `
                <label class="quiz-option" data-correct="${j === q.correctOption}">
                    <input type="radio" name="quiz-q-${i}" value="${j}">
                    <span>${opt}</span>
                </label>
            `).join('')}
            <div class="quiz-explanation" data-explanation="${i}">${q.explanation || ''}</div>
        </div>
    `).join('');

    submitBtn.style.display = 'block';
    submitBtn.onclick = () => submitQuiz(artifact.id, questions);

    modal.style.display = 'flex';
}

async function submitQuiz(artifactId, questions) {
    const answers = {};
    questions.forEach((q, i) => {
        const selected = document.querySelector(`input[name="quiz-q-${i}"]:checked`);
        answers[i] = selected ? parseInt(selected.value) : -1;
    });

    // Show visual feedback
    let correct = 0;
    questions.forEach((q, i) => {
        const options = document.querySelectorAll(`[data-index="${i}"] .quiz-option`);
        options.forEach((opt, j) => {
            if (j === q.correctOption) opt.classList.add('correct');
            else if (j === answers[i] && j !== q.correctOption) opt.classList.add('incorrect');
        });
        if (answers[i] === q.correctOption) correct++;

        const explanation = document.querySelector(`[data-explanation="${i}"]`);
        if (explanation) explanation.style.display = 'block';
    });

    // Show score
    const body = document.getElementById('quiz-player-body');
    const scoreHtml = `
        <div class="quiz-score-card">
            <div class="score">${correct}/${questions.length}</div>
            <div class="label">${correct === questions.length ? '🎉 Perfeito!' : correct >= questions.length * 0.7 ? '👏 Muito bem!' : '💪 Continue estudando!'}</div>
        </div>
    `;
    body.insertAdjacentHTML('afterbegin', scoreHtml);

    document.getElementById('quiz-submit-btn').style.display = 'none';

    // Submit to backend
    try {
        await api.studioSubmitQuiz(artifactId, answers);
    } catch (err) {
        console.error('Erro ao registrar tentativa:', err);
    }
}

// ==============================================================================
// FLASHCARD VIEWER
// ==============================================================================
function openFlashcardViewer(artifact) {
    const modal = document.getElementById('studio-modal-quiz-player'); // Reuse quiz modal
    const body = document.getElementById('quiz-player-body');
    const title = document.getElementById('quiz-player-title');
    const submitBtn = document.getElementById('quiz-submit-btn');
    if (!modal || !body) return;

    const resultData = artifact.resultData || {};
    const cards = resultData.cards || [];
    let currentIndex = 0;

    if (title) title.textContent = `🃏 Flashcards — ${cards.length} cartões`;
    if (submitBtn) submitBtn.style.display = 'none';

    function renderCard() {
        if (cards.length === 0) {
            body.innerHTML = '<p style="text-align:center;color:#666;">Nenhum flashcard gerado.</p>';
            return;
        }
        const card = cards[currentIndex];
        body.innerHTML = `
            <div class="flashcard-container">
                <div class="flashcard" id="current-flashcard">
                    <div class="flashcard-face flashcard-front">${card.front}</div>
                    <div class="flashcard-face flashcard-back">${card.back}</div>
                </div>
            </div>
            <p style="text-align:center;font-size:0.85rem;color:#666;margin-top:0.5rem;">Clique no cartão para virar</p>
            <div class="flashcard-nav">
                <button id="fc-prev" ${currentIndex === 0 ? 'disabled' : ''}>◀ Anterior</button>
                <span class="flashcard-counter">${currentIndex + 1} / ${cards.length}</span>
                <button id="fc-next" ${currentIndex === cards.length - 1 ? 'disabled' : ''}>Próximo ▶</button>
            </div>
        `;

        document.getElementById('current-flashcard')?.addEventListener('click', () => {
            document.getElementById('current-flashcard')?.classList.toggle('flipped');
        });
        document.getElementById('fc-prev')?.addEventListener('click', () => { currentIndex--; renderCard(); });
        document.getElementById('fc-next')?.addEventListener('click', () => { currentIndex++; renderCard(); });
    }

    renderCard();
    modal.style.display = 'flex';
}

// ==============================================================================
// GENERIC ARTIFACT DETAIL VIEWER
// ==============================================================================
function showArtifactDetail(artifact) {
    const modal = document.getElementById('studio-modal-quiz-player');
    const body = document.getElementById('quiz-player-body');
    const title = document.getElementById('quiz-player-title');
    const submitBtn = document.getElementById('quiz-submit-btn');
    if (!modal || !body) return;

    const names = {
        AUDIO_SUMMARY: '🎧 Resumo em Áudio',
        SLIDES: '📊 Apresentação',
        INFOGRAPHIC: '🖼️ Infográfico',
    };

    if (title) title.textContent = names[artifact.type] || artifact.type;
    if (submitBtn) submitBtn.style.display = 'none';

    const resultData = artifact.resultData || {};

    if (artifact.type === 'AUDIO_SUMMARY') {
        body.innerHTML = `
            <div style="text-align:center;padding:2rem;">
                <p style="font-size:1.1rem;margin-bottom:1rem;">🎧 ${resultData.format || 'Resumo'} — ${resultData.language || 'pt-BR'}</p>
                ${resultData.transcript ? `<div style="text-align:left;padding:1rem;background:#f8f9fa;border-radius:12px;max-height:400px;overflow-y:auto;"><p>${resultData.transcript}</p></div>` : '<p style="color:#666;">Audio gerado com sucesso. Integração com player em breve.</p>'}
            </div>
        `;
    } else if (artifact.type === 'SLIDES') {
        const slides = resultData.slides || [];
        body.innerHTML = `
            <div style="padding:1rem;">
                ${slides.map((s, i) => `
                    <div style="padding:1rem;margin-bottom:1rem;background:#f8f9fa;border-radius:12px;border-left:4px solid #6c5ce7;">
                        <h4 style="margin:0 0 0.5rem 0;">Slide ${i + 1}: ${s.title}</h4>
                        <p style="margin:0;font-size:0.9rem;color:#636e72;">${s.content}</p>
                    </div>
                `).join('')}
            </div>
        `;
    } else if (artifact.type === 'INFOGRAPHIC') {
        body.innerHTML = `
            <div style="text-align:center;padding:2rem;">
                <p>🖼️ Estilo: ${resultData.style || 'N/A'} · Orientação: ${resultData.orientation || 'N/A'}</p>
                <p style="color:#666;margin-top:1rem;">Infográfico gerado. Integração com visualizador em breve.</p>
            </div>
        `;
    } else {
        body.innerHTML = `<pre style="padding:1rem;overflow:auto;max-height:400px;">${JSON.stringify(resultData, null, 2)}</pre>`;
    }

    modal.style.display = 'flex';
}

// ==============================================================================
// POLLING (refresh artefatos enquanto processando)
// ==============================================================================
function startPolling() {
    if (pollInterval) return;
    pollInterval = setInterval(loadArtifacts, 5000);
}

function stopPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}

// ==============================================================================
// UTILS
// ==============================================================================
function getTypeName(type) {
    const map = {
        audio: 'Resumo em Áudio',
        slides: 'Apresentação de Slides',
        infographic: 'Infográfico',
        quiz: 'Teste',
        flashcards: 'Flashcards',
    };
    return map[type] || type;
}
