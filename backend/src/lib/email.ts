import { Resend } from 'resend';

// ==============================================================================
// EMAIL LIB - Driver de Integração com Resend
// ==============================================================================

const resend = new Resend(process.env.RESEND_API_KEY || 're_123'); // Fallback dev

const DEFAULT_FROM = 'Adaptador Docs <contato@adaptadordocs.com.br>';

interface SendEmailOptions {
    to: string | string[];
    subject: string;
    html: string;
    from?: string;
}

/**
 * Envia um e-mail usando o Resend
 */
export async function sendEmail({ to, subject, html, from = DEFAULT_FROM }: SendEmailOptions) {
    try {
        if (!process.env.RESEND_API_KEY) {
            console.warn('⚠️ [EMAIL] RESEND_API_KEY não configurada. E-mail simulado no log.');
            console.log(`\n--- E-MAIL ENVIADO ---\nPara: ${to}\nAssunto: ${subject}\nConteúdo: ${html.substring(0, 100)}...\n-------------------\n`);
            return { id: 'mock-id' };
        }

        const data = await resend.emails.send({
            from,
            to,
            subject,
            html,
        });

        console.log(`[EMAIL] Enviado com sucesso`);
        return data;
    } catch (error) {
        console.error('[EMAIL_ERROR] Erro ao enviar e-mail:', error);
        throw new Error('Falha no envio de e-mail institucional.');
    }
}

/**
 * Template para Convite de Nova Organização/Membro
 */
export async function sendInviteEmail(email: string, orgName: string, inviterName: string, acceptUrl: string) {
    return sendEmail({
        to: email,
        subject: `Bem-vindo ao ${orgName} no Adaptador Docs!`,
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #4285F4;">Olá!</h1>
                <p><strong>${inviterName}</strong> convidou você para fazer parte da equipe de acessibilidade da <strong>${orgName}</strong>.</p>
                <p>Com o Adaptador Docs, você poderá converter materiais didáticos em Braille e Alta Legibilidade em segundos.</p>
                <div style="margin: 2rem 0; text-align: center;">
                    <a href="${acceptUrl}" style="background: #4285F4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                        Aceitar Convite e Configurar Senha
                    </a>
                </div>
                <p style="font-size: 0.85rem; color: #666;">Este link expira em 7 dias.</p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 2rem 0;">
                <p style="font-size: 0.8rem; color: #999;">Adaptador Docs SaaS - Tecnologia para Inclusão.</p>
            </div>
        `
    });
}
