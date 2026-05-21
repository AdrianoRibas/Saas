// Admin Panel JavaScript
import { api } from './services/apiService.js';
import { 
    teachersApi, 
    disciplinesApi, 
    classesApi, 
    studentsApi, 
    membersApi, 
    invitesApi,
    notificationsApi,
    knowledgeApi
} from './services/adminApi.js';
import { initCoverageModule } from './coverage.js';

// ========== State ==========
let currentPage = (window.location.pathname.includes('index') || window.location.pathname === '/' || !window.location.pathname.includes('admin')) ? 'triagem' : 'dashboard';
let currentDashboardStats = null;


// ========== DOM Elements ==========
// ========== DOM Elements ==========
let navLinks;
let pages;
let toastContainer;
let modalContainer;

// ========== Init ==========
async function init() {
    navLinks = document.querySelectorAll('.nav-link[data-page]');
    pages = document.querySelectorAll('.page');
    toastContainer = document.getElementById('toast-container');
    modalContainer = document.getElementById('modal-container');

    // Check auth
    const token = localStorage.getItem('ada_token');
    if (!token) {
        // Permitir que o app lide com overlay de login em index.js sem dar reload 
        return;
    }

    // Setup navigation
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            navigateTo(page);
        });
    });

    // Logout button
    document.getElementById('logout-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        api.logout();
        localStorage.removeItem('user');
        window.location.href = '/';
    });

    // Load organization theme (Whitelabel)
    await loadOrganizationTheme();

    // Load dashboard data
    await loadDashboard();

    // Setup page-specific buttons
    setupPageHandlers();

    // Setup global notifications
    setupNotifications();

    // Setup Theme Toggle
    setupTheme();

    // Export PDF Button
    document.getElementById('btn-export-pdf')?.addEventListener('click', exportPdfReport);

    // Role-based UI
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userEmail = (user.email || '').trim().toLowerCase();

    if (userEmail) {
        document.body.setAttribute('data-user-email', userEmail);
    }

    const isDev = userEmail.includes('aragaovictor31'); // Loose check for safety

    console.log('--- PERMISSION DEBUG ---', {
        user,
        userEmail,
        isDev,
        role: user.role
    });

    // TEMPORARILY DISABLED HIDING TO FIX ACCESS
    // if (user.role !== 'ADMIN' && user.role !== 'OWNER' && !isDev) {
    //     const sensitivePages = ['disciplines', 'classes'];
    //     sensitivePages.forEach(page => {
    //         const link = document.querySelector(`.nav-link[data-page="${page}"]`);
    //         if (link) link.style.display = 'none';
    //     });
    // }

    // Auto-navigate if page param is present (allows index.html sidebar to link directly here)
    const urlParams = new URLSearchParams(window.location.search);
    const pageParam = urlParams.get('page');
    if (pageParam) {
        const exists = Array.from(document.querySelectorAll('.nav-link[data-page]')).some(link => link.dataset.page === pageParam);
        if (exists) {
            navigateTo(pageParam);
        } else {
            navigateTo(currentPage);
        }
    } else {
        navigateTo(currentPage);
    }

    // Render Lucide Icons
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

// ========== Theme Logic ==========
// ========== Whitelabel Theme Logic ==========
async function loadOrganizationTheme() {
    try {
        const org = await api.getOrgCurrent();
        if (org) {
            const root = document.documentElement;
            if (org.primaryColor) root.style.setProperty('--color-primary', org.primaryColor);
            if (org.secondaryColor) root.style.setProperty('--color-secondary', org.secondaryColor);
            if (org.accentColor) root.style.setProperty('--color-accent', org.accentColor);
            
            // Injeta o logo se existir
            const logoImg = document.getElementById('org-logo');
            if (logoImg && org.logoUrl) {
                logoImg.src = org.logoUrl;
            }

            // Título dinâmico
            if (org.name) {
                const orgTitle = document.getElementById('org-name-display');
                if (orgTitle) orgTitle.textContent = org.name;
            }
        }
    } catch (error) {
        console.warn('Falha ao carregar tema da organização:', error);
    }
}

const themes = ['light', 'dark', 'high-contrast'];
const themeLabels = { 'light': '☀️ Claro', 'dark': '🌙 Escuro', 'high-contrast': '🔲 Alto Contraste' };

function setupTheme() {
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) {
        btn.addEventListener('click', cycleTheme);
    }
    loadTheme();
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ada_theme', theme);
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) btn.textContent = themeLabels[theme] || '🌙 Tema';
}


function loadTheme() {
    const saved = localStorage.getItem('ada_theme');
    if (saved && themes.includes(saved)) {
        setTheme(saved);
    } else {
        // Force light by default if nothing saved
        setTheme('light');
    }
}

function cycleTheme() {
    const current = localStorage.getItem('ada_theme') || 'light';
    const idx = themes.indexOf(current);
    const next = themes[(idx + 1) % themes.length];
    setTheme(next);
}

// ========== Navigation ==========
function navigateTo(page) {
    // Update nav links
    navLinks.forEach(link => {
        link.classList.toggle('active', link.dataset.page === page);
    });

    // Show/hide pages
    pages.forEach(p => {
        const pageId = p.id.replace('page-', '');
        p.style.display = pageId === page ? 'block' : 'none';
    });

    currentPage = page;

    // Load page data
    if (page === 'dashboard') {
        loadDashboard();
    } else if (page === 'coverage') {
        initCoverageModule();
    } else if (page === 'teachers') {
        loadTeachers();
    } else if (page === 'disciplines') {
        loadDisciplines();
    } else if (page === 'classes') {
        loadClasses();
    } else if (page === 'students') {
        loadStudents();
    } else if (page === 'members') {
        loadMembers();
    } else if (page === 'invites') {
        loadInvites();
    } else if (page === 'knowledge') {
        loadKnowledge();
    }
}

