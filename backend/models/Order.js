const mongoose = require('mongoose');
const crypto = require('crypto');

const orderSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Student ID is required']
  },
  items: [{
    menuItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Menu',
      required: true
    },
    itemName: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1']
    },
    price: {
      type: Number,
      required: true
    }
  }],
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Total amount cannot be negative']
  },
  // Razorpay Specific Fields
  razorpayOrderId: { 
    type: String 
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  qrCodeData: {
  type: String,
  default: "", 
  unique: false // <--- MAKE SURE THIS IS FALSE OR REMOVED
},
  status: {
    type: String,
    enum: ['pending_payment', 'active', 'scanned', 'delivered', 'cancelled'],
    default: 'pending_payment'
  },
  scannedAt: { type: Date },
  deliveredAt: { type: Date },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

/**
 * QR GENERATION LOGIC:
 * The QR code is only generated once the status moves to 'active' 
 * (which happens after successful payment verification).
 */
orderSchema.pre('save', function(next) {
  if (this.status === 'active' && !this.qrCodeData) {
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    this.qrCodeData = `ORD-${timestamp}-${randomString}`;
  }
  next();
});

orderSchema.index({ qrCodeData: 1 });
orderSchema.index({ studentId: 1, createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);