import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Resend } from 'resend';
import { prisma } from '../../config/database.js';
import { config } from '../../config/index.js';
import { AppError } from '../../middleware/errorHandler.js';
import type { RegisterInput, LoginInput } from './auth.schema.js';

// ============================================================================
// CONSTANTES DE SEGURANÇA
// ============================================================================

const MAX_FAILED_ATTEMPTS = 5;         // Tentativas antes de bloquear
const LOCKOUT_DURATION_MIN = 15;        // Minutos de bloqueio
const PASSWORD_RESET_EXPIRY_HOURS = 1;  // Expiração do link de reset

// ============================================================================
// EMAIL (Resend)
// ============================================================================

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = 'noreply@adaptadordocs.com.br';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// ============================================================================
// HELPERS
// ============================================================================

// Gera token JWT com organizationId opcional
function generateToken(userId: string, email: string, organizationId?: string): string {
    const payload: any = { userId, email };

    // Incluir organizationId no token evita queries extras em cada request
    if (organizationId) {
        payload.organizationId = organizationId;
    }

    return jwt.sign(
        payload,
        config.jwt.secret as jwt.Secret,
        { expiresIn: config.jwt.expiresIn as any }
    );
}

// ============================================================================
// REGISTRAR NOVO USUÁRIO
// ============================================================================

export async function register(input: RegisterInput) {
    const { email, password, name, organizationName } = input;

    // Verifica se email já existe
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        throw new AppError('Este email já está cadastrado', 400, 'EMAIL_EXISTS');
    }

    // Hash da senha
    const passwordHash = await bcrypt.hash(password, 12);

    // Gera slug a partir do nome da organização
    const generateSlug = (name: string): string => {
        return name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove acentos
            .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres especiais
            .replace(/\s+/g, '-') // Substitui espaços por hífens
            .replace(/-+/g, '-') // Remove hífens duplicados
            .trim();
    };

    // Cria organização e usuário em uma transação
    const result = await prisma.$transaction(async (tx) => {
        // Verifica se slug já existe e gera um único
        let baseSlug = generateSlug(organizationName);
        let slug = baseSlug;
        let counter = 1;

        while (await tx.organization.findUnique({ where: { slug } })) {
            slug = `${baseSlug}-${counter}`;
            counter++;
        }

        // Cria a organização
        const organization = await tx.organization.create({
            data: {
                name: organizationName,
                slug, // Campo obrigatório no novo schema
                subscriptionStatus: 'INACTIVE', // Começa inativa, precisa assinar
            },
        });

        // Cria o usuário como OWNER da organização
        const user = await tx.user.create({
            data: {
                email,
                passwordHash,
                name,
                role: 'OWNER',
                organizationId: organization.id,
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                organization: {
                    select: {
                        id: true,
                        name: true,
                        subscriptionStatus: true,
                    },
                },
            },
        });

        return user;
    });

    // Gera token com organizationId
    const token = generateToken(result.id, result.email, result.organization?.id);

    return {
        user: result,
        token,
    };
}

// ============================================================================
// LOGIN — com Account Lockout (Camada 2: Edge Functions validam os acessos)
// ============================================================================