// ========== Dashboard ==========
async function loadDashboard() {
    try {
        const stats = await api.getDashboardStats();
        currentDashboardStats = stats;
        const { overview, academic, roi, topTeachers, recentDocuments } = stats;

        // Update stat cards
        document.getElementById('count-teachers').textContent = academic.totalTeachers;
        document.getElementById('count-disciplines').textContent = academic.totalDisciplines;
        document.getElementById('count-classes').textContent = academic.totalClasses;
        document.getElementById('count-students').textContent = academic.totalStudents;

        // Render extended dashboard below stat cards
        const dashPage = document.getElementById('page-dashboard');
        let extendedSection = document.getElementById('dashboard-extended');
        if (!extendedSection) {
            extendedSection = document.createElement('div');
            extendedSection.id = 'dashboard-extended';
            extendedSection.style.cssText = 'margin-top: 2rem; display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;';
            dashPage.appendChild(extendedSection);
        }

        extendedSection.innerHTML = `
            <div class="card" style="padding: 1.5rem;">
                <h3 style="margin-bottom: 1rem; color: #4285F4;">📊 Documentos</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div style="text-align: center; padding: 1rem; background: #f8f9fa; border-radius: 8px;">
                        <div style="font-size: 2rem; font-weight: 700; color: #333;">${overview.totalDocuments}</div>
                        <div style="font-size: 0.85rem; color: #666;">Total Enviados</div>
                    </div>
                    <div style="text-align: center; padding: 1rem; background: #e8f5e9; border-radius: 8px;">
                        <div style="font-size: 2rem; font-weight: 700; color: #2e7d32;">${overview.totalAdapted}</div>
                        <div style="font-size: 0.85rem; color: #666;">Adaptados</div>
                    </div>
                    <div style="text-align: center; padding: 1rem; background: #fff3e0; border-radius: 8px;">
                        <div style="font-size: 2rem; font-weight: 700; color: #e65100;">${overview.brailleCount}</div>
                        <div style="font-size: 0.85rem; color: #666;">Braille</div>
                    </div>
                    <div style="text-align: center; padding: 1rem; background: #e3f2fd; border-radius: 8px;">
                        <div style="font-size: 2rem; font-weight: 700; color: #1565c0;">${overview.highLegibilityCount}</div>
                        <div style="font-size: 0.85rem; color: #666;">Alta Legibilidade</div>
                    </div>
                </div>
            </div>

            <div class="card" style="padding: 1.5rem;">
                <h3 style="margin-bottom: 1rem; color: #10B981;">💰 ROI Estimado</h3>
                <div style="display: flex; justify-content: center; gap: 1rem;">
                    <div style="text-align: center; padding: 2rem; background: #f0fdf4; border-radius: 8px; min-width: 250px;">
                        <div style="font-size: 3rem; font-weight: 700; color: #059669;">${roi.hoursSaved}h</div>
                        <div style="font-size: 1rem; color: #666;">Horas de Trabalho Economizadas</div>
                        <div style="font-size: 0.8rem; color: #999; margin-top: 5px;">(Base: 20 pág = 3 dias)</div>
                    </div>
                </div>
                <div style="margin-top: 1rem; padding: 0.75rem; background: #ecfdf5; border-radius: 8px; text-align: center;">
                    <span style="font-weight: 600;">🎓 ${academic.totalPcdStudents}</span> alunos atendidos
                    <span style="margin-left: 1rem; font-weight: 600;">📈 ${roi.documentsPerDay}</span> docs/dia
                </div>
            </div>

            <div class="card" style="padding: 1.5rem; grid-column: 1 / -1;">
                <h3 style="margin-bottom: 1rem; color: #6366F1;">📄 Documentos Recentes</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                    <thead>
                        <tr style="border-bottom: 2px solid #e5e7eb;">
                            <th style="text-align: left; padding: 0.5rem;">Documento</th>
                            <th style="text-align: left; padding: 0.5rem;">Disciplina</th>
                            <th style="text-align: center; padding: 0.5rem;">Status</th>
                            <th style="text-align: right; padding: 0.5rem;">Data</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${recentDocuments.map(doc => `
                            <tr style="border-bottom: 1px solid #f3f4f6;">
                                <td style="padding: 0.5rem;">${doc.titulo || doc.originalName}</td>
                                <td style="padding: 0.5rem; color: #666;">${doc.disciplina || '—'}</td>
                                <td style="padding: 0.5rem; text-align: center;">
                                    ${doc.brailleDownloaded ? '<span style="background:#fef3c7; color:#92400e; padding:2px 8px; border-radius:12px; font-size:0.8rem;">Braille</span>' : ''}
                                    ${doc.highLegibilityDownloaded ? '<span style="background:#dbeafe; color:#1e40af; padding:2px 8px; border-radius:12px; font-size:0.8rem;">Alta Leg.</span>' : ''}
                                    ${!doc.brailleDownloaded && !doc.highLegibilityDownloaded ? '<span style="color:#9ca3af;">Pendente</span>' : ''}
                                </td>
                                <td style="padding: 0.5rem; text-align: right; color: #666;">${new Date(doc.createdAt).toLocaleDateString('pt-BR')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (error) {
        console.error('Error loading dashboard:', error);
        // Fallback to individual API calls using apiService
        try {
            const [teachers, disciplines, classes, students] = await Promise.all([
                api.listTeachers(1, 1),
                api.listDisciplines(1, 1),
                api.listClasses(null, 1, 1),
                api.listStudents(1, 1),
            ]);
            document.getElementById('count-teachers').textContent = teachers.pagination?.total ?? '-';
            document.getElementById('count-disciplines').textContent = disciplines.pagination?.total ?? '-';
            document.getElementById('count-classes').textContent = classes.pagination?.total ?? '-';
            document.getElementById('count-students').textContent = students.pagination?.total ?? '-';
        } catch (innerError) {
            // console.log('Session check complete'); in dashboard fallback:', innerError);
        }
    }
}

// ========== Teachers ==========
async function loadTeachers(search = '') {
    const tbody = document.getElementById('tbody-teachers');
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Carregando...</td></tr>';

    try {
        const { teachers } = await teachersApi.list({ search, page: 1, limit: 50 });

        if (!teachers?.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhum professor encontrado</td></tr>';
            return;
        }

        tbody.innerHTML = teachers.map(t => `
            <tr data-id="${t.id}">
                <td><strong>${escapeHtml(t.user?.name || '-')}</strong></td>
                <td>${escapeHtml(t.user?.email || '-')}</td>
                <td>${escapeHtml(t.department || '-')}</td>
                <td><span class="badge badge-info">${t._count?.disciplines || 0}</span></td>
                <td>
                    <button class="btn btn-secondary btn-sm btn-edit" data-id="${t.id}">Editar</button>
                    <button class="btn btn-danger btn-sm btn-delete" data-id="${t.id}">Excluir</button>
                </td>
            </tr>
        `).join('');

        // Add event listeners
        tbody.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', () => editTeacher(btn.dataset.id));
        });
        tbody.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => deleteTeacher(btn.dataset.id));
        });
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Erro: ${escapeHtml(error.message)}</td></tr>`;
    }
}

async function deleteTeacher(id) {
    if (!confirm('Tem certeza que deseja excluir este professor?')) return;

    try {
        await teachersApi.delete(id);
        showToast('Professor excluído com sucesso', 'success');
        loadTeachers();
    } catch (error) {
        showToast(error.message, 'error');
    }
}



// ========== Disciplines ==========
async function loadDisciplines(search = '') {
    const tbody = document.getElementById('tbody-disciplines');
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Carregando...</td></tr>';

    try {
        const { disciplines } = await disciplinesApi.list({ search, page: 1, limit: 50 });

        if (!disciplines?.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhuma disciplina encontrada</td></tr>';
            return;
        }

        tbody.innerHTML = disciplines.map(d => `
            <tr data-id="${d.id}">
                <td><strong>${escapeHtml(d.name)}</strong></td>
                <td>${escapeHtml(d.code || '-')}</td>
                <td>${escapeHtml(d.teacher?.user?.name || '-')}</td>
                <td>${d.workload || '-'}h</td>
                <td>
                    <button class="btn btn-secondary btn-sm btn-edit" data-id="${d.id}">Editar</button>
                    <button class="btn btn-danger btn-sm btn-delete" data-id="${d.id}">Excluir</button>
                </td>
            </tr>
        `).join('');

        tbody.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Excluir disciplina?')) return;
                try {
                    await disciplinesApi.delete(btn.dataset.id);
                    showToast('Disciplina excluída', 'success');
                    loadDisciplines();
                } catch (e) { showToast(e.message, 'error'); }
            });
        });
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Erro: ${escapeHtml(error.message)}</td></tr>`;
    }
}

