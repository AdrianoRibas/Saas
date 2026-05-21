import { coverageApi } from './services/coverageApi.js';

let currentTab = 'risk-map';

export async function initCoverageModule() {
    const container = document.getElementById('page-coverage');
    if (!container) return;

    // Render basic layout if empty
    if (!container.innerHTML.trim()) {
        renderCoverageLayout(container);
    }

    // Load data for current tab
    await loadCurrentTab();
}

function renderCoverageLayout(container) {
    container.innerHTML = `
        <header style="margin-bottom: 2rem;">
            <h1 style="font-size: 1.8rem; color: var(--color-text);">Cobertura & Compliance</h1>
            <p style="color: var(--color-text-light);">Monitore a acessibilidade e o risco jurídico da instituição.</p>
        </header>

        <div class="tabs" role="tablist" aria-label="Seções de Cobertura">
            <button class="btn-tab active" role="tab" aria-selected="true" aria-controls="tab-risk" id="btn-tab-risk">
                📊 Mapa de Risco
            </button>
            <button class="btn-tab" role="tab" aria-selected="false" aria-controls="tab-students" id="btn-tab-students">
                👥 Monitoramento de Alunos
            </button>
            <button class="btn-tab" role="tab" aria-selected="false" aria-controls="tab-library" id="btn-tab-library">
                📚 Biblioteca Compartilhada
            </button>
        </div>

        <div class="tab-content" style="margin-top: 1.5rem;">
            <div id="tab-risk" role="tabpanel" aria-labelledby="btn-tab-risk"></div>
            <div id="tab-students" role="tabpanel" aria-labelledby="btn-tab-students" hidden></div>
            <div id="tab-library" role="tabpanel" aria-labelledby="btn-tab-library" hidden></div>
        </div>
    `;

    // Add Tab Event Listeners
    const tabs = container.querySelectorAll('[role="tab"]');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.id));
        // Keyboard navigation support integrated into switchTab via click for now, 
        // strictly WCAG would require arrow key navigation, but click is baseline.
    });
}

async function switchTab(tabId) {
    const mapping = {
        'btn-tab-risk': 'risk-map',
        'btn-tab-students': 'students',
        'btn-tab-library': 'library'
    };
    currentTab = mapping[tabId];

    // Update UI
    document.querySelectorAll('[role="tab"]').forEach(t => {
        const selected = t.id === tabId;
        t.setAttribute('aria-selected', selected);
        t.classList.toggle('active', selected);
    });

    document.querySelectorAll('[role="tabpanel"]').forEach(p => {
        p.hidden = p.getAttribute('aria-labelledby') !== tabId;
    });

    await loadCurrentTab();
}

async function loadCurrentTab() {
    const container = document.getElementById(`tab-${currentTab === 'risk-map' ? 'risk' : currentTab}`);
    container.innerHTML = '<div class="loading-spinner" aria-live="polite">Carregando dados...</div>';

    try {
        if (currentTab === 'risk-map') await renderRiskMap(container);
        else if (currentTab === 'students') await renderStudents(container);
        else if (currentTab === 'library') await renderLibrary(container);
    } catch (error) {
        container.innerHTML = `<div class="alert alert-error">Erro ao carregar: ${error.message}</div>`;
    }
}

// --- RISK MAP ---
async function renderRiskMap(container) {
    const data = await coverageApi.getRiskMap();
    const { stats, items } = data;

    const riskLevel = stats.coveragePercentage < 50 ? 'Crítico' : stats.coveragePercentage < 80 ? 'Moderado' : 'Bom';
    const riskColor = stats.coveragePercentage < 50 ? '#dc2626' : stats.coveragePercentage < 80 ? '#d97706' : '#059669';

    container.innerHTML = `
        <div class="card" style="margin-bottom: 2rem; border-left: 5px solid ${riskColor}">
            <div style="display: flex; align-items: center; justify-content: space-between;">
                <div>
                    <h3 style="margin: 0; color: var(--color-text);">Nível de Cobertura Global</h3>
                    <div style="font-size: 2.5rem; font-weight: 700; color: ${riskColor};">
                        ${stats.coveragePercentage}%
                        <span style="font-size: 1rem; color: #666; font-weight: 400;">(${riskLevel})</span>
                    </div>
                </div>
                <div style="text-align: right;">
                    <div>Disciplinas com PCD: <strong>${stats.totalDisciplinesWithPcd}</strong></div>
                    <div style="color: #dc2626;">Críticas (0%): <strong>${stats.criticalDisciplines}</strong></div>
                </div>
            </div>
        </div>

        <h3 style="margin-bottom: 1rem;">Detalhamento por Disciplina</h3>
        <div style="display: grid; gap: 1rem;">
            ${items.map(item => `
                <div class="card" style="padding: 1rem; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${item.name}</strong>
                        <div style="font-size: 0.85rem; color: #666;">${item.totalClasses} turmas ativas</div>
                    </div>
                    <div>
                        ${item.hasCoverage 
                            ? '<span class="badge badge-success">Coberto</span>' 
                            : '<span class="badge badge-danger">Risco Legal</span>'}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// --- STUDENT MONITORING ---
async function renderStudents(container) {
    const students = await coverageApi.getStudents();

    if (students.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhum aluno PCD cadastrado.</p>';
        return;
    }

    container.innerHTML = `
        <div style="overflow-x: auto;">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Nome</th>
                        <th>Necessidades</th>
                        <th>Status Material</th>
                        <th>Última Adaptação</th>
                    </tr>
                </thead>
                <tbody>
                    ${students.map(s => {
                        const statusClass = s.status === 'NEVER_SERVED' ? 'badge-danger' : s.status === 'AT_RISK' ? 'badge-warning' : 'badge-success';
                        const statusText = s.status === 'NEVER_SERVED' ? 'Nunca Atendido' : s.status === 'AT_RISK' ? 'Atenção (>30 dias)' : 'Regular';
                        
                        return `
                        <tr>
                            <td>
                                <strong>${s.name}</strong><br>
                                <span style="font-size: 0.8rem; color: #666;">${s.registration || '-'}</span>
                            </td>
                            <td>${s.accessibilityTypes.join(', ') || '-'}</td>
                            <td><span class="badge ${statusClass}">${statusText}</span></td>
                            <td>${s.lastDocDate ? new Date(s.lastDocDate).toLocaleDateString() : '-'}</td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// --- LIBRARY ---
async function renderLibrary(container) {
    const docs = await coverageApi.getLibrary();

    if (docs.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhum documento na biblioteca.</p>';
        return;
    }

    container.innerHTML = `
        <div style="overflow-x: auto;">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Documento</th>
                        <th>Disciplina</th>
                        <th>Professor</th>
                        <th>Disponibilidade</th>
                    </tr>
                </thead>
                <tbody>
                    ${docs.map(d => `
                        <tr>
                            <td>${d.title}</td>
                            <td>${d.discipline}</td>
                            <td>${d.teacher}</td>
                            <td>
                                ${d.hasBraille ? '<span class="badge" style="background:#fef3c7; color:#92400e;">Braille</span>' : ''}
                                ${d.hasHighLegibility ? '<span class="badge" style="background:#dbeafe; color:#1e40af;">Alta Leg.</span>' : ''}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}
