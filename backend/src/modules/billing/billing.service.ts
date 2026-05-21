import Stripe from 'stripe';
import { config } from '../../config/index.js';
import { prisma } from '../../config/database.js';
import { AppError } from '../../middleware/errorHandler.js';

// Inicializa cliente Stripe
const stripe = new Stripe(config.stripe.secretKey, {
    apiVersion: '2025-02-24.acacia' as any,
});


// Criar sessão de checkout para plano Enterprise
export async function createCheckoutSession(organizationId: string, userId: string) {
    const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true, stripeCustomerId: true },
    });

    if (!organization) {
        throw new AppError('Organização não encontrada', 404);
    }

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
    });

    // Cria ou reutiliza customer no Stripe
    let customerId = organization.stripeCustomerId;

    if (!customerId) {
        const customer = await stripe.customers.create({
            email: user?.email,
            name: organization.name,
            metadata: { organizationId },
        });
        customerId = customer.id;

        // Salva customer ID na organização
        await prisma.organization.update({
            where: { id: organizationId },
            data: { stripeCustomerId: customerId },
        });
    }

    // Cria sessão de checkout
    const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
            {
                price: config.stripe.enterprisePriceId,
                quantity: 1,
            },
        ],
        success_url: `${config.frontendUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${config.frontendUrl}/billing/cancel`,
        metadata: { organizationId },
    });

    return {
        checkoutUrl: session.url,
        sessionId: session.id,
    };
}

// Buscar status da assinatura
export async function getSubscriptionStatus(organizationId: string) {
    const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
            subscriptionStatus: true,
            stripeCustomerId: true,
            stripeSubscriptionId: true,
        },
    });

    if (!organization) {
        throw new AppError('Organização não encontrada', 404);
    }

    let subscriptionDetails = null;

    if (organization.stripeSubscriptionId) {
        try {
            const subscription = await stripe.subscriptions.retrieve(organization.stripeSubscriptionId);
            subscriptionDetails = {
                status: subscription.status,
                currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                cancelAtPeriodEnd: subscription.cancel_at_period_end,
            };
        } catch (error) {
            // Subscription não encontrada no Stripe
        }
    }

    return {
        status: organization.subscriptionStatus,
        details: subscriptionDetails,
    };
}

// Criar portal do cliente (para gerenciar assinatura)
export async function createCustomerPortalSession(organizationId: string) {
    const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { stripeCustomerId: true },
    });

    if (!organization?.stripeCustomerId) {
        throw new AppError('Organização não possui conta de cobrança', 400);
    }

    const session = await stripe.billingPortal.sessions.create({
        customer: organization.stripeCustomerId,
        return_url: `${config.frontendUrl}/settings/billing`,
    });

    return { portalUrl: session.url };
}

// Processar webhook do Stripe
export async function handleWebhook(payload: Buffer, signature: string) {
    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            payload,
            signature,
            config.stripe.webhookSecret
        );
    } catch (err) {
        throw new AppError('Webhook signature inválida', 400);
    }

    switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object as Stripe.Checkout.Session;
            const organizationId = session.metadata?.organizationId;

            if (organizationId && session.subscription) {
                await prisma.organization.update({
                    where: { id: organizationId },
                    data: {
                        stripeSubscriptionId: session.subscription as string,
                        subscriptionStatus: 'ACTIVE',
                    },
                });
            }
            break;
        }

        case 'customer.subscription.updated': {
            const subscription = event.data.object as Stripe.Subscription;
            const customer = await stripe.customers.retrieve(subscription.customer as string);
            const organizationId = (customer as Stripe.Customer).metadata?.organizationId;

            if (organizationId) {
                let status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'INACTIVE' = 'INACTIVE';

                if (subscription.status === 'active') status = 'ACTIVE';
                else if (subscription.status === 'past_due') status = 'PAST_DUE';
                else if (subscription.status === 'canceled') status = 'CANCELED';

                await prisma.organization.update({
                    where: { id: organizationId },
                    data: { subscriptionStatus: status },
                });
            }
            break;
        }

        case 'customer.subscription.deleted': {
            const subscription = event.data.object as Stripe.Subscription;
            const customer = await stripe.customers.retrieve(subscription.customer as string);
            const organizationId = (customer as Stripe.Customer).metadata?.organizationId;

            if (organizationId) {
                await prisma.organization.update({
                    where: { id: organizationId },
                    data: {
                        subscriptionStatus: 'CANCELED',
                        stripeSubscriptionId: null,
                    },
                });
            }
            break;
        }

        default:
            console.log(`Evento não tratado: ${event.type}`);
    }

    return { received: true };
}
