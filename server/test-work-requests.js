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

function assert(condition, message) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`[PASS] ${message}`);
}

async function runComprehensiveTests() {
  console.log('================================================================');
  console.log('STARTING WORKER REQUEST & DISPATCH VERIFICATION TEST SUITE');
  console.log('================================================================\n');

  // 1. Log in Customer, Worker A, Worker B, Worker C, and Admin
  console.log('--- 1. AUTHENTICATING TEST ACCOUNTS ---');
  const custLogin = await request('/auth/login', 'POST', { email: 'customer@hometech.demo', password: 'HomeTech@123' });
  assert(custLogin.ok, 'Customer logged in successfully');
  const customerToken = custLogin.data.token;

  const workerALogin = await request('/auth/login', 'POST', { email: 'worker@hometech.demo', password: 'HomeTech@123' });
  assert(workerALogin.ok, 'Worker A (Plumbing) logged in successfully');
  const workerAToken = workerALogin.data.token;
  const workerAId = workerALogin.data.user._id;

  const workerBLogin = await request('/auth/login', 'POST', { email: 'amit.worker@hometech.demo', password: 'HomeTech@123' });
  assert(workerBLogin.ok, 'Worker B (Electrical) logged in successfully');
  const workerBToken = workerBLogin.data.token;

  const workerCLogin = await request('/auth/login', 'POST', { email: 'workerc@hometech.demo', password: 'HomeTech@123' });
  assert(workerCLogin.ok, 'Worker C (Plumbing & Carpentry) logged in successfully');
  const workerCToken = workerCLogin.data.token;
  const workerCId = workerCLogin.data.user._id;

  const adminLogin = await request('/auth/login', 'POST', { email: 'admin@hometech.demo', password: 'HomeTech@123' });
  assert(adminLogin.ok, 'Admin logged in successfully');
  const adminToken = adminLogin.data.token;

  // Retrieve plumbing service ID
  const servicesRes = await request('/services');
  assert(servicesRes.ok, 'Services list retrieved');
  const plumbingService = servicesRes.data.find(s => s.category === 'Plumbing');
  assert(Boolean(plumbingService), 'Plumbing service found in catalog');

  // 2. Customer books a Plumbing service
  console.log('\n--- 2. CUSTOMER CREATES PLUMBING BOOKING ---');
  const booking1Res = await request('/bookings', 'POST', {
    serviceId: plumbingService._id,
    bookingDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    bookingTime: '10:00 AM',
    address: '42, Park Avenue, Vijayawada',
    contactNumber: '9876543210',
    instructions: 'Kitchen faucet pipe leak'
  }, customerToken);

  assert(booking1Res.ok, `Booking created: ${booking1Res.data?.booking?.bookingId}`);
  assert(booking1Res.data?.booking?.status === 'Pending', 'Booking status is Pending');
  assert(booking1Res.data?.eligibleWorkerCount >= 2, `Eligible workers found: ${booking1Res.data?.eligibleWorkerCount} (Expected >= 2)`);
  assert(booking1Res.data?.workRequestsCreated >= 2, `WorkRequest documents created in MongoDB: ${booking1Res.data?.workRequestsCreated}`);
  const booking1Id = booking1Res.data?.booking?._id;

  // 3. Worker A (Plumbing) checks requests
  console.log('\n--- 3. WORKER A CHECKS WORK REQUESTS ---');
  const workerARequests = await request('/work-requests/my', 'GET', null, workerAToken);
  assert(workerARequests.ok, 'Worker A retrieved pending work requests');
  const workerARequestForB1 = workerARequests.data.find(r => r.bookingId?._id === booking1Id || r.bookingId === booking1Id);
  assert(Boolean(workerARequestForB1), 'Worker A received the Plumbing work request in MongoDB');
  assert(workerARequestForB1.category === 'Plumbing', 'Work request category matches Plumbing');

  // 4. Worker B (Electrical) checks requests - MUST NOT RECEIVE PLUMBING
  console.log('\n--- 4. WORKER B (ELECTRICAL) STRICT EXCLUSION CHECK ---');
  const workerBRequests = await request('/work-requests/my', 'GET', null, workerBToken);
  assert(workerBRequests.ok, 'Worker B retrieved work requests');
  const workerBHasPlumbing = workerBRequests.data.some(r => r.bookingId?._id === booking1Id || r.bookingId === booking1Id);
  assert(!workerBHasPlumbing, 'Worker B (Electrical) did NOT receive Plumbing request (Strict Category Enforcement)');

  // 5. Worker C (Plumbing & Carpentry) checks requests - MUST RECEIVE PLUMBING
  console.log('\n--- 5. WORKER C (PLUMBING & CARPENTRY) CHECK ---');
  const workerCRequests = await request('/work-requests/my', 'GET', null, workerCToken);
  assert(workerCRequests.ok, 'Worker C retrieved pending work requests');
  const workerCRequestForB1 = workerCRequests.data.find(r => r.bookingId?._id === booking1Id || r.bookingId === booking1Id);
  assert(Boolean(workerCRequestForB1), 'Worker C received the Plumbing work request in MongoDB');

  // 6. Persistence Test - Requests survive dashboard refresh / re-query
  console.log('\n--- 6. PERSISTENCE CHECK (REFRESH TEST) ---');
  const workerARefresh = await request('/work-requests/my', 'GET', null, workerAToken);
  assert(workerARefresh.data.some(r => r._id === workerARequestForB1._id), 'Worker A still sees request after refresh');
  const workerCRefresh = await request('/work-requests/my', 'GET', null, workerCToken);
  assert(workerCRefresh.data.some(r => r._id === workerCRequestForB1._id), 'Worker C still sees request after refresh');

  // Also verify /workers/jobs/requests endpoint returns identical data
  const workerAJobsRequests = await request('/workers/jobs/requests', 'GET', null, workerAToken);
  assert(workerAJobsRequests.ok && workerAJobsRequests.data.some(b => b._id === booking1Id || b.workRequestId === workerARequestForB1._id), 'GET /workers/jobs/requests returns pending request');

  // 7. Worker A accepts the request
  console.log('\n--- 7. WORKER A ACCEPTS WORK REQUEST ---');
  const acceptRes = await request(`/work-requests/${workerARequestForB1._id}/accept`, 'PUT', null, workerAToken);
  assert(acceptRes.ok, `Worker A accepted: ${acceptRes.data?.message}`);
  assert(acceptRes.data?.booking?.status === 'Accepted', 'Booking status is now Accepted');
  assert(acceptRes.data?.booking?.workerId?._id === workerAId || acceptRes.data?.booking?.workerId === workerAId, 'Booking assigned to Worker A');

  // 8. Confirm Worker C request is now CANCELLED and disappears from pending list
  console.log('\n--- 8. WORKER C REQUEST CANCELLATION CHECK ---');
  const workerCAfterAccept = await request('/work-requests/my', 'GET', null, workerCToken);
  const workerCStillHasB1 = workerCAfterAccept.data.some(r => r._id === workerCRequestForB1._id);
  assert(!workerCStillHasB1, "Worker C pending request was automatically cancelled when Worker A accepted");

  // 9. Customer views booking and sees assigned worker
  console.log('\n--- 9. CUSTOMER SEES ASSIGNED WORKER ---');
  const customerBookingView = await request(`/bookings/${booking1Id}`, 'GET', null, customerToken);
  assert(customerBookingView.ok, 'Customer retrieved booking details');
  assert(customerBookingView.data?.workerId?._id === workerAId, `Customer sees assigned worker: ${customerBookingView.data?.workerId?.name}`);

  // 10. Worker Offline test: Booking created while worker is not active on socket
  console.log('\n--- 10. WORKER OFFLINE SIMULATION ---');
  const booking2Res = await request('/bookings', 'POST', {
    serviceId: plumbingService._id,
    bookingDate: new Date(Date.now() + 172800000).toISOString().split('T')[0],
    bookingTime: '02:00 PM',
    address: '15, Marina Beach Road, Vijayawada',
    contactNumber: '9876543210',
    instructions: 'Main valve replacement'
  }, customerToken);
  assert(booking2Res.ok, `Booking 2 created: ${booking2Res.data?.booking?.bookingId}`);
  const booking2Id = booking2Res.data?.booking?._id;

  // Worker C "reconnects" and queries API
  const workerCOfflineRecover = await request('/work-requests/my', 'GET', null, workerCToken);
  const workerCHasB2 = workerCOfflineRecover.data.find(r => r.bookingId?._id === booking2Id || r.bookingId === booking2Id);
  assert(Boolean(workerCHasB2), 'Worker C retrieved pending request created while offline');

  // 11. Worker rejection test
  console.log('\n--- 11. WORKER REJECTS REQUEST TEST ---');
  const workerARequestsB2 = await request('/work-requests/my', 'GET', null, workerAToken);
  const workerAReqB2 = workerARequestsB2.data.find(r => r.bookingId?._id === booking2Id || r.bookingId === booking2Id);
  assert(Boolean(workerAReqB2), 'Worker A received Booking 2 request');

  const rejectRes = await request(`/work-requests/${workerAReqB2._id}/reject`, 'PUT', null, workerAToken);
  assert(rejectRes.ok, `Worker A declined request: ${rejectRes.data?.message}`);

  // Worker A no longer sees it in pending requests
  const workerAAfRej = await request('/work-requests/my', 'GET', null, workerAToken);
  assert(!workerAAfRej.data.some(r => r._id === workerAReqB2._id), 'Declined request removed from Worker A pending list');

  // Worker C can STILL accept it!
  const workerCAcceptB2 = await request(`/work-requests/${workerCHasB2._id}/accept`, 'PUT', null, workerCToken);
  assert(workerCAcceptB2.ok, `Worker C successfully accepted Booking 2 after Worker A rejected: ${workerCAcceptB2.data?.message}`);
  assert(workerCAcceptB2.data?.booking?.workerId?._id === workerCId || workerCAcceptB2.data?.booking?.workerId === workerCId, 'Booking 2 successfully assigned to Worker C');

  // 12. Simultaneous Accept Race Condition Test
  console.log('\n--- 12. SIMULTANEOUS ACCEPT CONCURRENCY TEST ---');
  const booking3Res = await request('/bookings', 'POST', {
    serviceId: plumbingService._id,
    bookingDate: new Date(Date.now() + 259200000).toISOString().split('T')[0],
    bookingTime: '04:00 PM',
    address: '88, Ring Road, Vijayawada',
    contactNumber: '9876543210',
    instructions: 'Drain block removal'
  }, customerToken);
  assert(booking3Res.ok, `Booking 3 created: ${booking3Res.data?.booking?.bookingId}`);
  const booking3Id = booking3Res.data?.booking?._id;

  const wAReqs3 = await request('/work-requests/my', 'GET', null, workerAToken);
  const wCReqs3 = await request('/work-requests/my', 'GET', null, workerCToken);
  const wAReq3 = wAReqs3.data.find(r => r.bookingId?._id === booking3Id || r.bookingId === booking3Id);
  const wCReq3 = wCReqs3.data.find(r => r.bookingId?._id === booking3Id || r.bookingId === booking3Id);
  assert(Boolean(wAReq3 && wCReq3), 'Both Worker A and Worker C have pending requests for Booking 3');

  // Fire both accept requests simultaneously
  const [resA, resC] = await Promise.all([
    request(`/work-requests/${wAReq3._id}/accept`, 'PUT', null, workerAToken),
    request(`/work-requests/${wCReq3._id}/accept`, 'PUT', null, workerCToken)
  ]);

  const oneSucceeded = (resA.ok && !resC.ok && resC.status === 409) || (!resA.ok && resA.status === 409 && resC.ok);
  assert(oneSucceeded, `Concurrency guard verified: Exactly one worker succeeded, the other received HTTP 409 Conflict (Worker A status: ${resA.status}, Worker C status: ${resC.status})`);

  // 13. Admin Diagnostics Endpoint Verification
  console.log('\n--- 13. ADMIN DIAGNOSTICS ENDPOINT CHECK ---');
  const diagRes = await request('/admin/diagnostics/work-distribution', 'GET', null, adminToken);
  assert(diagRes.ok, 'Admin retrieved work distribution diagnostics');
  const d = diagRes.data.diagnostics;
  console.log('Diagnostic Summary:', {
    totalApprovedWorkers: d.totalApprovedWorkers,
    activeWorkers: d.activeWorkers,
    availableWorkers: d.availableWorkers,
    totalWorkRequests: d.totalWorkRequests,
    pendingWorkRequests: d.pendingWorkRequests,
    acceptedWorkRequests: d.acceptedWorkRequests,
    rejectedWorkRequests: d.rejectedWorkRequests,
    cancelledWorkRequests: d.cancelledWorkRequests,
    bookingsWithoutMatchingWorkers: d.bookingsWithoutMatchingWorkersCount
  });
  assert(d.totalApprovedWorkers >= 3, 'Diagnostic accurately reports approved workers count >= 3');
  assert(d.totalWorkRequests >= 4, 'Diagnostic accurately reports total WorkRequest count >= 4');
  assert(d.acceptedWorkRequests >= 2, 'Diagnostic accurately reports accepted WorkRequest count >= 2');

  console.log('\n================================================================');
  console.log('ALL WORKER REQUEST & DISPATCH TESTS PASSED PERFECTLY!');
  console.log('================================================================');
}

runComprehensiveTests().catch(err => {
  console.error('\nTest Suite Failed:', err);
  process.exit(1);
});