export async function login(input: LoginInput) {
    const { email, password } = input;

    // Busca usuário
    const user = await prisma.user.findUnique({
        where: { email },
        select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            role: true,
            organizationId: true,
            failedLoginAttempts: true,
            lockedUntil: true,
            organization: {
                select: {
                    id: true,
                    name: true,
                    subscriptionStatus: true,
                },
            },
        },
    });

    // Mensagem genérica para não revelar se email existe
    if (!user) {
        throw new AppError('Email ou senha incorretos', 401, 'INVALID_CREDENTIALS');
    }

    // ——— VERIFICAÇÃO DE BLOQUEIO ———
    if (user.lockedUntil && new Date() < user.lockedUntil) {
        const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
        throw new AppError(
            `Conta temporariamente bloqueada. Tente novamente em ${minutesLeft} minuto(s).`,
            423, // Locked
            'ACCOUNT_LOCKED'
        );
    }

    // Verifica senha
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
        // ——— INCREMENTA TENTATIVAS FALHAS ———
        const newFailedAttempts = (user.failedLoginAttempts ?? 0) + 1;
        const shouldLock = newFailedAttempts >= MAX_FAILED_ATTEMPTS;

        await prisma.user.update({
            where: { id: user.id },
            data: {
                failedLoginAttempts: newFailedAttempts,
                lockedUntil: shouldLock
                    ? new Date(Date.now() + LOCKOUT_DURATION_MIN * 60 * 1000)
                    : null,
            },
        });

        if (shouldLock) {
            throw new AppError(
                `Conta bloqueada por ${LOCKOUT_DURATION_MIN} minutos devido a múltiplas tentativas.`,
                423,
                'ACCOUNT_LOCKED'
            );
        }

        const remaining = MAX_FAILED_ATTEMPTS - newFailedAttempts;
        throw new AppError(
            `Email ou senha incorretos. ${remaining} tentativa(s) restante(s) antes do bloqueio.`,
            401,
            'INVALID_CREDENTIALS'
        );
    }

    // ——— LOGIN BEM-SUCEDIDO: Reseta tentativas ———
    await prisma.user.update({
        where: { id: user.id },
        data: {
            failedLoginAttempts: 0,
            lockedUntil: null,
        },
    });

    // Gera token com organizationId
    const token = generateToken(user.id, user.email, user.organization?.id || user.organizationId || undefined);

    // Remove passwordHash da resposta
    const { passwordHash: _, failedLoginAttempts: __, lockedUntil: ___, ...userWithoutSensitiveData } = user;

    return {
        user: userWithoutSensitiveData,
        token,
    };
}

// ============================================================================
// BUSCAR USUÁRIO ATUAL
// ============================================================================

export async function getMe(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            organization: {
                select: {
                    id: true,
                    name: true,
                    subscriptionStatus: true,
                    headerTitle: true,
                    headerLegalText: true,
                    headerExtraInfo: true,
                },
            },
        },
    });

    if (!user) {
        throw new AppError('Usuário não encontrado', 404, 'USER_NOT_FOUND');
    }

    return user;
}

// ============================================================================
// ESQUECI MINHA SENHA — Gera token e envia email (Camada 2)
// ============================================================================

export async function forgotPassword(email: string) {
    // Busca usuário (mesmo que não exista, retornamos sucesso para não revelar emails)
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
        // Resposta genérica para não revelar se email existe
        return { message: 'Se este e-mail estiver cadastrado, você receberá as instruções em breve.' };
    }

    // Invalida tokens anteriores deste usuário
    await prisma.passwordResetToken.updateMany({
        where: { userId: user.id, used: false },
        data: { used: true },
    });

    // Gera token seguro (32 bytes aleatórios → SHA-256)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Expira em 1 hora
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_HOURS * 60 * 60 * 1000);

    await prisma.passwordResetToken.create({
        data: {
            token: hashedToken,
            userId: user.id,
            expiresAt,
        },
    });

    // Link de reset — usa o token bruto (não o hash)
    const resetUrl = `${FRONTEND_URL}/reset-password?token=${rawToken}`;

    // Envia email com Resend
    await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: 'Recuperação de senha — Adaptador Docs',
        html: buildPasswordResetEmail(user.name ?? 'usuário', resetUrl),
    });

    return { message: 'Se este e-mail estiver cadastrado, você receberá as instruções em breve.' };
}

// ============================================================================
// REDEFINIR SENHA — Valida token e salva nova senha
// ============================================================================

