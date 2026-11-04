import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../api';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';

const DashboardContext = createContext(null);

export function DashboardProvider({ children }) {
  const { user, notify } = useAuth();
  const socket = useSocket();

  // --- Customer State ---
  const [customerBookings, setCustomerBookings] = useState([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerError, setCustomerError] = useState(null);
  const [customerInitialized, setCustomerInitialized] = useState(false);
  const [activeArrivalOtps, setActiveArrivalOtps] = useState({}); // { [bookingId]: { otp, expiresAt, resendCooldownUntil } }

  // --- Worker State ---
  const [workerRequests, setWorkerRequests] = useState([]);
  const [acceptedWorkerJobs, setAcceptedWorkerJobs] = useState([]);
  const [ongoingWorkerJobs, setOngoingWorkerJobs] = useState([]);
  const [completedWorkerJobs, setCompletedWorkerJobs] = useState([]);
  const [workerProfile, setWorkerProfile] = useState(null);
  const [workerLoading, setWorkerLoading] = useState(false);
  const [workerError, setWorkerError] = useState(null);
  const [workerInitialized, setWorkerInitialized] = useState(false);

  // Keep track of active user ID to clear cache only on actual logout/account switch
  const currentUserIdRef = useRef(user?._id);

  // Clear or re-init state when user account changes
  useEffect(() => {
    if (!user) {
      setCustomerBookings([]);
      setCustomerInitialized(false);
      setWorkerRequests([]);
      setAcceptedWorkerJobs([]);
      setOngoingWorkerJobs([]);
      setCompletedWorkerJobs([]);
      setWorkerProfile(null);
      setWorkerInitialized(false);
      setActiveArrivalOtps({});
      currentUserIdRef.current = null;
    } else if (currentUserIdRef.current !== user._id) {
      currentUserIdRef.current = user._id;
      setCustomerBookings([]);
      setCustomerInitialized(false);
      setWorkerRequests([]);
      setAcceptedWorkerJobs([]);
      setOngoingWorkerJobs([]);
      setCompletedWorkerJobs([]);
      setWorkerProfile(null);
      setWorkerInitialized(false);
      setActiveArrivalOtps({});
    }
  }, [user?._id]);

  // --- Customer Fetch ---
  const fetchCustomerBookings = useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) setCustomerLoading(true);
    setCustomerError(null);
    try {
      const { data } = await api.get('/bookings/my');
      setCustomerBookings(Array.isArray(data) ? data : []);
      setCustomerInitialized(true);

      // Check for any booking in 'Awaiting Arrival Verification' to fetch OTP
      if (Array.isArray(data)) {
        data.forEach((b) => {
          if (b.status === 'Awaiting Arrival Verification') {
            api.get(`/bookings/${b._id}/arrival-verification`)
              .then(({ data: otpRes }) => {
                if (otpRes?.otp) {
                  setActiveArrivalOtps((prev) => ({
                    ...prev,
                    [b._id]: {
                      otp: otpRes.otp,
                      expiresAt: otpRes.expiresAt,
                      resendCooldownUntil: otpRes.resendCooldownUntil
                    }
                  }));
                }
              })
              .catch(() => {});
          }
        });
      }
    } catch (err) {
      console.error('Failed to fetch customer bookings:', err);
      setCustomerError(err.response?.data?.message || 'Failed to load bookings');
    } finally {
      if (!silent) setCustomerLoading(false);
    }
  }, [user]);

  // --- Worker Fetch ---
  const fetchWorkerJobs = useCallback(async (silent = false) => {
    if (!user || !user.roles?.includes('worker') || user.workerStatus !== 'approved') return;
    if (!silent) setWorkerLoading(true);
    setWorkerError(null);
    try {
      const [jobsRes, profRes, wrRes] = await Promise.allSettled([
        api.get('/workers/jobs'),
        api.get('/workers/profile'),
        api.get('/work-requests/my')
      ]);

      if (profRes.status === 'fulfilled') {
        setWorkerProfile(profRes.value.data);
      }

      let requests = [];
      let accepted = [];
      let ongoing = [];
      let completed = [];

      if (jobsRes.status === 'fulfilled' && jobsRes.value.data) {
        const jd = jobsRes.value.data;
        requests = jd.requests || jd.availableRequests || [];
        const allAssigned = jd.assignedJobs || [];
        accepted = jd.accepted || allAssigned.filter((j) => ['Accepted', 'Awaiting Arrival Verification', 'Assigned'].includes(j.status));
        ongoing = jd.ongoing || allAssigned.filter((j) => j.status === 'In Progress');
        completed = jd.history || jd.completedJobs || [];
      }

      // Merge persistent WorkRequests if returned
      if (wrRes.status === 'fulfilled' && Array.isArray(wrRes.value.data) && wrRes.value.data.length > 0) {
        const formatted = wrRes.value.data
          .filter((wr) => wr.bookingId && ['Pending', 'Confirmed'].includes(wr.bookingId.status) && !wr.bookingId.workerId)
          .map((wr) => {
            const b = wr.bookingId && typeof wr.bookingId === 'object' ? wr.bookingId : {};
            return {
              ...b,
              _id: b._id || wr._id,
              workRequestId: wr._id,
              customerId: wr.customerId || b.customerId,
              serviceId: wr.serviceId || b.serviceId
            };
          });
        if (formatted.length > 0) {
          // De-duplicate by _id
          const seenIds = new Set();
          const combined = [];
          [...formatted, ...requests].forEach((r) => {
            const id = r._id?.toString() || r.bookingId?.toString();
            if (id && !seenIds.has(id)) {
              seenIds.add(id);
              combined.push(r);
            }
          });
          requests = combined;
        }
      }

      setWorkerRequests(requests);
      setAcceptedWorkerJobs(accepted);
      setOngoingWorkerJobs(ongoing);
      setCompletedWorkerJobs(completed);
      setWorkerInitialized(true);
    } catch (err) {
      console.error('Failed to fetch worker jobs:', err);
      setWorkerError(err.response?.data?.message || 'Failed to load worker jobs');
    } finally {
      if (!silent) setWorkerLoading(false);
    }
  }, [user]);

  // Initial fetch on mount or when user loads
  useEffect(() => {
    if (user?._id) {
      fetchCustomerBookings(true);
      if (user.roles?.includes('worker') && user.workerStatus === 'approved') {
        fetchWorkerJobs(true);
      }
    }
  }, [user?._id, fetchCustomerBookings, fetchWorkerJobs]);

  // --- Real-time Socket.IO Listeners ---
  useEffect(() => {
    if (!socket || !user?._id) return;

    // Join rooms
    socket.emit('join-customer-room', { customerId: user._id });
    if (user.roles?.includes('worker') && user.workerStatus === 'approved') {
      socket.emit('join-worker-room', { workerId: user._id });
    }

    // 1. Arrival OTP Generated (Customer receives OTP code)
    const handleArrivalOtpGenerated = (payload) => {
      console.log('[SOCKET] arrival-otp-generated received:', payload);
      if (payload && payload.bookingId) {
        setActiveArrivalOtps((prev) => ({
          ...prev,
          [payload.bookingId]: {
            otp: payload.otp,
            expiresAt: payload.expiresAt,
            resendCooldownUntil: payload.resendCooldownUntil,
            service: payload.service
          }
        }));

        // Update booking status in customer bookings list
        setCustomerBookings((prev) =>
          prev.map((b) =>
            b._id === payload.bookingId || b.bookingId === payload.bookingReadableId
              ? { ...b, status: 'Awaiting Arrival Verification' }
              : b
          )
        );

        notify(`Worker has arrived! Your service start verification code is ${payload.otp}`, 'info');
      }
    };

    // 2. Arrival Verified (Status -> In Progress)
    const handleArrivalVerified = (payload) => {
      console.log('[SOCKET] arrival-verified received:', payload);
      if (payload && payload.bookingId) {
        setActiveArrivalOtps((prev) => {
          const next = { ...prev };
          delete next[payload.bookingId];
          return next;
        });
        fetchCustomerBookings(true);
        if (user.roles?.includes('worker')) {
          fetchWorkerJobs(true);
        }
      }
    };

    // 3. Status Updated
    const handleStatusUpdated = (payload) => {
      console.log('[SOCKET] booking-status-updated received:', payload);
      fetchCustomerBookings(true);
      if (user.roles?.includes('worker')) {
        fetchWorkerJobs(true);
      }
    };

    // 4. New Work Request for Worker
    const handleNewWorkRequest = (payload) => {
      console.log('[SOCKET] new_work_request received:', payload);
      if (user.roles?.includes('worker') && user.workerStatus === 'approved') {
        fetchWorkerJobs(true);
      }
    };

    // 5. Job accepted elsewhere
    const handleJobAcceptedElsewhere = (payload) => {
      console.log('[SOCKET] job-accepted-elsewhere:', payload);
      setWorkerRequests((prev) =>
        prev.filter((r) => r._id !== payload.bookingId && r.bookingId !== payload.bookingReadableId)
      );
    };

    socket.on('arrival-otp-generated', handleArrivalOtpGenerated);
    socket.on('arrival-verified', handleArrivalVerified);
    socket.on('booking-status-updated', handleStatusUpdated);
    socket.on('new_work_request', handleNewWorkRequest);
    socket.on('new-job-request', handleNewWorkRequest);
    socket.on('job-accepted-elsewhere', handleJobAcceptedElsewhere);
    socket.on('work_request_cancelled', handleJobAcceptedElsewhere);

    return () => {
      socket.off('arrival-otp-generated', handleArrivalOtpGenerated);
      socket.off('arrival-verified', handleArrivalVerified);
      socket.off('booking-status-updated', handleStatusUpdated);
      socket.off('new_work_request', handleNewWorkRequest);
      socket.off('new-job-request', handleNewWorkRequest);
      socket.off('job-accepted-elsewhere', handleJobAcceptedElsewhere);
      socket.off('work_request_cancelled', handleJobAcceptedElsewhere);
    };
  }, [socket, user, fetchCustomerBookings, fetchWorkerJobs, notify]);

  // --- Customer Arrival OTP Actions ---
  const fetchArrivalOtp = async (bookingId) => {
    try {
      const { data } = await api.get(`/bookings/${bookingId}/arrival-verification`);
      if (data?.otp) {
        setActiveArrivalOtps((prev) => ({
          ...prev,
          [bookingId]: {
            otp: data.otp,
            expiresAt: data.expiresAt,
            resendCooldownUntil: data.resendCooldownUntil
          }
        }));
      }
      return data;
    } catch (err) {
      console.error('fetchArrivalOtp error:', err);
      throw err;
    }
  };

  const resendArrivalOtp = async (bookingId) => {
    try {
      const { data } = await api.post(`/bookings/${bookingId}/resend-arrival-otp`);
      if (data?.otp) {
        setActiveArrivalOtps((prev) => ({
          ...prev,
          [bookingId]: {
            otp: data.otp,
            expiresAt: data.expiresAt,
            resendCooldownUntil: data.resendCooldownUntil
          }
        }));
      }
      return data;
    } catch (err) {
      console.error('resendArrivalOtp error:', err);
      throw err;
    }
  };

  // --- Worker Arrival OTP Actions ---
  const startArrivalVerification = async (bookingId) => {
    try {
      const { data } = await api.post(`/bookings/${bookingId}/start-verification`);
      // Update local state without waiting for next fetch
      setAcceptedWorkerJobs((prev) =>
        prev.map((j) => (j._id === bookingId ? { ...j, status: 'Awaiting Arrival Verification' } : j))
      );
      return data;
    } catch (err) {
      console.error('startArrivalVerification error:', err);
      throw err;
    }
  };

  const verifyArrivalOtp = async (bookingId, otp) => {
    try {
      const { data } = await api.post(`/bookings/${bookingId}/verify-arrival-otp`, { otp });
      // Refresh worker jobs silently to move into ongoing
      fetchWorkerJobs(true);
      return data;
    } catch (err) {
      console.error('verifyArrivalOtp error:', err);
      throw err;
    }
  };

  const value = {
    // Customer
    customerBookings,
    customerLoading,
    customerError,
    customerInitialized,
    fetchCustomerBookings,
    activeArrivalOtps,
    fetchArrivalOtp,
    resendArrivalOtp,

    // Worker
    workerRequests,
    acceptedWorkerJobs,
    ongoingWorkerJobs,
    completedWorkerJobs,
    workerProfile,
    workerLoading,
    workerError,
    workerInitialized,
    fetchWorkerJobs,
    startArrivalVerification,
    verifyArrivalOtp
  };

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}
