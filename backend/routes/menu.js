const express = require('express');
const router = express.Router();
const Menu = require('../models/Menu');
const { protect, authorize } = require('../middleware/authMiddleware');

// @route   GET /api/menu
// @desc    Get all menu items
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { category, available } = req.query;
    
    // Build filter object
    let filter = {};
    
    if (category) {
      filter.category = category.toLowerCase();
    }
    
    if (available === 'true') {
      filter.isAvailable = true;
      filter.stockCount = { $gt: 0 };
    }

    const menuItems = await Menu.find(filter).sort({ category: 1, itemName: 1 });

    res.status(200).json({
      success: true,
      count: menuItems.length,
      data: menuItems
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching menu items',
      error: error.message
    });
  }
});

// @route   GET /api/menu/:id
// @desc    Get single menu item
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const menuItem = await Menu.findById(req.params.id);

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }

    res.status(200).json({
      success: true,
      data: menuItem
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching menu item',
      error: error.message
    });
  }
});

// @route   POST /api/menu/add
// @desc    Add new menu item
// @access  Private/Admin
router.post('/add', protect, authorize('admin'), async (req, res) => {
  try {
    const { itemName, price, stockCount, imageURL, category, description } = req.body;

    // Validate required fields
    if (!itemName || !price || stockCount === undefined || !category) {
      return res.status(400).json({
        success: false,
        message: 'Please provide itemName, price, stockCount, and category'
      });
    }

    // Create menu item
    const menuItem = await Menu.create({
      itemName,
      price,
      stockCount,
      imageURL,
      category: category.toLowerCase(),
      description
    });

    res.status(201).json({
      success: true,
      message: 'Menu item added successfully',
      data: menuItem
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error adding menu item',
      error: error.message
    });
  }
});

// @route   PUT /api/menu/:id
// @desc    Update menu item
// @access  Private/Admin
router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const menuItem = await Menu.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Menu item updated successfully',
      data: menuItem
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating menu item',
      error: error.message
    });
  }
});

// @route   DELETE /api/menu/:id
// @desc    Delete menu item
// @access  Private/Admin
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const menuItem = await Menu.findByIdAndDelete(req.params.id);

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Menu item deleted successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting menu item',
      error: error.message
    });
  }
});

// @route   PATCH /api/menu/:id/stock
// @desc    Update stock count
// @access  Private/Admin
router.patch('/:id/stock', protect, authorize('admin'), async (req, res) => {
  try {
    const { stockCount } = req.body;

    if (stockCount === undefined || stockCount < 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid stock count'
      });
    }

    const menuItem = await Menu.findByIdAndUpdate(
      req.params.id,
      { stockCount },
      { new: true, runValidators: true }
    );

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Stock updated successfully',
      data: menuItem
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating stock',
      error: error.message
    });
  }
});

module.exports = router;