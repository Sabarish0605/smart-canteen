const mongoose = require('mongoose');

const menuSchema = new mongoose.Schema({
  itemName: {
    type: String,
    required: [true, 'Please provide item name'],
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'Please provide price'],
    min: [0, 'Price cannot be negative']
  },
  stockCount: {
    type: Number,
    required: [true, 'Please provide stock count'],
    min: [0, 'Stock count cannot be negative'],
    default: 0
  },
  imageURL: {
    type: String,
    default: 'https://via.placeholder.com/300x200?text=Food+Item'
  },
  category: {
    type: String,
    required: [true, 'Please provide category'],
    enum: ['breakfast', 'lunch', 'snacks', 'beverages', 'dinner', 'desserts'],
    lowercase: true
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  description: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
menuSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Automatically set isAvailable based on stockCount
menuSchema.pre('save', function(next) {
  this.isAvailable = this.stockCount > 0;
  next();
});

module.exports = mongoose.model('Menu', menuSchema);