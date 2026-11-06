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

async function runDashboardTests() {
  console.log('--------------------------------------------------');
  console.log('SUITE 3: CUSTOMER DASHBOARD TESTING IN CHROME');
  console.log('--------------------------------------------------');

  await mongoose.connect(MONGO_URI);
  const User = mongoose.model(
    'User',
    new mongoose.Schema({}, { strict: false }),
    'users'
  );

  browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
  });

  page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  try {
    // 1. Log in as Customer
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await page.type('input[type="email"]', 'customer@hometech.demo');
    await page.type('input[type="password"]', 'HomeTech@123');
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => window.location.pathname.includes('/customer/dashboard'), { timeout: 10000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 1000));

    const currentUrl = page.url();
    const loginOk = currentUrl.includes('/customer/dashboard');
    report('Customer Login & Navigation to Dashboard', loginOk, currentUrl);

    // 2. Overview Stats Cards
    const statCardsCount = await page.$$eval('.stat-card', (cards) => cards.length);
    const statTitles = await page.$$eval('.stat-label', (els) => els.map(e => e.textContent.trim()));
    const hasTotal = statTitles.some(t => t.includes('Total Bookings'));
    const hasUpcoming = statTitles.some(t => t.includes('Upcoming'));
    const hasCompleted = statTitles.some(t => t.includes('Completed'));
    const hasSpent = statTitles.some(t => t.includes('Total Spent'));
    report('Overview Stat Cards Rendered', statCardsCount >= 4 && hasTotal && hasUpcoming && hasCompleted && hasSpent, `Found ${statCardsCount} stat cards`);

    // 3. User Avatar and Profile Header Card
    const headerName = await page.$eval('.dashboard-main h1', (el) => el.textContent.trim());
    report('Customer Profile Header Displayed', headerName.length > 0, `Profile header name: "${headerName}"`);

    // 4. Switch to Ongoing Jobs Tab
    const ongoingBtn = await page.waitForSelector('button.sidebar-item:nth-child(2)');
    await ongoingBtn.click();
    await page.waitForFunction(() => window.location.search.includes('tab=ongoing') || document.querySelector('.ongoing-section, .empty-state, h3')?.textContent.includes('Ongoing'));
    const hasOngoingContent = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes('Ongoing') || text.includes('Active Service') || text.includes('No ongoing');
    });
    report('Ongoing Jobs Tab View', hasOngoingContent, 'Rendered ongoing jobs section');

    // 5. Profile Edit Flow - Cancel Reverts Values
    const profileBtn = await page.waitForSelector('button.sidebar-item:nth-child(5)');
    await profileBtn.click();
    await page.waitForSelector('input.form-input[required]');

    const originalName = await page.$eval('input.form-input[required]', el => el.value);
    const originalAddress = await page.$eval('textarea.form-textarea', el => el.value);

    // Modify fields
    await page.$eval('input.form-input[required]', el => el.value = '');
    await page.type('input.form-input[required]', 'Temporary Test Name');
    // Click Cancel
    const cancelBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent.trim() === 'Cancel');
    });
    await cancelBtn.click();
    await page.waitForFunction(() => !document.querySelector('textarea.form-textarea'));

    // Reopen profile and verify reverted
    await profileBtn.click();
    await page.waitForSelector('input.form-input[required]');
    const revertedName = await page.$eval('input.form-input[required]', el => el.value);
    report('Profile Edit Cancel Action Reverts Changes', revertedName === originalName, `Expected: "${originalName}", got: "${revertedName}"`);

    // 6. Profile Edit Flow - Save Changes and Persist to MongoDB
    const testUpdatedName = 'John Doe E2E';
    const testUpdatedAddress = '456 Innovation Way, Tech Park, City';

    // Clear and type new values using page.evaluate to trigger input events properly
    await page.evaluate((newName, newAddr) => {
      const nameInput = document.querySelector('input.form-input[required]');
      const addrInput = document.querySelector('textarea.form-textarea');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      const areaSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(nameInput, newName);
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      areaSetter.call(addrInput, newAddr);
      addrInput.dispatchEvent(new Event('input', { bubbles: true }));
    }, testUpdatedName, testUpdatedAddress);

    // Click Save Profile Changes
    const saveBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button[type="submit"]'));
      return btns.find(b => b.textContent.includes('Save Profile'));
    });
    await saveBtn.click();

    // Wait for notification toast
    await page.waitForSelector('.toast', { timeout: 5000 });
    const successMsg = await page.$eval('.toast span', el => el.textContent.trim());

    // Verify in MongoDB
    const dbUser = await User.findOne({ email: 'customer@hometech.demo' });
    const dbPersisted = dbUser.name === testUpdatedName && dbUser.address === testUpdatedAddress;
    report('Profile Changes Persist to MongoDB', dbPersisted, `DB Name: "${dbUser.name}", Msg: "${successMsg}"`);

    // Reload page and check UI reflects updated values
    await page.reload({ waitUntil: 'networkidle2' });
    const reloadedHeaderName = await page.$eval('.dashboard-main h1', (el) => el.textContent.trim());
    report('Profile State Persists After Browser Reload', reloadedHeaderName === testUpdatedName, `Header: "${reloadedHeaderName}"`);

    // Restore original name in DB & UI
    await User.updateOne({ email: 'customer@hometech.demo' }, { name: 'John Doe', address: originalAddress });

    // 7. Saved Addresses Tab
    const addressTabBtn = await page.waitForSelector('button.sidebar-item:nth-child(6)');
    await addressTabBtn.click();
    await page.waitForFunction(() => document.body.innerText.includes('Saved Addresses') || document.body.innerText.includes('Primary Service Address'));
    const addressFound = await page.evaluate(() => document.body.innerText.includes('Primary') || document.body.innerText.includes('Address'));
    report('Saved Addresses Tab Display', addressFound, 'Rendered address management section');

    // 8. Sidebar Navigation to My Bookings
    const bookingsNavBtn = await page.waitForSelector('button.sidebar-item:nth-child(3)');
    await bookingsNavBtn.click();
    await page.waitForFunction(() => window.location.pathname === '/customer/bookings');
    await page.waitForSelector('.filter-tab, button');
    const onBookingsPage = page.url().includes('/customer/bookings');
    const hasFilterTabs = await page.$$eval('.filter-tab, button', (btns) => btns.some(b => b.textContent.includes('All') || b.textContent.includes('Bookings')));
    report('Sidebar Navigation to My Bookings', onBookingsPage && hasFilterTabs, `URL: ${page.url()}`);

    // Return to dashboard via sidebar
    const returnDashBtn = await page.waitForSelector('button.sidebar-item:nth-child(1)');
    await returnDashBtn.click();
    await page.waitForFunction(() => window.location.pathname === '/customer/dashboard');
    const backOnDash = page.url().includes('/customer/dashboard');
    report('Sidebar Navigation Back to Dashboard', backOnDash, `URL: ${page.url()}`);

    // 9. Sidebar Navigation to Payments Page
    const paymentsNavBtn = await page.waitForSelector('button.sidebar-item:nth-child(4)');
    await paymentsNavBtn.click();
    await page.waitForFunction(() => window.location.pathname === '/customer/payments');
    const onPaymentsPage = page.url().includes('/customer/payments');
    report('Sidebar Navigation to Payments', onPaymentsPage, `URL: ${page.url()}`);

    // 10. Logout and Protected Back-Button Redirection
    const logoutBtn = await page.waitForSelector('.sidebar-footer button[style*="danger"]');
    await logoutBtn.click();
    await new Promise(r => setTimeout(r, 1000));

    const tokenAfterLogout = await page.evaluate(() => localStorage.getItem('hometech_token'));
    const loggedOutUrl = page.url();
    const logoutClean = tokenAfterLogout === null && (loggedOutUrl.endsWith('/') || loggedOutUrl.includes('/login'));
    report('Customer Logout Clears LocalStorage & Redirects', logoutClean, `Redirected to: ${loggedOutUrl}`);

    // Attempt direct navigation back to customer dashboard
    await page.goto(`${BASE_URL}/customer/dashboard`, { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => window.location.pathname.includes('/login'), { timeout: 6000 }).catch(() => {});
    const postBackUrl = page.url();
    const backProtected = postBackUrl.includes('/login');
    report('Protected Route Guards Prevent Unauthorized Access', backProtected, `Landed at: ${postBackUrl}`);

  } catch (err) {
    console.error('Test suite execution error:', err);
    report('Suite Execution Error', false, err.message);
  } finally {
    if (browser) await browser.close();
    await mongoose.disconnect();
  }

  const passedCount = results.filter(r => r.passed).length;
  console.log(`\nDashboard Suite Complete: ${passedCount}/${results.length} Passed\n`);
}

runDashboardTests();