// ========== Classes ==========
async function loadClasses(search = '') {
    const tbody = document.getElementById('tbody-classes');
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Carregando...</td></tr>';

    try {
        const { classes } = await classesApi.list({ search, page: 1, limit: 50 });

        if (!classes?.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhuma turma encontrada</td></tr>';
            return;
        }

        const shiftLabels = { MORNING: 'Manhã', AFTERNOON: 'Tarde', EVENING: 'Noite', FULL_TIME: 'Integral' };

        tbody.innerHTML = classes.map(c => `
            <tr data-id="${c.id}">
                <td><strong>${escapeHtml(c.name)}</strong></td>
                <td>${escapeHtml(c.discipline?.name || '-')}</td>
                <td>${shiftLabels[c.shift] || c.shift || '-'}</td>
                <td>${c.year || '-'}</td>
                <td><span class="badge badge-info">${c._count?.students || 0}</span></td>
                <td>
                    <button class="btn btn-secondary btn-sm btn-edit" data-id="${c.id}">Editar</button>
                    <button class="btn btn-danger btn-sm btn-delete" data-id="${c.id}">Excluir</button>
                </td>
            </tr>
        `).join('');

        tbody.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', () => editClass(btn.dataset.id));
        });

        tbody.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Excluir turma?')) return;
                try {
                    await classesApi.delete(btn.dataset.id);
                    showToast('Turma excluída', 'success');
                    loadClasses();
                } catch (e) { showToast(e.message, 'error'); }
            });
        });
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Erro: ${escapeHtml(error.message)}</td></tr>`;
    }
}

// ========== Students ==========
async function loadStudents(search = '') {
    const tbody = document.getElementById('tbody-students');
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Carregando...</td></tr>';

    try {
        const { students } = await studentsApi.list({ search, page: 1, limit: 50 });

        if (!students?.length) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Nenhum aluno encontrado</td></tr>';
            return;
        }

        const typeLabels = {
            'LOW_VISION': 'Baixa Visão',
            'BLIND': 'Cegueira',
            'DYSLEXIA': 'Dislexia',
            'DEAF': 'Surdez',
            'MOTOR': 'Motora',
            'COGNITIVE': 'Cognitiva',
            'OTHER': 'Outra'
        };

        tbody.innerHTML = students.map(s => {
            const types = s.accessibilityTypes?.map(t => typeLabels[t] || t).join(', ') || '-';

            const prefs = [];
            if (s.prefersBraille) prefs.push('Braille');
            if (s.prefersLargePrint) prefs.push('Fonte Ampliada' + (s.preferredFontSize ? ` (${s.preferredFontSize}pt)` : ''));
            if (s.prefersAudio) prefs.push('Áudio');
            const prefsStr = prefs.join(', ') || '-';

            return `
            <tr data-id="${s.id}">
                <td><strong>${escapeHtml(s.name)}</strong></td>
                <td>${escapeHtml(s.registration || '-')}</td>
                <td>${types}</td>
                <td>${prefsStr}</td>
                <td>
                    <button class="btn btn-secondary btn-sm btn-edit" data-id="${s.id}">Editar</button>
                    <button class="btn btn-danger btn-sm btn-delete" data-id="${s.id}">Excluir</button>
                </td>
            </tr>
        `;
        }).join('');

        // Add event listeners
        tbody.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', () => editStudent(btn.dataset.id));
        });

        tbody.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Excluir aluno?')) return;
                try {
                    await studentsApi.delete(btn.dataset.id);
                    showToast('Aluno excluído', 'success');
                    loadStudents();
                } catch (e) { showToast(e.message, 'error'); }
            });
        });
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="4" class="empty-state">Erro: ${escapeHtml(error.message)}</td></tr>`;
    }
}

// ========== Members ==========
async function loadMembers() {
    const tbody = document.getElementById('tbody-members');
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Carregando...</td></tr>';

    try {
        const { members } = await membersApi.list();

        if (!members?.length) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Nenhum membro encontrado</td></tr>';
            return;
        }

        const roleLabels = { OWNER: 'Proprietário', ADMIN: 'Administrador', MEMBER: 'Membro' };
        const roleBadges = { OWNER: 'badge-danger', ADMIN: 'badge-warning', MEMBER: 'badge-info' };

        tbody.innerHTML = members.map(m => `
            <tr data-id="${m.id}">
                <td><strong>${escapeHtml(m.name)}</strong></td>
                <td>${escapeHtml(m.email)}</td>
                <td><span class="badge ${roleBadges[m.role] || 'badge-info'}">${roleLabels[m.role] || m.role}</span></td>
                <td>
                    ${m.role !== 'OWNER' ? `
                        <button class="btn btn-secondary btn-sm btn-role" data-id="${m.id}">Alterar Cargo</button>
                        <button class="btn btn-danger btn-sm btn-remove" data-id="${m.id}">Remover</button>
                    ` : '<span style="color: var(--text-light);">-</span>'}
                </td>
            </tr>
        `).join('');

        tbody.querySelectorAll('.btn-remove').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Remover este membro?')) return;
                try {
                    await membersApi.remove(btn.dataset.id);
                    showToast('Membro removido', 'success');
                    loadMembers();
                } catch (e) { showToast(e.message, 'error'); }
            });
        });
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="4" class="empty-state">Erro: ${escapeHtml(error.message)}</td></tr>`;
    }
}

// ========== Invites ==========
async function loadInvites() {
    const tbody = document.getElementById('tbody-invites');
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Carregando...</td></tr>';

    try {
        const { invites } = await invitesApi.list();

        if (!invites?.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhum convite encontrado</td></tr>';
            return;
        }

        const statusLabels = { PENDING: 'Pendente', ACCEPTED: 'Aceito', EXPIRED: 'Expirado', REVOKED: 'Revogado' };
        const statusBadges = { PENDING: 'badge-warning', ACCEPTED: 'badge-success', EXPIRED: 'badge-info', REVOKED: 'badge-danger' };

        tbody.innerHTML = invites.map(i => `
            <tr data-id="${i.id}">
                <td>${escapeHtml(i.email)}</td>
                <td><span class="badge ${statusBadges[i.status]}">${statusLabels[i.status]}</span></td>
                <td>${formatDate(i.createdAt)}</td>
                <td>${formatDate(i.expiresAt)}</td>
                <td>
                    ${i.status === 'PENDING' ? `
                        <button class="btn btn-secondary btn-sm btn-resend" data-id="${i.id}">Reenviar</button>
                        <button class="btn btn-danger btn-sm btn-revoke" data-id="${i.id}">Revogar</button>
                    ` : '-'}
                </td>
            </tr>
        `).join('');

        tbody.querySelectorAll('.btn-resend').forEach(btn => {
            btn.addEventListener('click', async () => {
                try {
                    await invitesApi.resend(btn.dataset.id);
                    showToast('Convite reenviado', 'success');
                } catch (e) { showToast(e.message, 'error'); }
            });
        });

        tbody.querySelectorAll('.btn-revoke').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Revogar convite?')) return;
                try {
                    await invitesApi.revoke(btn.dataset.id);
                    showToast('Convite revogado', 'success');
                    loadInvites();
                } catch (e) { showToast(e.message, 'error'); }
            });
        });
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Erro: ${escapeHtml(error.message)}</td></tr>`;
    }
}

