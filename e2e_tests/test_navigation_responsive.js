import puppeteer from 'puppeteer-core';
import mongoose from '../server/node_modules/mongoose/index.js';

const CHROME_PATH = 'C:\\Users\\DELL\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5173';
const MONGO_URI = 'mongodb://127.0.0.1:27017/hometech';

let browser;
let page;

const results = [];
function report(name, passed, detail = '') {
  results.push({ name, passed, detail });
  console.log(`${passed ? '✓ PASS' : '✗ FAIL'}: ${name}${detail ? ` (${detail})` : ''}`);
}

async function runNavigationResponsiveTests() {
  console.log('--------------------------------------------------');
  console.log('SUITE 6: HEADER, FOOTER & RESPONSIVE AUDIT IN CHROME');
  console.log('--------------------------------------------------');

  await mongoose.connect(MONGO_URI);
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');

  // Ensure customer is purely a customer without worker role
  await User.findOneAndUpdate(
    { email: 'customer@hometech.demo' },
    {
      roles: ['customer'],
      activeRole: 'customer',
      workerStatus: 'not_applied',
      approvedCategories: []
    }
  );

  browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
  });

  page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  try {
    // 1. Logged-Out Header Navigation Items
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle2' });

    const headerNavText = await page.$$eval('.nav-links a, .nav-links button', els => els.map(e => e.textContent.trim()));
    const hasHome = headerNavText.some(t => t === 'Home');
    const hasServices = headerNavText.some(t => t === 'Services');
    const hasContact = headerNavText.some(t => t.includes('Contact'));
    const hasLogin = headerNavText.some(t => t.includes('Login'));
    const noRegister = !headerNavText.some(t => t.toLowerCase().includes('register'));
    const noProfile = !headerNavText.some(t => t.toLowerCase() === 'profile');

    const loggedOutHeaderValid = hasHome && hasServices && hasContact && hasLogin && noRegister && noProfile;
    report('Logged-Out Header Navigation', loggedOutHeaderValid, `Items: [${headerNavText.join(', ')}]`);

    // 2. Active Page Highlighting on Desktop
    const isHomeActive = await page.$eval('.nav-link.active', el => el.textContent.trim() === 'Home');
    report('Active Page Navigation Highlighting (Home)', isHomeActive, 'Home link has .active class');

    // 3. Login as Customer & Check Logged-in Header
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await page.type('input[type="email"]', 'customer@hometech.demo');
    await page.type('input[type="password"]', 'HomeTech@123');
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => window.location.pathname.includes('/customer/dashboard'));

    const loggedInNavText = await page.$$eval('.nav-links a, .nav-links button', els => els.map(e => e.textContent.trim()));
    const hasCustProfile = loggedInNavText.some(t => t === 'Profile');
    const hasLogout = loggedInNavText.some(t => t.includes('Logout'));
    const isProfileActive = await page.$eval('.nav-link.active', el => el.textContent.trim() === 'Profile').catch(() => false);

    report('Logged-In Customer Header Navigation', hasCustProfile && hasLogout && noRegister, `Items: [${loggedInNavText.join(', ')}]`);
    report('Profile Link Marked Active on Dashboard', isProfileActive, 'Profile link has .active class');

    // 4. Footer Audit for Customer
    const footerText = await page.$eval('.site-footer', el => el.innerText);
    const noFooterLogin = !footerText.includes('Customer Login') && !footerText.includes('Create Account');
    const hasJoinAsWorker = footerText.includes('Join as a Worker');
    report('Footer Links Audit (No Login/Register, Has Join as Worker)', noFooterLogin && hasJoinAsWorker, 'Verified footer structure');

    // Click "Join as a Worker" as customer -> opens WorkerApplicationModal
    const joinWorkerBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('.site-footer button, .site-footer a'));
      return btns.find(b => b.textContent.includes('Join as a Worker'));
    });
    await joinWorkerBtn.evaluate(b => {
      b.scrollIntoView({ block: 'center' });
      b.click();
    });
    await page.waitForSelector('.modal-card, [role="dialog"], .modal-overlay', { timeout: 5000 });
    const modalText = await page.evaluate(() => document.body.innerText);
    const modalOpened = modalText.includes('Worker Application') || modalText.includes('Apply as a Service Professional') || modalText.includes('Application');
    report('Customer Join as a Worker Opens Application Modal', modalOpened, 'WorkerApplicationModal appeared');

    // Close modal
    const closeBtn = await page.$('.modal-close, button[aria-label="Close"], .modal-overlay button');
    if (closeBtn) await closeBtn.click();
    await new Promise(r => setTimeout(r, 600));

    // 5. Scroll to Top On Route Navigation
    await page.goto(`${BASE_URL}/services`, { waitUntil: 'networkidle2' });
    await page.evaluate(() => window.scrollTo(0, 800));
    const scrolledY = await page.evaluate(() => window.scrollY);

    // Click Contact Us
    const contactNav = await page.evaluateHandle(() => {
      const links = Array.from(document.querySelectorAll('.nav-links a'));
      return links.find(l => l.textContent.trim() === 'Contact Us');
    });
    await contactNav.click();
    await page.waitForFunction(() => window.location.pathname === '/contact');
    await new Promise(r => setTimeout(r, 200));

    const finalY = await page.evaluate(() => window.scrollY);
    report('ScrollToTop Resets Window Position on Route Change', finalY === 0 && scrolledY > 0, `Scrolled: ${scrolledY}px -> Final: ${finalY}px`);

    // 6. 404 Fallback Route Handling
    await page.goto(`${BASE_URL}/nonexistent-page-404-test`, { waitUntil: 'networkidle2' });
    const notFoundText = await page.evaluate(() => document.body.innerText);
    const is404 = notFoundText.includes('Page Not Found');
    const returnHomeBtn = await page.$('a[href="/"]');
    report('404 Fallback Page Displayed', is404 && !!returnHomeBtn, 'Shows "Page Not Found" & Return to Home button');

    // 7. Responsive Viewport Audits
    // 7a. Desktop Viewport (1280x800)
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });
    const desktopNavVisible = await page.$eval('.nav-links', el => window.getComputedStyle(el).display !== 'none');
    const desktopHamburgerHidden = await page.$eval('.mobile-menu-btn, button[aria-label="Menu"]', el => window.getComputedStyle(el).display === 'none').catch(() => true);
    report('Responsive Desktop Layout (1280x800)', desktopNavVisible && desktopHamburgerHidden, 'Desktop nav links visible, hamburger hidden');

    // 7b. Tablet Viewport (768x1024)
    await page.setViewport({ width: 768, height: 1024 });
    await page.goto(`${BASE_URL}/services`, { waitUntil: 'networkidle2' });
    const tabletCardsRendered = await page.$$eval('.service-card, .card', els => els.length > 0);
    report('Responsive Tablet Layout (768x1024)', tabletCardsRendered, 'Services catalogue renders cleanly on tablet');

    // 7c. Mobile Viewport (375x667) & Mobile Navigation Toggle
    await page.setViewport({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });

    const hamburgerBtn = await page.waitForSelector('button[aria-label="Toggle navigation menu"]');
    await hamburgerBtn.click();
    await page.waitForSelector('.mobile-drawer', { timeout: 5000 });
    const mobileMenuOpen = await page.evaluate(() => {
      const drawer = document.querySelector('.mobile-drawer');
      return drawer ? window.getComputedStyle(drawer).display !== 'none' : false;
    });
    report('Responsive Mobile Viewport & Menu Drawer (375x667)', mobileMenuOpen, 'Mobile drawer opened on hamburger toggle');

    // 8. Approved Worker Footer: Join as a Worker is Hidden
    // Log in as approved worker
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle2' });
    await page.type('input[type="email"]', 'worker@hometech.demo');
    await page.type('input[type="password"]', 'HomeTech@123');
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => window.location.pathname.includes('/worker/dashboard'));

    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });
    const workerFooterText = await page.$eval('.site-footer', el => el.innerText);
    const workerJoinHidden = !workerFooterText.includes('Join as a Worker');
    report('Approved Worker Footer Hides "Join as a Worker"', workerJoinHidden, '"Join as a Worker" link omitted for approved workers');

  } catch (err) {
    console.error('Test suite execution error:', err);
    report('Navigation Suite Execution Error', false, err.message);
  } finally {
    if (browser) await browser.close();
    await mongoose.disconnect().catch(() => {});
  }

  const passedCount = results.filter(r => r.passed).length;
  console.log(`\nNavigation & Responsive Suite Complete: ${passedCount}/${results.length} Passed\n`);
}

runNavigationResponsiveTests();
