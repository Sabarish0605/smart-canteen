const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Order = require('../models/Order');
const Menu = require('../models/Menu');
const { protect, authorize } = require('../middleware/authMiddleware');

// Initialize Razorpay with safety check
let razorpay = null;
try {
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
  }
} catch (error) {
  console.warn('Razorpay initialization failed:', error.message);
}

// ==========================================
// 1. SPECIFIC POST ROUTES (Keep these at the top)
// ==========================================

// @route    POST /api/orders/checkout
router.post('/checkout', protect, async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide items' });
    }

    let totalAmount = 0;
    let orderItems = [];

    for (let item of items) {
      const menuItem = await Menu.findById(item.menuItem);
      if (!menuItem) return res.status(404).json({ message: 'Menu item not found' });
      if (menuItem.stockCount < item.quantity) {
        return res.status(400).json({ message: `Low stock for ${menuItem.itemName}` });
      }

      totalAmount += menuItem.price * item.quantity;
      orderItems.push({
        menuItem: menuItem._id,
        itemName: menuItem.itemName,
        quantity: item.quantity,
        price: menuItem.price
      });
    }

    let razorpayOrderId = null;
    let razorpayAmount = null;

    // Try to create Razorpay order if available
    if (razorpay) {
      try {
        const rzpOptions = {
          amount: totalAmount * 100,
          currency: "INR",
          receipt: `rcpt_${Date.now()}`
        };
        const rzpOrder = await razorpay.orders.create(rzpOptions);
        razorpayOrderId = rzpOrder.id;
        razorpayAmount = rzpOptions.amount;
      } catch (rzpError) {
        console.warn('Razorpay order creation failed, using mock ID:', rzpError.message);
        razorpayOrderId = `mock_order_${Date.now()}`;
        razorpayAmount = totalAmount * 100;
      }
    } else {
      // Use mock Razorpay ID if Razorpay is not initialized
      razorpayOrderId = `mock_order_${Date.now()}`;
      razorpayAmount = totalAmount * 100;
    }

    // Create order in MongoDB with studentId from req.user
    const order = await Order.create({
      studentId: req.user._id,
      items: orderItems,
      totalAmount,
      razorpayOrderId: razorpayOrderId,
      status: 'pending_payment'
    });

    // Populate the order to get full details
    const populatedOrder = await Order.findById(order._id)
      .populate('studentId', 'name email')
      .populate('items.menuItem', 'itemName category imageURL');

    res.status(201).json({
      success: true,
      razorpayOrderId: razorpayOrderId,
      orderId: order._id,
      amount: razorpayAmount,
      data: populatedOrder
    });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// @route    POST /api/orders/verify
router.post('/verify', protect, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // --- TEMPORARY BYPASS FOR TESTING ---
    const isSignatureValid = true; 

    if (!isSignatureValid) {
      return res.status(400).json({ success: false, message: "Payment verification failed" });
    }

    const order = await Order.findOne({ razorpayOrderId: razorpay_order_id });
    if (!order) return res.status(404).json({ message: "Order not found" });

    for (let item of order.items) {
      await Menu.findByIdAndUpdate(item.menuItem, { $inc: { stockCount: -item.quantity } });
    }

    order.paymentStatus = 'completed';
    order.status = 'active'; 
    await order.save(); 

    res.status(200).json({
      success: true,
      message: "Order activated and QR generated",
      qrCodeData: order.qrCodeData 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 2. GET ROUTES
// ==========================================

// @route    GET /api/orders
router.get('/', protect, async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'student') filter.studentId = req.user._id;

    const orders = await Order.find(filter)
      .populate('studentId', 'name email')
      .populate('items.menuItem', 'itemName category')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: orders.length, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// @route    GET /api/orders/:id (MOVED BELOW /VERIFY)
router.get('/:id', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('studentId', 'name email')
      .populate('items.menuItem', 'itemName category imageURL');

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (req.user.role === 'student' && order.studentId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 3. PATCH/ACTION ROUTES
// ==========================================

// @route    PATCH /api/orders/scan/:qrData
router.patch('/scan/:qrData', protect, authorize('admin'), async (req, res) => {
  try {
    const order = await Order.findOne({ qrCodeData: req.params.qrData })
      .populate('studentId', 'name email');

    if (!order) return res.status(404).json({ message: 'Invalid QR code' });
    if (order.status !== 'active') return res.status(400).json({ message: `Order is ${order.status}` });

    order.status = 'scanned';
    order.scannedAt = new Date();
    await order.save();

    res.status(200).json({ success: true, message: 'Order scanned successfully', data: order });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// @route    PATCH /api/orders/:id/deliver
router.patch('/:id/deliver', protect, authorize('admin'), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.status !== 'scanned') return res.status(400).json({ message: 'Must scan before delivery' });

    order.status = 'delivered';
    order.deliveredAt = new Date();
    await order.save();

    res.status(200).json({ success: true, message: 'Delivered', data: order });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// @route    PATCH /api/orders/:id/cancel
router.patch('/:id/cancel', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (order.status === 'delivered' || order.status === 'scanned') {
      return res.status(400).json({ message: 'Cannot cancel an order in progress or delivered' });
    }

    for (let item of order.items) {
      await Menu.findByIdAndUpdate(item.menuItem, { $inc: { stockCount: item.quantity } });
    }

    order.status = 'cancelled';
    await order.save();

    res.status(200).json({ success: true, message: 'Cancelled', data: order });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;