// ========== Knowledge Base ==========
async function loadKnowledge() {
    const tbody = document.getElementById('tbody-knowledge');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Carregando...</td></tr>';

    try {
        const entries = await knowledgeApi.list();

        if (!entries?.length) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Nenhum artigo científico na base de conhecimento</td></tr>';
            return;
        }

        tbody.innerHTML = entries.map(e => `
            <tr data-id="${e.id}">
                <td><strong>${escapeHtml(e.title)}</strong></td>
                <td>
                    ${e.autismLevel ? `<span class="badge" style="background:var(--accent-color);color:white;">Suporte ${e.autismLevel === 1 ? 'Leve' : e.autismLevel === 2 ? 'Substancial' : 'Muito Subst.'}</span>` : '<span class="badge badge-secondary">Geral</span>'}
                    ${(e.tags || []).map(t => `<span class="badge badge-info">${escapeHtml(t)}</span>`).join(' ')}
                </td>
                <td>${new Date(e.createdAt).toLocaleDateString('pt-BR')}</td>
                <td>
                    <button class="btn btn-danger btn-sm btn-delete" data-id="${e.id}">Excluir</button>
                </td>
            </tr>
        `).join('');

        tbody.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Remover esta norma científica?')) return;
                try {
                    await knowledgeApi.delete(btn.dataset.id);
                    showToast('Artigo removido', 'success');
                    loadKnowledge();
                } catch (err) { showToast(err.message, 'error'); }
            });
        });
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="4" class="empty-state">Erro: ${escapeHtml(error.message)}</td></tr>`;
    }
}

function showKnowledgeForm() {
    showModal('Novo Artigo Científico', `
        <div class="form-group" style="margin-bottom: 1.25rem;">
            <label class="form-label">Título do Artigo / Diretriz *</label>
            <input type="text" class="form-input" id="f-k-title" required placeholder="Ex: Manual de Acessibilidade Cognitiva">
        </div>
        <div class="form-group" style="margin-bottom: 1.25rem;">
            <label class="form-label">Conteúdo (Texto para o RAG) *</label>
            <textarea class="form-input" id="f-k-content" required rows="10" placeholder="Cole aqui o conteúdo técnico ou fragmento relevante..."></textarea>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">URL da Fonte (Opcional)</label>
                <input type="url" class="form-input" id="f-k-url" placeholder="https://...">
            </div>
            <div class="form-group">
                <label class="form-label">Tags (separadas por vírgula)</label>
                <input type="text" class="form-input" id="f-k-tags" placeholder="TEA, Avaliação, Matemática">
            </div>
            <div class="form-group">
                <label class="form-label">Perfil de Suporte (TEA)</label>
                <select class="form-input" id="f-k-level">
                    <option value="">Geral / Princípios Universais</option>
                    <option value="1">Suporte Leve (Nível 1 / Alta Funcionalidade)</option>
                    <option value="2">Suporte Substancial (Nível 2)</option>
                    <option value="3">Suporte Muito Substancial (Nível 3 / CAA)</option>
                </select>
            </div>
        </div>
    `, async () => {
        const data = {
            title: document.getElementById('f-k-title').value.trim(),
            content: document.getElementById('f-k-content').value.trim(),
            sourceUrl: document.getElementById('f-k-url').value.trim(),
            tags: document.getElementById('f-k-tags').value.split(',').map(t => t.trim()).filter(t => t),
            autismLevel: parseInt(document.getElementById('f-k-level').value) || null
        };

        if (!data.title || !data.content) throw new Error('Título e Conteúdo são obrigatórios');

        await knowledgeApi.create(data);
        showToast('Artigo adicionado à Base de Conhecimento!', 'success');
        loadKnowledge();
    });
}

// ========== Page Handlers ==========
function setupPageHandlers() {
    // Search inputs
    document.getElementById('search-teachers')?.addEventListener('input', debounce((e) => loadTeachers(e.target.value), 300));
    document.getElementById('search-disciplines')?.addEventListener('input', debounce((e) => loadDisciplines(e.target.value), 300));
    document.getElementById('search-classes')?.addEventListener('input', debounce((e) => loadClasses(e.target.value), 300));
    document.getElementById('search-students')?.addEventListener('input', debounce((e) => loadStudents(e.target.value), 300));

    // Helper for async handlers
    const safeHandle = (fn) => async (e) => {
        try {
            await fn(e);
        } catch (error) {
            showToast(error.message, 'error');
        }
    };

    // Add buttons
    document.getElementById('btn-add-teacher')?.addEventListener('click', () => showTeacherForm());
    document.getElementById('btn-add-discipline')?.addEventListener('click', safeHandle(() => showDisciplineForm()));
    document.getElementById('btn-add-class')?.addEventListener('click', safeHandle(() => showClassForm()));
    document.getElementById('btn-add-student')?.addEventListener('click', () => showStudentForm());
    document.getElementById('btn-add-invite')?.addEventListener('click', () => showInviteForm());
    document.getElementById('btn-add-knowledge')?.addEventListener('click', () => showKnowledgeForm());

    // Custom events for quick forms
    document.addEventListener('open-quick-discipline', safeHandle((e) => {
        const teacherId = e.detail;
        return showDisciplineForm(null, {
            teacherId: teacherId,
            onSuccess: () => {
                showToast('Disciplina criada e vinculada!', 'success');
                editTeacher(teacherId); // Reload teacher form to show new discipline
            }
        });
    }));

    document.addEventListener('open-quick-class', safeHandle((e) => {
        const studentId = e.detail;
        return showClassForm(null, {
            studentId: studentId,
            onSuccess: () => {
                showToast('Turma criada e aluno matriculado!', 'success');
                editStudent(studentId); // Reload student form to show new class
            }
        });
    }));
}

// ========== Modal Helpers ==========
function showModal(title, bodyHtml, onSubmit) {
    modalContainer.innerHTML = `
        <div class="modal-overlay active">
            <div class="modal">
                <div class="modal-header">
                    <h2 class="modal-title">${title}</h2>
                    <button class="modal-close" id="modal-close-btn">&times;</button>
                </div>
                <form id="modal-form">
                    <div class="modal-body">${bodyHtml}</div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" id="modal-cancel-btn">Cancelar</button>
                        <button type="submit" class="btn btn-primary" id="modal-submit-btn">Salvar</button>
                    </div>
                </form>
