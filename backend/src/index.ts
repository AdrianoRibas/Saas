import express from 'express';
import { config } from './config/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { tenantGuard, optionalTenant } from './middleware/tenantGuard.js';
import { corsMiddleware } from './middleware/corsConfig.js';
import { globalLimiter, authLimiter, uploadLimiter } from './middleware/rateLimiter.js';
import { requestContext, errorLogger } from './middleware/requestContext.js';
import { logger } from './lib/logger.js';
import healthRoutes from './routes/health.routes.js';

// Rotas
import authRoutes from './modules/auth/auth.routes.js';
import organizationsRoutes from './modules/organizations/organizations.routes.js';
import documentsRoutes from './modules/documents/documents.routes.js';
import billingRoutes from './modules/billing/billing.routes.js';
import reportsRoutes from './modules/reports/reports.routes.js';
import teachersRoutes from './modules/teachers/teachers.routes.js';
import disciplinesRoutes from './modules/disciplines/disciplines.routes.js';
import classesRoutes from './modules/classes/classes.routes.js';
import studentsRoutes from './modules/students/students.routes.js';
import invitesRoutes from './modules/invites/invites.routes.js';
import notificationsRoutes from './modules/notifications/notifications.routes.js';
import aiRoutes from './modules/ai/ai.routes.js';
import coverageRoutes from './modules/coverage/coverage.routes.js';
import knowledgeRoutes from './modules/knowledge/knowledge.routes.js';
import studioRoutes from './modules/studio/studio.routes.js';

import { startWorker } from './modules/ai/adaptation.worker.js';
import { startStudioWorker } from './modules/studio/studio.worker.js';

const app = express();

// ... (resto do setup)

// Iniciando o AI Worker em background
if (process.env.NODE_ENV !== 'test') {
    startWorker();
    startStudioWorker();
}

// ============================================================================
// MIDDLEWARES GLOBAIS
// ============================================================================

// 1. Webhook do Stripe (PRECISA do body raw, SEM parsing JSON)
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

// 2. CORS configurado
app.use(corsMiddleware);

// 3. Rate limiter global
app.use(globalLimiter);

// 4. JSON parser (Aumentado para 50mb para suportar arquivos PDF em base64)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 5. Request context (requestId, timing, logging)
app.use(requestContext);

// 6. Servir arquivos de upload localmente (se aplicável)
app.use('/uploads', express.static('uploads'));

// ============================================================================
// ROTAS PÚBLICAS
// ============================================================================

// Rota raiz
app.get('/', (req, res) => {
    res.status(200).json({ message: 'API is running' });
});

// Health checks
app.use('/health', healthRoutes);

// Autenticação (cadastro/login não exigem tenant bloqueado)
app.use('/api/auth', optionalTenant, authRoutes);

// Convites (rota /accept é pública, demais requerem tenant)
app.use('/api/invites', optionalTenant, invitesRoutes);

// ============================================================================
// BARREIRA DE SEGURANÇA MULTI-TENANT
// ============================================================================
// Todas as rotas abaixo EXIGEM organizationId válido
app.use('/api', tenantGuard);

// ============================================================================
// ROTAS PROTEGIDAS (TENANT-ISOLATED)
// ============================================================================
app.use('/api/organizations', organizationsRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/teachers', teachersRoutes);
app.use('/api/disciplines', disciplinesRoutes);
app.use('/api/classes', classesRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/coverage', coverageRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/studio', studioRoutes);

// ============================================================================
// ERROR HANDLERS
// ============================================================================

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Rota não encontrada' });
});

// Error logger
app.use(errorLogger);

// Error handler global
app.use(errorHandler);

// ============================================================================
// START SERVER
// ============================================================================
const PORT = config.port;

app.listen(PORT, () => {
    logger.info('Servidor iniciado', {
        port: PORT,
        environment: config.nodeEnv,
        frontendUrl: config.frontendUrl,
    });
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`📝 Ambiente: ${config.nodeEnv}`);
    console.log(`🔗 Frontend: ${config.frontendUrl}`);
    console.log(`🛡️ Tenant Guard: ATIVADO em todas as rotas /api/* (exceto auth)`);
    console.log(`📊 Health checks: /health, /health/ready, /health/live`);
});

export default app;
