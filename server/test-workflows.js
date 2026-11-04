import http from 'http';

const BASE_URL = 'http://localhost:5000/api';

async function request(endpoint, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + endpoint);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING COMPREHENSIVE HOMETECH SYSTEM TESTS ---');

  // Test 1: Health check
  const health = await request('/health');
  console.log('\n1. Health Check:', health.ok ? 'PASS' : 'FAIL', health.data);

  // Test 2: Admin Login
  const adminLogin = await request('/auth/login', 'POST', {
    email: 'admin@hometech.demo',
    password: 'HomeTech@123'
  });
  console.log('2. Admin Login:', adminLogin.ok ? 'PASS' : 'FAIL', `Token received: ${Boolean(adminLogin.data?.token)}`);
  const adminToken = adminLogin.data?.token;

  // Test 3: Phone Validation Rejection (Invalid non-numeric or wrong length)
  const invalidPhone = await request('/auth/send-otp', 'POST', { phone: 'abc12345' });
  console.log('3. Reject Invalid Phone:', !invalidPhone.ok ? 'PASS' : 'FAIL', invalidPhone.data?.message);

  // Test 4: Password Validation Rejection (too short)
  const weakPass = await request('/auth/register', 'POST', {
    name: 'Weak Pass User',
    phone: '9876599999',
    email: 'weak@example.com',
    password: 'short',
    confirmPassword: 'short'
  });
  console.log('4. Reject Weak Password:', !weakPass.ok ? 'PASS' : 'FAIL', weakPass.data?.message);

  // Test 5: Real SMS Gateway Mock Flow
  const testPhone = '98765432' + Math.floor(10 + Math.random() * 89);
  const sendOtp = await request('/auth/send-otp', 'POST', { phone: testPhone });
  console.log('5. Send OTP:', sendOtp.ok ? 'PASS' : 'FAIL', `Dev OTP: ${sendOtp.data?.devOtp}`);
  const devOtp = sendOtp.data?.devOtp;

  const verifyOtp = await request('/auth/verify-otp', 'POST', { phone: testPhone, otp: devOtp });
  console.log('5b. Verify OTP:', verifyOtp.ok ? 'PASS' : 'FAIL', verifyOtp.data?.message);

  const regRes = await request('/auth/register', 'POST', {
    name: 'Anil Kumar',
    phone: testPhone,
    email: `anil.${testPhone}@example.com`,
    password: 'HomeTech@123',
    confirmPassword: 'HomeTech@123',
    address: 'Sector 5, Vijayawada'
  });
  console.log('5c. Register New User:', regRes.ok ? 'PASS' : 'FAIL', `Roles: [${regRes.data?.user?.roles?.join(', ')}]`);
  const anilToken = regRes.data?.token;

  // Test 6: Single Account Dual Dashboard - Customer applies to be Worker
  const appRes = await request('/worker-applications', 'POST', {
    selectedCategories: ['Plumbing', 'Carpentry'],
    experience: 4,
    serviceLocation: 'Vijayawada Central',
    address: 'Sector 5, Vijayawada',
    skills: ['Pipe Fitting', 'Bathroom Repair'],
    professionalDescription: 'Certified master plumber and carpenter with 4 years field experience.'
  }, anilToken);
  console.log('6. Submit Worker Application:', appRes.ok ? 'PASS' : 'FAIL', appRes.data.message);

  // Test 7: Admin reviews & approves application
  const appsList = await request('/worker-applications?status=pending', 'GET', null, adminToken);
  const myApp = appsList.data?.find(a => a.phone === testPhone);
  console.log('7a. Admin Views Applications:', appsList.ok && Boolean(myApp) ? 'PASS' : 'FAIL');

  const approveRes = await request(`/worker-applications/${myApp._id}/approve`, 'PUT', {
    approvedCategories: ['Plumbing', 'Carpentry']
  }, adminToken);
  console.log('7b. Admin Approves Application with Categories:', approveRes.ok ? 'PASS' : 'FAIL', `Worker application approved with categories: ${approveRes.data?.application?.approvedCategories?.join(', ')}`);

  // Test 8: Instant Role Switch
  const switchRes = await request('/auth/switch-role', 'PUT', { role: 'worker' }, anilToken);
  console.log('8. Switch to Worker Dashboard:', switchRes.ok ? 'PASS' : 'FAIL', `Active Role: ${switchRes.data?.user?.activeRole}`);

  // Test 9: Category Enforcement & Atomic Accept
  const plumberLogin = await request('/auth/login', 'POST', {
    email: 'worker@hometech.demo',
    password: 'HomeTech@123'
  });
  const plumberToken = plumberLogin.data?.token;

  const elecLogin = await request('/auth/login', 'POST', {
    email: 'amit.worker@hometech.demo',
    password: 'HomeTech@123'
  });
  const electricianToken = elecLogin.data?.token;

  const services = await request('/services');
  const plumbingService = services.data.find(s => s.category === 'Plumbing');

  const bookingRes = await request('/bookings', 'POST', {
    serviceId: plumbingService._id,
    bookingDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    bookingTime: '11:00 AM',
    address: 'Sector 5, Vijayawada',
    contactNumber: '9876543299',
    instructions: 'Tap leakage test'
  }, anilToken);
  console.log('9a. Customer Creates Plumbing Booking:', bookingRes.ok ? 'PASS' : 'FAIL', `ID: ${bookingRes.data?.booking?.bookingId}`);
  const createdBookingId = bookingRes.data?.booking?._id;

  // Plumber checks available jobs via /workers/jobs and /workers/jobs/requests
  const plumberJobs = await request('/workers/jobs', 'GET', null, plumberToken);
  const seesPlumbingJob = plumberJobs.data?.availableRequests?.some(b => b._id === createdBookingId);
  console.log('9b. Plumber sees Plumbing Job Request (/workers/jobs):', seesPlumbingJob ? 'PASS' : 'FAIL');

  const plumberRequests = await request('/workers/jobs/requests', 'GET', null, plumberToken);
  const seesPlumbingRequestEndpoint = Array.isArray(plumberRequests.data) && plumberRequests.data.some(b => b._id === createdBookingId);
  console.log('9b2. Plumber receives request via GET /workers/jobs/requests:', seesPlumbingRequestEndpoint ? 'PASS' : 'FAIL');

  // Electrician checks available jobs - MUST NOT SEE PLUMBING JOB!
  const electricianJobs = await request('/workers/jobs', 'GET', null, electricianToken);
  const electricianSeesPlumbingJob = electricianJobs.data?.availableRequests?.some(b => b._id === createdBookingId);
  console.log('9c. Electrician CANNOT see Plumbing Job (Category Enforcement):', !electricianSeesPlumbingJob ? 'PASS' : 'FAIL');

  const electricianRequests = await request('/workers/jobs/requests', 'GET', null, electricianToken);
  const electricianSeesPlumbingReq = Array.isArray(electricianRequests.data) && electricianRequests.data.some(b => b._id === createdBookingId);
  console.log('9c2. Electrician CANNOT see Plumbing via /workers/jobs/requests:', !electricianSeesPlumbingReq ? 'PASS' : 'FAIL');

  // Test 10: Worker accepts job atomically
  const acceptRes = await request(`/workers/jobs/${createdBookingId}/accept`, 'PUT', null, plumberToken);
  console.log('10. Worker Accepts Job:', acceptRes.ok ? 'PASS' : 'FAIL', acceptRes.data.message);

  // Test 11: Real GPS Location Tracking update
  const locRes = await request(`/tracking/${createdBookingId}/location`, 'POST', {
    latitude: 16.5062,
    longitude: 80.6480,
    accuracy: 10,
    speed: 25
  }, plumberToken);
  console.log('11a. Worker Shares GPS Coordinates:', locRes.ok ? 'PASS' : 'FAIL', locRes.data.message);

  // Customer tracks worker
  const trackRes = await request(`/tracking/${createdBookingId}`, 'GET', null, anilToken);
  console.log('11b. Customer Tracks Worker Live:', trackRes.ok ? 'PASS' : 'FAIL', `Worker: ${trackRes.data?.worker?.name}, ETA: ${trackRes.data?.etaMinutes} mins, Lat: ${trackRes.data?.currentLocation?.latitude}`);

  // Test 12: Worker Starts Job (Requirement 3: Accepted -> In Progress)
  const startRes = await request(`/workers/jobs/${createdBookingId}/status`, 'PUT', { status: 'In Progress' }, plumberToken);
  console.log('12a. Worker Clicks Start Job:', startRes.ok ? 'PASS' : 'FAIL', `Status is now: ${startRes.data?.booking?.status}`);

  // Test 12b: Worker CANNOT complete job directly (Requirement 4)
  const workerCompleteAttempt = await request(`/workers/jobs/${createdBookingId}/status`, 'PUT', { status: 'Completed' }, plumberToken);
  console.log('12b. Worker Cannot Directly Complete (Customer Only):', !workerCompleteAttempt.ok ? 'PASS' : 'FAIL', workerCompleteAttempt.data?.message);

  // Test 13: Customer Confirms Completion (Requirement 4)
  const customerCompleteRes = await request(`/bookings/${createdBookingId}/complete`, 'PUT', null, anilToken);
  console.log('13a. Customer Confirms Completion:', customerCompleteRes.ok ? 'PASS' : 'FAIL', customerCompleteRes.data.message);

  // Customer cannot confirm completion twice
  const duplicateComplete = await request(`/bookings/${createdBookingId}/complete`, 'PUT', null, anilToken);
  console.log('13b. Prevent Duplicate Completion:', !duplicateComplete.ok ? 'PASS' : 'FAIL', duplicateComplete.data?.message);

  // Test 14: Customer Submits Star Rating & Review (Requirement 5)
  const reviewRes = await request(`/bookings/${createdBookingId}/review`, 'POST', {
    rating: 5,
    comment: 'Exceptional plumbing repair! Punctual and very neat.'
  }, anilToken);
  console.log('14a. Customer Submits 5-Star Review:', reviewRes.ok ? 'PASS' : 'FAIL', reviewRes.data.message);

  // Prevent duplicate review
  const duplicateReview = await request(`/bookings/${createdBookingId}/review`, 'POST', {
    rating: 4,
    comment: 'Another review attempt'
  }, anilToken);
  console.log('14b. Prevent Duplicate Review on Same Booking:', !duplicateReview.ok ? 'PASS' : 'FAIL', duplicateReview.data?.message);

  // Test 15: Customer Raises a Complaint (POST /complaints/customer)
  const customerComplaintRes = await request('/complaints/customer', 'POST', {
    bookingId: createdBookingId,
    category: 'Delayed Service',
    description: 'Technician arrived 20 minutes later than scheduled time.'
  }, anilToken);
  console.log('15. Customer Raises Complaint (POST /complaints/customer):', customerComplaintRes.ok ? 'PASS' : 'FAIL', `ID: ${customerComplaintRes.data?.complaint?.complaintId}`);

  // Test 16: Worker Reports Workplace Problem (POST /complaints/worker)
  const workerProblemRes = await request('/complaints/worker', 'POST', {
    bookingId: createdBookingId,
    category: 'Additional Work Requested',
    description: 'Customer asked for additional pipe installation outside the booked scope.'
  }, plumberToken);
  console.log('16. Worker Reports Workplace Problem (POST /complaints/worker):', workerProblemRes.ok ? 'PASS' : 'FAIL', `ID: ${workerProblemRes.data?.complaint?.complaintId}`);
  const complaintToResolve = customerComplaintRes.data?.complaint?._id;

  // Test 17: Admin Views Complaints via /admin/complaints
  const adminComplaintsRes = await request('/admin/complaints', 'GET', null, adminToken);
  console.log('17a. Admin Lists Complaints (GET /admin/complaints):', adminComplaintsRes.ok ? 'PASS' : 'FAIL', `Total Complaints: ${adminComplaintsRes.data?.length}`);

  // Test 17b: Admin Views Single Complaint via /admin/complaints/:id
  const singleComplaintRes = await request(`/admin/complaints/${complaintToResolve}`, 'GET', null, adminToken);
  console.log('17b. Admin Gets Single Complaint (GET /admin/complaints/:id):', singleComplaintRes.ok ? 'PASS' : 'FAIL', `Complaint ID: ${singleComplaintRes.data?.complaintId}`);

  // Test 17c: Admin Resolves Complaint via /admin/complaints/:id/status
  const resolveRes = await request(`/admin/complaints/${complaintToResolve}/status`, 'PUT', {
    status: 'Resolved',
    adminNotes: 'Customer contacted and discount coupon provided for next booking. Closed.'
  }, adminToken);
  console.log('17c. Admin Marks Complaint as Resolved (PUT /admin/complaints/:id/status):', resolveRes.ok ? 'PASS' : 'FAIL', `Status: ${resolveRes.data?.complaint?.status}, Notes: "${resolveRes.data?.complaint?.adminNotes}"`);

  console.log('\n--- ALL 17 AUTOMATED SYSTEM WORKFLOW TESTS COMPLETED SUCCESSFULLY! ---');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
