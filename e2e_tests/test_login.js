import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Users\\DELL\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5173';

export async function runLoginTests() {
  console.log('--------------------------------------------------');
  console.log('SUITE 2: CUSTOMER LOGIN TESTING IN CHROME');
  console.log('--------------------------------------------------');

  const results = [];
  const recordResult = (name, passed, details = '') => {
    results.push({ name, passed, details });
    console.log(`${passed ? '✓ PASS' : '✗ FAIL'}: ${name} ${details ? '(' + details + ')' : ''}`);
  };

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  try {
    // Test 2.1: Open Login Page
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    const content = await page.content();
    const hasLogin = content.includes('Welcome Back') || content.includes('Login');
    recordResult('Open Customer Login Page', hasLogin, 'Login page rendered');

    // Test 2.2: Submit empty fields
    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) await submitBtn.click();
    await new Promise(r => setTimeout(r, 400));
    const isFormInvalid = await page.evaluate(() => {
      const form = document.querySelector('form');
      return form ? !form.checkValidity() : false;
    });
    recordResult('Empty Fields Form Validation', isFormInvalid, 'Required field browser validation triggered');

    // Test 2.3: Invalid email format
    let emailInput = await page.$('input[type="email"]');
    let passInput = await page.$('input[type="password"]');
    if (emailInput && passInput) {
      await emailInput.type('notanemail');
      await passInput.type('HomeTech@123');
      const isEmailInvalid = await page.evaluate(() => {
        const emailEl = document.querySelector('input[type="email"]');
        return emailEl ? !emailEl.checkValidity() : false;
      });
      recordResult('Invalid Email Format Rejected', isEmailInvalid, 'Type="email" checkValidity failed for invalid email');
      
      // Clear inputs with backspaces
      await page.focus('input[type="email"]');
      await page.keyboard.down('Control');
      await page.keyboard.press('A');
      await page.keyboard.up('Control');
      await page.keyboard.press('Backspace');

      await page.focus('input[type="password"]');
      await page.keyboard.down('Control');
      await page.keyboard.press('A');
      await page.keyboard.up('Control');
      await page.keyboard.press('Backspace');
    }

    // Test 2.4: Unregistered email
    emailInput = await page.$('input[type="email"]');
    passInput = await page.$('input[type="password"]');
    await emailInput.type('unregistered.ghost@hometech.demo');
    await passInput.type('HomeTech@123');
    await submitBtn.click();
    await new Promise(r => setTimeout(r, 800));
    const unregToast = await page.evaluate(() => document.querySelector('.toast')?.innerText || document.body.innerText);
    const unregCaught = unregToast.includes('Invalid email or password') || unregToast.includes('No registered account');
    recordResult('Unregistered Email Rejected', unregCaught, 'Appropriate error notification displayed');

    // Clear inputs with backspaces
    await page.focus('input[type="email"]');
    await page.keyboard.down('Control');
    await page.keyboard.press('A');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');

    await page.focus('input[type="password"]');
    await page.keyboard.down('Control');
    await page.keyboard.press('A');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');

    // Test 2.5: Incorrect password for existing customer
    await emailInput.type('customer@hometech.demo');
    await passInput.type('WrongPassword@999');
    await submitBtn.click();
    await new Promise(r => setTimeout(r, 800));
    const badPassToast = await page.evaluate(() => document.querySelector('.toast')?.innerText || document.body.innerText);
    const badPassCaught = badPassToast.includes('Invalid email or password');
    recordResult('Incorrect Password Rejected', badPassCaught, 'Authentication error notification displayed');

    // Test 2.6: Password visibility toggle
    const typeBefore = await page.evaluate(() => document.querySelector('input[placeholder*="password" i]')?.type);
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const eyeBtn = btns.find(b => b.querySelector('svg.lucide-eye, svg.lucide-eye-off'));
      if (eyeBtn) eyeBtn.click();
    });
    await new Promise(r => setTimeout(r, 200));
    const typeAfter = await page.evaluate(() => document.querySelector('input[placeholder*="password" i]')?.type);
    const toggleWorked = (typeBefore === 'password' && typeAfter === 'text') || (typeBefore !== typeAfter);
    recordResult('Password Visibility Toggle', toggleWorked, `Toggled from ${typeBefore} to ${typeAfter}`);

    // Toggle back to password
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const eyeBtn = btns.find(b => b.querySelector('svg.lucide-eye, svg.lucide-eye-off'));
      if (eyeBtn) eyeBtn.click();
    });

    // Clear and enter correct password
    await page.evaluate(() => {
      const pInput = document.querySelector('input[placeholder*="password" i]');
      if (pInput) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(pInput, '');
        pInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    const currentPassEl = await page.$('input[placeholder*="password" i]');
    await currentPassEl.type('HomeTech@123');

    // Test 2.7: Enter key submission with valid credentials
    await page.keyboard.press('Enter');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 1200));

    // Test 2.8: Redirection to Customer Dashboard
    const currentUrl = page.url();
    const redirectedToDashboard = currentUrl.includes('/customer/dashboard');
    recordResult('Enter Key Submission & Redirection to Dashboard', redirectedToDashboard, `Current URL: ${currentUrl}`);

    // Test 2.9: JWT Token and user persistence in localStorage
    const authState = await page.evaluate(() => ({
      token: localStorage.getItem('hometech_token'),
      user: JSON.parse(localStorage.getItem('hometech_user') || 'null')
    }));
    const tokenPersisted = Boolean(authState.token && authState.user?.email === 'customer@hometech.demo');
    recordResult('JWT Token & User Persistence in localStorage', tokenPersisted, `Token exists: ${Boolean(authState.token)}`);

    // Test 2.10: Refresh browser after login
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1000));
    const urlAfterReload = page.url();
    const stillOnDashboard = urlAfterReload.includes('/customer/dashboard');
    const userGreeting = await page.evaluate(() => document.body.innerText);
    const sessionMaintained = stillOnDashboard && (userGreeting.includes('John') || userGreeting.includes('Customer'));
    recordResult('Session Maintained After Browser Refresh', sessionMaintained, 'Customer remained logged in on dashboard');

    // Test 2.11: Unauthorized Access to Protected Pages in clean session
    const incognitoContext = await browser.createBrowserContext();
    const cleanPage = await incognitoContext.newPage();
    await cleanPage.goto(`${BASE_URL}/customer/dashboard`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 600));
    const cleanUrl = cleanPage.url();
    const blockedUnauth = cleanUrl.includes('/login');
    recordResult('Protected Route Guards Enforce Authentication', blockedUnauth, `Redirected unauthenticated user to: ${cleanUrl}`);
    await incognitoContext.close();

  } catch (err) {
    console.error('Login suite error:', err);
    recordResult('Login Suite Execution', false, err.message);
  } finally {
    await browser.close();
  }

  return results;
}

if (process.argv[1]?.endsWith('test_login.js')) {
  runLoginTests().then(res => {
    const passed = res.filter(r => r.passed).length;
    console.log(`\nLogin Suite Complete: ${passed}/${res.length} Passed`);
    process.exit(passed === res.length ? 0 : 1);
  });
}
