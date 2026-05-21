import { test, expect } from '@playwright/test';

test.describe('Coverage Module E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:3002/index.html');
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err));
  });

  test('should navigate to Coverage module and display tabs', async ({ page }) => {
    // 1. Simulate Login (if needed)
    // For now, we assume we might need to log in. 
    // However, the admin.html might be protected.
    // Let's try to go directly to admin.html and handle login if redirected.
    
    await page.goto('http://localhost:3002/admin.html');

    // If we are on the main page/login overlay, perform login
    if (await page.locator('#login-email').isVisible()) {
        console.log('Logging in...');
        await page.fill('#login-email', 'aragaovictor31@gmail.com');
        await page.fill('#login-password', '123456');
        await page.click('#login-form button[type="submit"]');
        // Wait for navigation or modal close
        await page.waitForTimeout(1000); 
        await page.goto('http://localhost:3002/admin.html');
    }

    // 2. Verify we are on Admin Dashboard
    await expect(page).toHaveTitle(/Adaptador/i);
    
    // 3. Click "Cobertura" link in sidebar
    const coverageLink = page.locator('a[data-page="coverage"]');
    await expect(coverageLink).toBeVisible();
    await coverageLink.click();

    // 4. Verify "Coverage" Section Visibility
    const coverageSection = page.locator('#page-coverage');
    await expect(coverageSection).toBeVisible();

    // 5. Verify Tabs
    const riskMapTab = page.getByRole('tab', { name: 'Mapa de Risco' });
    const studentsTab = page.getByRole('tab', { name: 'Monitoramento de Alunos' });
    const libraryTab = page.getByRole('tab', { name: 'Biblioteca Compartilhada' });

    await expect(riskMapTab).toBeVisible();
    await expect(studentsTab).toBeVisible();
    await expect(libraryTab).toBeVisible();

    // 6. Navigate Tabs
    await studentsTab.click();
    await expect(page.locator('#coverage-students-tab')).toBeVisible();

    await libraryTab.click();
    await expect(page.locator('#coverage-library-tab')).toBeVisible();

    await riskMapTab.click();
    await expect(page.locator('#coverage-risk-map-tab')).toBeVisible();

    // 7. Take Screenshot
    await page.screenshot({ path: 'frontend/coverage-verification.png', fullPage: true });
    console.log('Verification screenshot saved to frontend/coverage-verification.png');
  });
});
