const express = require("express");
const mongoose = require("mongoose");
const Product = require("../models/Product");

const router = express.Router();

// POST /api/products - Create a product
router.post("/", async (req, res, next) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json({
      success: true,
      message: "Product created successfully",
      product
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/products - Filtering, sorting and pagination
router.get("/", async (req, res, next) => {
  try {
    const {
      category,
      search,
      minPrice,
      maxPrice,
      sort = "-createdAt",
      page = 1,
      limit = 10
    } = req.query;

    const filter = {};

    if (category) filter.category = new RegExp(`^${escapeRegex(category)}$`, "i");
    if (search) {
      const safeSearch = escapeRegex(search);
      filter.$or = [
        { name: new RegExp(safeSearch, "i") },
        { sku: new RegExp(safeSearch, "i") },
        { supplier: new RegExp(safeSearch, "i") }
      ];
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice !== undefined) filter.price.$gte = Number(minPrice);
      if (maxPrice !== undefined) filter.price.$lte = Number(maxPrice);
      if (Object.values(filter.price).some(Number.isNaN)) {
        return res.status(400).json({ success: false, message: "Price filters must be numbers" });
      }
    }

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const allowedSortFields = ["name", "price", "quantity", "createdAt", "updatedAt"];
    const sortField = sort.startsWith("-") ? sort.slice(1) : sort;
    if (!allowedSortFields.includes(sortField)) {
      return res.status(400).json({
        success: false,
        message: `Sort must use one of: ${allowedSortFields.join(", ")}`
      });
    }
    const sortOption = sort.startsWith("-") ? { [sortField]: -1 } : { [sortField]: 1 };

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort(sortOption)
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize),
      Product.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      total,
      page: pageNumber,
      totalPages: Math.ceil(total / pageSize),
      count: products.length,
      products
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/products/low-stock - Products at or below their reorder level
router.get("/low-stock", async (req, res, next) => {
  try {
    const lowStockItems = await Product.find({
      $expr: { $lte: ["$quantity", "$reorderLevel"] }
    }).sort({ quantity: 1 });

    res.status(200).json({
      success: true,
      count: lowStockItems.length,
      lowStockItems
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/products/summary - Category-wise inventory aggregation
router.get("/summary", async (req, res, next) => {
  try {
    const summary = await Product.aggregate([
      {
        $group: {
          _id: "$category",
          totalItems: { $sum: 1 },
          totalQuantity: { $sum: "$quantity" },
          totalStockValue: { $sum: { $multiply: ["$price", "$quantity"] } },
          avgPrice: { $avg: "$price" }
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 1,
          totalItems: 1,
          totalQuantity: 1,
          totalStockValue: { $round: ["$totalStockValue", 2] },
          avgPrice: { $round: ["$avgPrice", 2] }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      categories: summary.length,
      summary
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/products/:id - Get one product
router.get("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid product ID" });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    res.status(200).json({ success: true, product });
  } catch (error) {
    next(error);
  }
});

// PUT /api/products/:id - Update product details
router.put("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid product ID" });
    }

    const allowedFields = ["name", "sku", "category", "price", "quantity", "reorderLevel", "supplier"];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const product = await Product.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true
    });

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/products/:id/stock - Increase or decrease stock
// Body example: { "change": 10 } to add 10, or { "change": -3 } to subtract 3.
router.patch("/:id/stock", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid product ID" });
    }

    const change = Number(req.body.change);
    if (!Number.isInteger(change) || change === 0) {
      return res.status(400).json({
        success: false,
        message: "change must be a non-zero whole number"
      });
    }

    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, quantity: { $gte: Math.max(0, -change) } },
      { $inc: { quantity: change } },
      { new: true, runValidators: true }
    );

    if (!product) {
      const exists = await Product.exists({ _id: req.params.id });
      return res.status(exists ? 400 : 404).json({
        success: false,
        message: exists ? "Insufficient stock: quantity cannot become negative" : "Product not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Stock updated successfully",
      product
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/products/:id - Delete a product
router.delete("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid product ID" });
    }

    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    res.status(200).json({
      success: true,
      message: "Product deleted",
      id: product._id
    });
  } catch (error) {
    next(error);
  }
});

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = router;
