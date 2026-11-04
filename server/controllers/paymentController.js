import Payment from '../models/Payment.js';
import Booking from '../models/Booking.js';

export async function getMyPayments(req, res) {
  try {
    const payments = await Payment.find({ customerId: req.user._id })
      .populate({
        path: 'bookingId',
        select: 'bookingId category scheduledDate totalAmount status serviceId',
        populate: { path: 'serviceId', select: 'name category' }
      })
      .sort({ createdAt: -1 });

    const totalSpent = payments
      .filter((p) => p.paymentStatus === 'Paid')
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    res.json({
      payments,
      totalSpent
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch payment records.' });
  }
}

export async function getAllPayments(req, res) {
  try {
    const payments = await Payment.find({})
      .populate('customerId', 'name email phone')
      .populate({
        path: 'bookingId',
        select: 'bookingId category totalAmount status serviceId',
        populate: { path: 'serviceId', select: 'name' }
      })
      .sort({ createdAt: -1 });

    const totalRevenue = payments
      .filter((p) => p.paymentStatus === 'Paid')
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    res.json({
      payments,
      totalRevenue
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch payments.' });
  }
}

export async function mockCheckout(req, res) {
  try {
    const { bookingId, amount, paymentMethod = 'Online Mock Payment (Test)' } = req.body;

    let query = { _id: bookingId };
    if (!bookingId.match(/^[0-9a-fA-F]{24}$/)) {
      query = { bookingId };
    }

    const booking = await Booking.findOne(query);
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });

    const uniquePayId = `HT-PAY-${Math.floor(100000 + Math.random() * 900000)}`;
    const txnRef = `TXN-HT-DEMO-${Date.now().toString().slice(-8)}`;
    const invoiceNum = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const payment = await Payment.create({
      paymentId: uniquePayId,
      bookingId: booking._id,
      customerId: req.user._id,
      amount: Number(amount) || booking.totalAmount,
      paymentMethod,
      paymentStatus: 'Paid',
      transactionReference: txnRef,
      invoiceNumber: invoiceNum
    });

    booking.paymentStatus = 'Paid';
    await booking.save();

    res.status(201).json({
      success: true,
      message: 'Demo payment completed successfully. No real money was charged.',
      payment
    });
  } catch (err) {
    console.error('mockCheckout error:', err);
    res.status(500).json({ message: 'Mock payment checkout failed.' });
  }
}

export async function getInvoice(req, res) {
  try {
    const { id } = req.params;

    let query = { _id: id };
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      query = { paymentId: id };
    }

    const payment = await Payment.findOne(query)
      .populate('customerId', 'name email phone address')
      .populate({
        path: 'bookingId',
        populate: [
          { path: 'serviceId', select: 'name price category description' },
          { path: 'workerId', select: 'name phone email' }
        ]
      });

    if (!payment) return res.status(404).json({ message: 'Invoice / payment record not found.' });

    const subtotal = payment.amount;
    const gst = Math.round(subtotal * 0.18);
    const grandTotal = subtotal + gst;

    res.json({
      invoiceNumber: payment.invoiceNumber,
      paymentId: payment.paymentId,
      date: payment.createdAt,
      transactionReference: payment.transactionReference,
      paymentMethod: payment.paymentMethod,
      paymentStatus: payment.paymentStatus,
      customer: payment.customerId,
      booking: payment.bookingId,
      service: payment.bookingId?.serviceId,
      worker: payment.bookingId?.workerId,
      financials: {
        subtotal,
        gstRate: '18%',
        gstAmount: gst,
        grandTotal
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to generate invoice.' });
  }
}
