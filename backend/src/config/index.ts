import dotenv from 'dotenv';
import crypto from 'crypto';
dotenv.config();

const requiredEnvVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'STRIPE_SECRET_KEY',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY'
];

// Validação estrita em produção
if (process.env.NODE_ENV === 'production') {
    const missing = requiredEnvVars.filter(key => !process.env[key]);
    if (missing.length > 0) {
        throw new Error(`❌ ERRO CRÍTICO: Variáveis de ambiente obrigatórias faltando em produção: ${missing.join(', ')}`);
    }
}

export const config = {
    // Servidor
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',

    // JWT
    jwt: {
        secret: process.env.JWT_SECRET || (() => {
            if (process.env.NODE_ENV === 'production') {
                throw new Error('JWT_SECRET is missing in production');
            }
            console.warn('⚠️  WARNING: JWT_SECRET is not defined. Using a generated random secret. Sessions will be invalidated on restart.');
            return crypto.randomBytes(32).toString('hex');
        })(),
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },

    // Stripe
    stripe: {
        secretKey: process.env.STRIPE_SECRET_KEY || '',
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
        enterprisePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || '',
    },

    // Supabase Storage
    supabase: {
        url: process.env.SUPABASE_URL || '',
        anonKey: process.env.SUPABASE_ANON_KEY || '',
        bucket: process.env.SUPABASE_BUCKET || 'documents',
    },

    // Frontend
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

    // Security
    superAdminEmail: process.env.SUPER_ADMIN_EMAIL || 'aragaovictor31@gmail.com',
};
