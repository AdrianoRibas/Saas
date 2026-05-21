import bcrypt from 'bcryptjs';

// Mock prisma at the correct path (auth.service uses ../../config/database.js)
const mockFindUnique = jest.fn();

jest.mock('../../src/config/database', () => ({
    prisma: {
        user: {
            findUnique: mockFindUnique,
            create: jest.fn(),
        },
        organization: {
            findUnique: jest.fn(),
            create: jest.fn(),
        },
        $transaction: jest.fn(),
    },
}));

import * as authService from '../../src/modules/auth/auth.service';

describe('Auth Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFindUnique.mockReset();
    });

    describe('login', () => {
        it('should throw error if user not found', async () => {
            mockFindUnique.mockResolvedValue(null);

            await expect(
                authService.login({ email: 'test@test.com', password: 'password' })
            ).rejects.toThrow('Email ou senha incorretos');
        });

        it('should throw error if password is incorrect', async () => {
            const hashedPassword = await bcrypt.hash('correctpassword', 10);

            mockFindUnique.mockResolvedValue({
                id: 'user-1',
                email: 'test@test.com',
                passwordHash: hashedPassword,
                name: 'Test User',
                role: 'MEMBER',
                organizationId: 'org-1',
                organization: {
                    id: 'org-1',
                    name: 'Test Org',
                    subscriptionStatus: 'ACTIVE',
                },
            });

            await expect(
                authService.login({ email: 'test@test.com', password: 'wrongpassword' })
            ).rejects.toThrow('Email ou senha incorretos');
        });

        it('should return user and token on successful login', async () => {
            const hashedPassword = await bcrypt.hash('password123', 10);

            mockFindUnique.mockResolvedValue({
                id: 'user-1',
                email: 'test@test.com',
                passwordHash: hashedPassword,
                name: 'Test User',
                role: 'MEMBER',
                organizationId: 'org-1',
                organization: {
                    id: 'org-1',
                    name: 'Test Org',
                    subscriptionStatus: 'ACTIVE',
                },
            });

            const result = await authService.login({
                email: 'test@test.com',
                password: 'password123',
            });

            expect(result).toHaveProperty('user');
            expect(result).toHaveProperty('token');
            expect(result.user.email).toBe('test@test.com');
            expect(result.user).not.toHaveProperty('passwordHash');
        });
    });

    describe('getMe', () => {
        it('should throw error if user not found', async () => {
            mockFindUnique.mockResolvedValue(null);

            await expect(authService.getMe('nonexistent-user')).rejects.toThrow(
                'Usuário não encontrado'
            );
        });

        it('should return user data', async () => {
            mockFindUnique.mockResolvedValue({
                id: 'user-1',
                email: 'test@test.com',
                name: 'Test User',
                role: 'MEMBER',
                organization: {
                    id: 'org-1',
                    name: 'Test Org',
                    subscriptionStatus: 'ACTIVE',
                    headerTitle: null,
                    headerLegalText: null,
                    headerExtraInfo: null,
                },
            });

            const result = await authService.getMe('user-1');

            expect(result.id).toBe('user-1');
            expect(result.email).toBe('test@test.com');
        });
    });
});