`;

    const closeModal = () => { modalContainer.innerHTML = ''; };
    document.getElementById('modal-close-btn').addEventListener('click', closeModal);
    document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
    modalContainer.querySelector('.modal-overlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal();
    });

    document.getElementById('modal-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('modal-submit-btn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Salvando...';
        try {
            await onSubmit();
            closeModal();
        } catch (err) {
            showToast(err.message || 'Erro ao salvar', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Salvar';
        }
    });
}

// ========== Teacher Form ==========
function showTeacherForm(teacher = null) {
    const isEdit = !!teacher;
    const disciplinesList = teacher && teacher.disciplines ? teacher.disciplines.map(d =>
        `<li style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem;background:#f8f9fa;border-radius:4px;margin-bottom:0.5rem;">
            <span>${d.code ? `<strong>${d.code}</strong> - ` : ''}${d.name}</span>
        </li>`
    ).join('') : '<li style="color:#999;font-style:italic;">Nenhuma disciplina vinculada</li>';

    showModal(isEdit ? 'Editar Professor' : 'Novo Professor', `
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">Nome *</label>
                <input type="text" class="form-input" id="f-teacher-name" required value="${escapeHtml(teacher?.user?.name || '')}">
            </div>
            <div class="form-group">
                <label class="form-label">Email *</label>
                <input type="email" class="form-input" id="f-teacher-email" required ${isEdit ? 'disabled' : ''} value="${escapeHtml(teacher?.user?.email || '')}">
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">Matrícula</label>
                <input type="text" class="form-input" id="f-teacher-reg" value="${escapeHtml(teacher?.registration || '')}">
            </div>
            <div class="form-group">
                <label class="form-label">Departamento</label>
                <input type="text" class="form-input" id="f-teacher-dept" value="${escapeHtml(teacher?.department || '')}">
            </div>
        </div>
        ${isEdit ? `
        <div style="margin-top:1.5rem;border-top:1px solid #eee;padding-top:1rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                <label class="form-label" style="margin:0;">Disciplinas</label>
                <button type="button" class="btn btn-sm btn-secondary" onclick="document.dispatchEvent(new CustomEvent('open-quick-discipline', {detail: '${teacher.id}'}))">
                    + Nova Disciplina
                </button>
            </div>
            <ul style="list-style:none;padding:0;font-size:0.9rem;">
                ${disciplinesList}
            </ul>
        </div>
        ` : `
        <div style="margin-top:1.5rem;border-top:1px solid #eee;padding-top:1rem;">
             <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                <label class="form-label" style="margin:0;">Disciplinas</label>
                <button type="button" class="btn btn-sm btn-secondary" disabled title="Salve o professor primeiro">
                    + Nova Disciplina
                </button>
            </div>
            <p style="color:#666;font-size:0.9rem;font-style:italic;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:text-bottom;margin-right:4px;">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                Salve o novo professor para habilitar a adição de disciplinas.
            </p>
        </div>
        `}
    `, async () => {
        const data = {
            name: document.getElementById('f-teacher-name').value.trim(),
            email: document.getElementById('f-teacher-email').value.trim(),
            registration: document.getElementById('f-teacher-reg').value.trim(),
            department: document.getElementById('f-teacher-dept').value.trim(),
        };

        if (!data.name || !data.email) throw new Error('Nome e Email são obrigatórios');

        if (isEdit) {
            await teachersApi.update(teacher.id, data);
            showToast('Professor atualizado!', 'success');
        } else {
            await teachersApi.create(data);
            showToast('Professor criado!', 'success');
        }
        loadTeachers();
    });
}

async function editTeacher(id) {
    try {
        const { teacher } = await teachersApi.getById(id);
        showTeacherForm(teacher);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ========== Discipline Form ==========
async function showDisciplineForm(discipline = null, options = {}) {
    const isEdit = !!discipline;
    const teachersList = await teachersApi.list(); // simplified, usually need pagination or full list

    // Helper to check if teacher should be selected
    const selectedTeacherId = discipline?.teacherId || options.teacherId || '';

    showModal(isEdit ? 'Editar Disciplina' : 'Nova Disciplina', `
        <div class="form-group">
            <label class="form-label">Nome *</label>
            <input type="text" class="form-input" id="f-disc-name" required value="${escapeHtml(discipline?.name || '')}">
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">Código</label>
                <input type="text" class="form-input" id="f-disc-code" placeholder="Ex: MAT101" value="${escapeHtml(discipline?.code || '')}">
            </div>
            <div class="form-group">
                <label class="form-label">Professor Responsável</label>
                <select class="form-select" id="f-disc-teacher" ${options.teacherId ? 'disabled' : ''}>
                    <option value="">Selecione...</option>
                    ${teachersList.teachers.map(t =>
        `<option value="${t.id}" ${t.id === selectedTeacherId ? 'selected' : ''}>${t.user.name}</option>`
    ).join('')}
                </select>
            </div>
        </div>
        <div class="form-group">
            <label class="form-label">Descrição</label>
            <textarea class="form-input" id="f-disc-desc" rows="3">${escapeHtml(discipline?.description || '')}</textarea>
        </div>
    `, async () => {
        const data = {
            name: document.getElementById('f-disc-name').value.trim(),
            code: document.getElementById('f-disc-code').value.trim(),
            teacherId: document.getElementById('f-disc-teacher').value || null, // Send null to unlink
            description: document.getElementById('f-disc-desc').value.trim(),
        };

        // If disabled, we might need to rely on option.teacherId, but .value usually works on disabled inputs in JS reading, 
        // unlike form submission. Let's ensure usage of option if available.
        if (options.teacherId) data.teacherId = options.teacherId;

        if (!data.name) throw new Error('Nome é obrigatório');

        if (isEdit) {
            await disciplinesApi.update(discipline.id, data);
            showToast('Disciplina atualizada!', 'success');
        } else {
            await disciplinesApi.create(data);
            showToast('Disciplina criada!', 'success');
        }

        if (options.onSuccess) {
            options.onSuccess();
        } else {
            loadDisciplines();
        }
    });
}

async function editDiscipline(id) {
    try {
        const { discipline } = await disciplinesApi.getById(id);
        showDisciplineForm(discipline);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ========== Class Form ==========
async function showClassForm(classData = null, options = {}) {
    const isEdit = !!classData;
    const disciplinesRes = await disciplinesApi.list();

    showModal(isEdit ? 'Editar Turma' : 'Nova Turma', `
        <div class="form-group">
            <label class="form-label">Nome *</label>
            <input type="text" class="form-input" id="f-class-name" required placeholder="Ex: Turma A - 2024" value="${escapeHtml(classData?.name || '')}">
        </div>
        <div class="form-group">
            <label class="form-label">Disciplina *</label>
            <select class="form-select" id="f-class-discipline">
                <option value="">Selecione...</option>
                ${disciplinesRes.disciplines.map(d =>
        `<option value="${d.id}" ${classData?.disciplineId === d.id ? 'selected' : ''}>${d.name} (${d.code || '-'})</option>`
    ).join('')}
            </select>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">Ano</label>
                <input type="number" class="form-input" id="f-class-year" value="${classData?.year || new Date().getFullYear()}">
            </div>
            <div class="form-group">
                <label class="form-label">Semestre</label>
                <select class="form-select" id="f-class-semester">
                    <option value="1" ${classData?.semester === 1 ? 'selected' : ''}>1º Semestre</option>
                    <option value="2" ${classData?.semester === 2 ? 'selected' : ''}>2º Semestre</option>
                </select>
            </div>
        </div>
        <div class="form-group">
            <label class="form-label">Turno</label>
            <select class="form-select" id="f-class-shift">
                <option value="MORNING" ${classData?.shift === 'MORNING' ? 'selected' : ''}>Manhã</option>
                <option value="AFTERNOON" ${classData?.shift === 'AFTERNOON' ? 'selected' : ''}>Tarde</option>
                <option value="NIGHT" ${classData?.shift === 'NIGHT' ? 'selected' : ''}>Noite</option>
            </select>
        </div>
    `, async () => {
        const data = {
            name: document.getElementById('f-class-name').value.trim(),
            disciplineId: document.getElementById('f-class-discipline').value,
            year: parseInt(document.getElementById('f-class-year').value),
            semester: parseInt(document.getElementById('f-class-semester').value),
            shift: document.getElementById('f-class-shift').value,
        };

        if (!data.name || !data.disciplineId) throw new Error('Campos obrigatórios faltando');

        if (isEdit) {
            await classesApi.update(classData.id, data);
            showToast('Turma atualizada!', 'success');
        } else {
            const response = await classesApi.create(data);
            showToast('Turma criada!', 'success');

            // Fix: response.class contains the new entity
            if (options.studentId && response.class?.id) {
                await classesApi.enrollStudent(response.class.id, options.studentId);
                showToast('Aluno matriculado na nova turma!', 'success');
            }
        }

        if (options.onSuccess) {
            options.onSuccess();
        } else {
            loadClasses();
        }
    });
}

async function editClass(id) {
    try {
        const { class: classData } = await classesApi.getById(id);
        showClassForm(classData);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ========== Student Form ==========
async function editStudent(id) {
    try {
        const { student } = await studentsApi.getById(id);
        showStudentForm(student);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ========== Student Form ==========
async function showStudentForm(student = null) {
    const isEdit = !!student;

    // Fetch classes for selection
    let classes = [];
    try {
        const res = await classesApi.list({ limit: 100 });
        classes = res.classes || [];
    } catch (error) {
        console.error('Erro ao buscar turmas:', error);
        showToast('Erro ao carregar lista de turmas', 'error');
    }

    // Determine selected classes
    const selectedClassIds = new Set();
    if (student && student.classes) {
        student.classes.forEach(c => selectedClassIds.add(c.classId || c.class?.id));
    }

    const classesListHtml = classes.length > 0 ? classes.map(c => `
        <div style="margin-bottom: 5px;">
            <label style="display:inline-flex;align-items:center;font-weight:normal;cursor:pointer;">
                <input type="checkbox" name="student-courses" value="${c.id}" ${selectedClassIds.has(c.id) ? 'checked' : ''} style="margin-right:8px;">
                ${escapeHtml(c.name)} <span style="color:#666;font-size:0.85em;margin-left:4px;">(${escapeHtml(c.discipline?.name || 'Sem disciplina')})</span>
            </label>
        </div>
    `).join('') : '<p style="color:#666;font-style:italic;">Nenhuma turma encontrada.</p>';

    showModal(isEdit ? 'Editar Aluno' : 'Novo Aluno', `
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">Nome *</label>
                <input type="text" class="form-input" id="f-student-name" required value="${escapeHtml(student?.name || '')}">
            </div>
            <div class="form-group">
                <label class="form-label">Matrícula</label>
                <input type="text" class="form-input" id="f-student-registration" value="${escapeHtml(student?.registration || '')}">
            </div>
        </div>
        <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" class="form-input" id="f-student-email" placeholder="email@exemplo.com" value="${escapeHtml(student?.email || '')}">
        </div>

        <div style="margin-top:1.5rem;border-top:1px solid #eee;border-bottom:1px solid #eee;padding:1rem 0;">
             <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
                <label class="form-label" style="margin:0;">Matricular em Turmas</label>
                ${isEdit ? `
                <button type="button" class="btn btn-sm btn-secondary" onclick="document.dispatchEvent(new CustomEvent('open-quick-class', {detail: '${student.id}'}))">
                    + Nova Turma
                </button>
                ` : `
                <button type="button" class="btn btn-sm btn-secondary" disabled title="Salve o aluno primeiro">
                    + Nova Turma
                </button>
                `}
            </div>
            <div style="max-height: 150px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; border-radius: 4px; background: #fafafa;">
                ${classesListHtml}
            </div>
        </div>

        <div style="margin-top: 1rem;">
            <label class="form-label">Configurações de Acessibilidade</label>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <label><input type="checkbox" class="acc-check" value="BLIND" ${student?.accessibilityTypes?.includes('BLIND') ? 'checked' : ''}> Cegueira</label>
                <label><input type="checkbox" class="acc-check" value="LOW_VISION" ${student?.accessibilityTypes?.includes('LOW_VISION') ? 'checked' : ''}> Baixa Visão</label>
                <label><input type="checkbox" class="acc-check" value="DYSLEXIA" ${student?.accessibilityTypes?.includes('DYSLEXIA') ? 'checked' : ''}> Dislexia</label>
                <label><input type="checkbox" class="acc-check" value="DEAF" ${student?.accessibilityTypes?.includes('DEAF') ? 'checked' : ''}> Surdez</label>
                <label><input type="checkbox" class="acc-check" value="MOTOR" ${student?.accessibilityTypes?.includes('MOTOR') ? 'checked' : ''}> Motora</label>
                <label><input type="checkbox" class="acc-check" value="COGNITIVE" ${student?.accessibilityTypes?.includes('COGNITIVE') ? 'checked' : ''}> Cognitiva</label>
                <label><input type="checkbox" class="acc-check" value="OTHER" ${student?.accessibilityTypes?.includes('OTHER') ? 'checked' : ''}> Outra</label>
            </div>
            
            <label class="form-label" style="margin-top: 10px;">Preferências de Adaptação</label>
            <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                <label><input type="checkbox" id="f-student-braille" ${student?.prefersBraille ? 'checked' : ''}> Prefere Braille</label>
                <label><input type="checkbox" id="f-student-largeprint" ${student?.prefersLargePrint ? 'checked' : ''}> Prefere Impressão Grande</label>
                <label><input type="checkbox" id="f-student-audio" ${student?.prefersAudio ? 'checked' : ''}> Prefere Áudio</label>
            </div>
             <div class="form-row" style="margin-top: 10px;">
                 <div class="form-group">
                    <label class="form-label">Tamanho da Fonte (Pontos)</label>
                    <input type="number" class="form-input" id="f-student-fontsize" value="${student?.preferredFontSize || ''}" min="10" max="72" placeholder="Ex: 18">
                </div>
                 <div class="form-group" style="flex:1">
                    <label class="form-label">Perfil de Suporte TEA (se aplicável)</label>
                    <select class="form-input" id="f-student-autism-level">
                        <option value="">Não informado / Não aplicável</option>
                        <option value="1" ${student?.autismLevel === 1 ? 'selected' : ''}>Suporte Leve (Nível 1)</option>
                        <option value="2" ${student?.autismLevel === 2 ? 'selected' : ''}>Suporte Substancial (Nível 2)</option>
                        <option value="3" ${student?.autismLevel === 3 ? 'selected' : ''}>Suporte Muito Substancial (Nível 3)</option>
                    </select>
                </div>
                 <div class="form-group" style="flex:2">
                    <label class="form-label">Notas de Acessibilidade</label>
                    <textarea class="form-input" id="f-student-notes" rows="1">${escapeHtml(student?.accessibilityNotes || '')}</textarea>
                </div>
            </div>
        </div>
    `, async () => {
        // Collect Accessibility Data
        const accTypes = Array.from(document.querySelectorAll('.acc-check:checked')).map(el => el.value);

        // Collect Selected Classes
        const selectedClasses = Array.from(document.querySelectorAll('input[name="student-courses"]:checked')).map(el => el.value);

        const name = document.getElementById('f-student-name').value.trim();
        const email = document.getElementById('f-student-email').value.trim();
        const fontSizeStr = document.getElementById('f-student-fontsize').value;

        if (!name) throw new Error('Nome é obrigatório');
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new Error('Email inválido');
        }

        if (accTypes.includes('LOW_VISION') && !fontSizeStr) {
            throw new Error('Para alunos com Baixa Visão, o tamanho de fonte preferido é obrigatório.');
        }

        const data = {
            name,
            registration: document.getElementById('f-student-registration').value.trim(),
            email,
            isPcd: accTypes.length > 0, // Auto-detect based on selection
            accessibilityTypes: accTypes,
            accessibilityNotes: document.getElementById('f-student-notes').value.trim(),
            prefersBraille: document.getElementById('f-student-braille').checked,
            prefersLargePrint: document.getElementById('f-student-largeprint').checked,
            prefersAudio: document.getElementById('f-student-audio').checked,
            preferredFontSize: parseInt(fontSizeStr) || undefined,
            autismLevel: parseInt(document.getElementById('f-student-autism-level').value) || null,
            classIds: selectedClasses // Send to backend
        };

        if (isEdit) {
            await studentsApi.update(student.id, data);
            showToast('Aluno atualizado!', 'success');
        } else {
            await studentsApi.create(data);
            showToast('Aluno criado com sucesso!', 'success');
        }
        loadStudents();
    });
}

// ========== Invite Form ==========
function showInviteForm() {
    showModal('Novo Convite', `
        <div class="form-group">
            <label class="form-label">Email *</label>
            <input type="email" class="form-input" id="f-invite-email" required placeholder="email@exemplo.com">
        </div>
    `, async () => {
        const data = {
            email: document.getElementById('f-invite-email').value.trim(),
        };
        if (!data.email) throw new Error('Informe o email');
        await invitesApi.create(data);
        showToast('Convite enviado com sucesso!', 'success');
        loadInvites();
    });
}

// ========== Utilities ==========
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
        return new Date(dateStr).toLocaleDateString('pt-BR');
    } catch {
        return '-';
    }
}

function debounce(fn, delay) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), delay);
    };
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Start app
console.log('Admin JS executing...');
try {
    init().catch(e => {
        console.error('Error in init (promise):', e);
        alert('Erro ao inicializar painel: ' + e.message);
    });
} catch (e) {
    console.error('Error starting init:', e);
    alert('Erro crítico ao iniciar: ' + e.message);
}



// ========== Notifications ==========
function setupNotifications() {
    const container = document.getElementById('notification-container');
    const dropdown = document.getElementById('notification-dropdown');
    const list = document.getElementById('notification-list');
    const badge = document.getElementById('notification-badge');
    const markAllBtn = document.getElementById('mark-all-read-btn');

    if (!container || !dropdown || !list || !badge) return;

    // Toggle dropdown
    container.addEventListener('click', (e) => {
        if (e.target.closest('.notification-dropdown')) return; // Don't close when clicking inside dropdown
        dropdown.classList.toggle('show');
        if (dropdown.classList.contains('show')) {
            // Reset badge immediately on open to improve UX
            badge.style.display = 'none';
            loadNotifications();
        }
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    });

    // Mark all as read
    if (markAllBtn) {
        markAllBtn.addEventListener('click', async () => {
            try {
                await notificationsApi.markAllRead();
                loadNotifications();
                showToast('Todas as notificações marcadas como lidas', 'success');
            } catch (error) {
                console.error('Error marking all read:', error);
            }
        });
    }

    // Initial load (just badge count)
    loadNotifications(true);

    async function loadNotifications(badgeOnly = false) {
        try {
            const notifications = await notificationsApi.list();
            const unreadCount = notifications.filter(n => !n.read).length;

            // Update badge
            if (unreadCount > 0) {
                badge.style.display = 'flex';
                badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
            } else {
                badge.style.display = 'none';
            }

            if (badgeOnly) return;

            // Render list
            if (notifications.length === 0) {
                list.innerHTML = '<div style="padding: 1rem; text-align: center; color: var(--text-light); font-size: 0.8rem;">Nenhuma notificação</div>';
                return;
            }

            list.innerHTML = notifications.map(n => `
                <div class="notification-item ${n.read ? '' : 'unread'}" style="opacity: ${n.read ? 0.7 : 1}">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.25rem;">
                        <h4 class="notification-title" style="color: ${n.type === 'WARNING' ? '#d35400' : n.type === 'ERROR' ? '#c0392b' : 'inherit'}">
                            ${n.type === 'WARNING' ? '⚠️ ' : n.type === 'ERROR' ? '❌ ' : n.type === 'SUCCESS' ? '✅ ' : ''}${n.title}
                        </h4>
                        ${!n.read ? `<button class="mark-read-btn" data-id="${n.id}" style="font-size: 0.7rem;">Marcar lida</button>` : ''}
                    </div>
                    <p class="notification-message">${n.message}</p>
                    <div class="notification-time">${new Date(n.createdAt).toLocaleString('pt-BR')}</div>
                </div>
            `).join('');

            // Bind individual mark read buttons
            list.querySelectorAll('.mark-read-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation(); // Prevent dropdown close
                    const id = btn.dataset.id;
                    try {
                        await notificationsApi.markRead(id);
                        // Reload list to update UI state
                        loadNotifications();
                    } catch (error) {
                        // console.log('Restoring session for:', user.name);
                    }
                });
            });

        } catch (error) {
            if (!badgeOnly) {
                list.innerHTML = '<div style="padding: 1rem; text-align: center; color: var(--danger);">Erro ao carregar</div>';
            }
        }
    }
}

// ========== PDF Report ==========
function exportPdfReport() {
    if (!currentDashboardStats) {
        showToast('Carregue o dashboard primeiro para gerar o relatório.', 'error');
        return;
    }

    const { overview, academic, roi } = currentDashboardStats;
    const now = new Date().toLocaleDateString('pt-BR');

    const win = window.open('', '_blank');
    if (!win) {
        showToast('Pop-up bloqueado. Permita pop-ups para gerar o relatório.', 'error');
        return;
    }

    win.document.write(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Relatório Institucional - Adaptador Docs</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 2rem; color: #333; max-width: 800px; margin: 0 auto; }
                header { border-bottom: 2px solid #4285F4; padding-bottom: 1.5rem; margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: flex-end; }
                .brand { font-size: 1.5rem; font-weight: bold; color: #4285F4; }
                .meta { color: #666; font-size: 0.9rem; text-align: right; }
                h1 { margin: 0; font-size: 24px; color: #2c3e50; margin-bottom: 0.5rem; }
                h2 { color: #4285F4; border-bottom: 1px solid #eee; padding-bottom: 0.5rem; margin-top: 2.5rem; font-size: 18px; }
                .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; margin-top: 1rem; }
                .card { background: #f8f9fa; padding: 1.5rem; border-radius: 8px; border: 1px solid #e9ecef; }
                .stat-value { font-size: 2rem; font-weight: bold; color: #2c3e50; margin-bottom: 0.25rem; }
                .stat-label { font-size: 0.9rem; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
                .sub-stats { margin-top: 1rem; font-size: 0.9rem; color: #555; }
                .sub-stats div { margin-bottom: 0.25rem; }
                .footer { margin-top: 4rem; text-align: center; color: #999; font-size: 0.8rem; border-top: 1px solid #eee; padding-top: 1rem; }
                @media print {
                    .no-print { display: none; }
                    body { -webkit-print-color-adjust: exact; }
                }
            </style>
        </head>
        <body>
            <header>
                <div>
                    <div class="brand">Adaptador Docs</div>
                    <h1>Relatório de Acessibilidade</h1>
                </div>
                <div class="meta">
                    <div>Data: ${now}</div>
                    <div>Relatório Institucional Confidencial</div>
                </div>
            </header>

            <h2>📊 Resumo Geral</h2>
            <div class="grid">
                <div class="card">
                    <div class="stat-value">${overview.totalAdapted}</div>
                    <div class="stat-label">Documentos Adaptados</div>
                    <div class="sub-stats">
                        <div>Braille: <strong>${overview.brailleCount}</strong></div>
                        <div>Alta Legibilidade: <strong>${overview.highLegibilityCount}</strong></div>
                    </div>
                </div>
                <div class="card">
                    <div class="stat-value">${overview.totalDocuments}</div>
                    <div class="stat-label">Solicitações Recebidas</div>
                    <div class="sub-stats">
                        <div>Taxa de Sucesso: <strong>${Math.round((overview.totalAdapted / (overview.totalDocuments || 1)) * 100)}%</strong></div>
                    </div>
                </div>
            </div>

            <h2>🎓 Impacto Acadêmico</h2>
            <div class="grid">
                <div class="card">
                    <div class="stat-value">${academic.totalStudents}</div>
                    <div class="stat-label">Alunos Atendidos</div>
                </div>
                <div class="card">
                    <div class="stat-label">Engajamento</div>
                    <div class="sub-stats" style="margin-top: 0.5rem;">
                        <div>Professores Ativos: <strong>${academic.totalTeachers}</strong></div>
                        <div>Disciplinas Cobertas: <strong>${academic.totalDisciplines}</strong></div>
                        <div>Turmas: <strong>${academic.totalClasses}</strong></div>
                    </div>
                </div>
            </div>

            <h2>💰 Economia e Eficiência (ROI)</h2>
            <p style="color: #666; font-size: 0.9rem; margin-bottom: 1rem;">
                Estimativa baseada no tempo médio manual de adaptação (4h/documento) e custo hora/professoral médio.
            </p>
            <div class="grid">
                <div class="card" style="border-left: 4px solid #00b894;">
                    <div class="stat-value" style="color: #00b894;">${roi.estimatedTimeSavedHours}h</div>
                    <div class="stat-label">Tempo Economizado</div>
                </div>
                <div class="card" style="border-left: 4px solid #00b894;">
                    <div class="stat-value" style="color: #00b894;">R$ ${roi.estimatedCostSavings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    <div class="stat-label">Economia Gerada</div>
                </div>
            </div>

            <div class="footer">
                Relatório gerado automaticamente pelo sistema. Este documento pode conter informações confidenciais de alunos.
            </div>
            <script>
                setTimeout(() => window.print(), 500);
            </script>
        </body>
        </html>
    `);
    win.document.close();
}

// Start
document.addEventListener('DOMContentLoaded', init);

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
