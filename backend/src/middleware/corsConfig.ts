import cors from 'cors';
import { config } from '../config/index.js';

// Origens permitidas por ambiente
const getAllowedOrigins = (): string[] => {
    if (config.nodeEnv === 'development') {
        return [
            'http://localhost:3000',
            'http://localhost:5173',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:5173',
        ];
    }

    // Production: use FRONTEND_URL and additional allowed origins
    const origins: string[] = [];

    if (config.frontendUrl) {
        origins.push(config.frontendUrl);
    }

    // Adicionar origens extras (separadas por vírgula em env var)
    const extraOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];
    origins.push(...extraOrigins);

    // Sempre permitir Vercel previews
    return origins;
};

// Verificar se origem é de preview do Vercel
const isVercelPreview = (origin: string): boolean => {
    return /^https:\/\/.*\.vercel\.app$/.test(origin);
};

// Configuração CORS
export const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
        const allowedOrigins = getAllowedOrigins();

        // Permitir requisições sem origem (Postman, curl, etc)
        if (!origin) {
            return callback(null, true);
        }

        // Verificar se origem está na lista
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        // Permitir Vercel previews em produção
        if (config.nodeEnv === 'production' && isVercelPreview(origin)) {
            return callback(null, true);
        }

        // Em desenvolvimento, permitir qualquer origem
        if (config.nodeEnv === 'development') {
            return callback(null, true);
        }

        // Bloquear origem desconhecida
        callback(new Error('Origem não permitida pelo CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
    ],
    exposedHeaders: [
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
    ],
    maxAge: 86400, // 24 horas
};

export const corsMiddleware = cors(corsOptions);