export async function resetPassword(rawToken: string, newPassword: string) {
    // Hash do token recebido para comparar com o banco
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    const record = await prisma.passwordResetToken.findUnique({
        where: { token: hashedToken },
        include: { user: true },
    });

    if (!record) {
        throw new AppError('Token inválido ou expirado', 400, 'INVALID_RESET_TOKEN');
    }

    if (record.used) {
        throw new AppError('Este link já foi utilizado. Solicite um novo link.', 400, 'RESET_TOKEN_USED');
    }

    if (new Date() > record.expiresAt) {
        throw new AppError('Link expirado. Solicite um novo link de recuperação.', 400, 'RESET_TOKEN_EXPIRED');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Atualiza senha e revoga o token em uma transação
    await prisma.$transaction([
        prisma.user.update({
            where: { id: record.userId },
            data: {
                passwordHash,
                failedLoginAttempts: 0, // Reseta lockout ao redefinir
                lockedUntil: null,
            },
        }),
        prisma.passwordResetToken.update({
            where: { id: record.id },
            data: { used: true },
        }),
        // Revoga todos os refresh tokens (sessões ativas) por segurança
        prisma.refreshToken.updateMany({
            where: { userId: record.userId, revoked: false },
            data: { revoked: true },
        }),
    ]);

    return { message: 'Senha redefinida com sucesso! Faça login com sua nova senha.' };
}

// ============================================================================
// TEMPLATE DE EMAIL — Link de recuperação de senha
// ============================================================================

function buildPasswordResetEmail(name: string, resetUrl: string): string {
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recuperação de Senha</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#1a1a2e;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">
                🔐 Adaptador Docs
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.6;">
                Olá, <strong>${name}</strong>!
              </p>
              <p style="margin:0 0 24px;color:#374151;font-size:16px;line-height:1.6;">
                Recebemos uma solicitação para redefinir a senha da sua conta no Adaptador Docs.
              </p>
              <p style="margin:0 0 32px;color:#374151;font-size:16px;line-height:1.6;">
                Clique no botão abaixo para criar uma nova senha. Este link é válido por
                <strong>1 hora</strong>.
              </p>
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}"
                       style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;letter-spacing:0.3px;">
                      Redefinir minha senha
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:32px 0 0;color:#6b7280;font-size:13px;line-height:1.6;">
                Se você não solicitou a redefinição de senha, pode ignorar este e-mail com segurança.
                Sua senha permanece a mesma.
              </p>
              <p style="margin:12px 0 0;color:#9ca3af;font-size:12px;word-break:break-all;">
                Ou acesse este link: <a href="${resetUrl}" style="color:#4f46e5;">${resetUrl}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                © ${new Date().getFullYear()} Adaptador Docs · Este é um e-mail automático, não responda.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ============================================================================
// REFRESH TOKEN
// ============================================================================

export async function generateRefreshToken(
    userId: string,
    ipAddress?: string,
    userAgent?: string
) {
    const token = crypto.randomBytes(40).toString('hex');

    // Expira em 30 dias
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await prisma.refreshToken.create({
        data: {
            token,
            userId,
            expiresAt,
            ipAddress,
            userAgent,
        },
    });

    return token;
}

// Renovar access token usando refresh token
export async function refreshAccessToken(refreshToken: string) {
    const tokenRecord = await prisma.refreshToken.findUnique({
        where: { token: refreshToken },
        include: {
            user: {
                select: {
                    id: true,
                    email: true,
                    organizationId: true,
                },
            },
        },
    });

    if (!tokenRecord) {
        throw new AppError('Refresh token inválido', 401, 'INVALID_REFRESH_TOKEN');
    }

    if (tokenRecord.revoked) {
        throw new AppError('Refresh token revogado', 401, 'REVOKED_REFRESH_TOKEN');
    }

    if (new Date() > tokenRecord.expiresAt) {
        throw new AppError('Refresh token expirado', 401, 'EXPIRED_REFRESH_TOKEN');
    }

    // Gerar novo access token
    const accessToken = generateToken(
        tokenRecord.user.id,
        tokenRecord.user.email,
        tokenRecord.user.organizationId || undefined
    );

    return {
        accessToken,
        user: {
            id: tokenRecord.user.id,
            email: tokenRecord.user.email,
        },
    };
}

// Revogar refresh token (logout)
export async function revokeRefreshToken(refreshToken: string) {
    await prisma.refreshToken.updateMany({
        where: { token: refreshToken },
        data: { revoked: true },
    });
}

// Revogar todos os refresh tokens de um usuário
export async function revokeAllUserTokens(userId: string) {
    await prisma.refreshToken.updateMany({
        where: { userId, revoked: false },
        data: { revoked: true },
    });
}

// Limpar tokens expirados (para cron job)
export async function cleanupExpiredTokens() {
    const deleted = await prisma.refreshToken.deleteMany({
        where: {
            OR: [
                { expiresAt: { lt: new Date() } },
                { revoked: true },
            ],
        },
    });

    return deleted.count;
}
