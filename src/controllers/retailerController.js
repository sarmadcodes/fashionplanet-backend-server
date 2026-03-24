const RetailerApplication = require('../models/RetailerApplication');
const RetailerProduct = require('../models/RetailerProduct');
const ApiError = require('../utils/ApiError');

const sanitizeRetailerApplication = (app) => ({
  id: String(app._id),
  ownerUserId: String(app.ownerUserId),
  brandName: app.brandName,
  contactName: app.contactName,
  contactEmail: app.contactEmail,
  contactPhone: app.contactPhone,
  website: app.website,
  categories: Array.isArray(app.categories) ? app.categories : [],
  description: app.description,
  status: app.status,
  reviewedBy: app.reviewedBy ? String(app.reviewedBy) : null,
  reviewedAt: app.reviewedAt,
  reviewNote: app.reviewNote || '',
  createdAt: app.createdAt,
  updatedAt: app.updatedAt,
});

const sanitizeRetailerProduct = (row) => ({
  id: String(row._id),
  ownerUserId: String(row.ownerUserId),
  retailerApplicationId: String(row.retailerApplicationId),
  brandName: row.brandName,
  name: row.name,
  category: row.category,
  description: row.description || '',
  image: row.image || '',
  productUrl: row.productUrl || '',
  price: Number(row.price) || 0,
  currency: row.currency || 'GBP',
  stock: Number(row.stock) || 0,
  isActive: Boolean(row.isActive),
  isApprovedByAdmin: Boolean(row.isApprovedByAdmin),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const getApprovedRetailerApplicationForUser = async (userId) => {
  return RetailerApplication.findOne({ ownerUserId: userId, status: 'approved' })
    .sort({ reviewedAt: -1, createdAt: -1 });
};

exports.submitRetailerApplication = async (req, res, next) => {
  try {
    const {
      brandName,
      contactName,
      contactEmail,
      contactPhone,
      website,
      categories,
      description,
    } = req.body || {};

    if (!String(brandName || '').trim()) {
      return next(new ApiError('Brand name is required', 400));
    }

    if (!String(contactName || '').trim()) {
      return next(new ApiError('Contact name is required', 400));
    }

    if (!String(contactEmail || '').trim()) {
      return next(new ApiError('Contact email is required', 400));
    }

    const normalizedCategories = Array.isArray(categories)
      ? categories.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 12)
      : String(categories || '')
        .split(',')
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .slice(0, 12);

    const existingPending = await RetailerApplication.findOne({
      ownerUserId: req.user._id,
      status: 'pending',
    });

    if (existingPending) {
      existingPending.brandName = String(brandName).trim();
      existingPending.contactName = String(contactName).trim();
      existingPending.contactEmail = String(contactEmail).trim().toLowerCase();
      existingPending.contactPhone = String(contactPhone || '').trim();
      existingPending.website = String(website || '').trim();
      existingPending.categories = normalizedCategories;
      existingPending.description = String(description || '').trim();
      existingPending.reviewedBy = null;
      existingPending.reviewedAt = null;
      existingPending.reviewNote = '';
      await existingPending.save();

      return res.status(200).json({
        success: true,
        message: 'Existing pending retailer application updated.',
        retailerApplication: sanitizeRetailerApplication(existingPending),
      });
    }

    const application = await RetailerApplication.create({
      ownerUserId: req.user._id,
      brandName: String(brandName).trim(),
      contactName: String(contactName).trim(),
      contactEmail: String(contactEmail).trim().toLowerCase(),
      contactPhone: String(contactPhone || '').trim(),
      website: String(website || '').trim(),
      categories: normalizedCategories,
      description: String(description || '').trim(),
      status: 'pending',
    });

    return res.status(201).json({
      success: true,
      message: 'Retailer application submitted for admin review.',
      retailerApplication: sanitizeRetailerApplication(application),
    });
  } catch (error) {
    return next(error);
  }
};

exports.getMyRetailerApplication = async (req, res, next) => {
  try {
    const latest = await RetailerApplication.findOne({ ownerUserId: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    if (!latest) {
      return res.status(200).json({ success: true, retailerApplication: null });
    }

    return res.status(200).json({
      success: true,
      retailerApplication: sanitizeRetailerApplication(latest),
    });
  } catch (error) {
    return next(error);
  }
};

exports.createRetailerProduct = async (req, res, next) => {
  try {
    const approvedApplication = await getApprovedRetailerApplicationForUser(req.user._id);
    if (!approvedApplication) {
      return next(new ApiError('Retailer account is not approved yet. Submit and get approved first.', 403));
    }

    const {
      name,
      category,
      description,
      image,
      productUrl,
      price,
      currency,
      stock,
      isActive,
    } = req.body || {};

    if (!String(name || '').trim()) {
      return next(new ApiError('Product name is required', 400));
    }

    if (!String(category || '').trim()) {
      return next(new ApiError('Product category is required', 400));
    }

    if (!String(image || '').trim()) {
      return next(new ApiError('Product image URL is required', 400));
    }

    const parsedPrice = Number(price);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      return next(new ApiError('Valid product price is required', 400));
    }

    const parsedStock = Number.isFinite(Number(stock)) ? Math.max(0, Number(stock)) : 0;

    const row = await RetailerProduct.create({
      ownerUserId: req.user._id,
      retailerApplicationId: approvedApplication._id,
      brandName: approvedApplication.brandName,
      name: String(name).trim(),
      category: String(category).trim(),
      description: String(description || '').trim(),
      image: String(image).trim(),
      productUrl: String(productUrl || '').trim(),
      price: parsedPrice,
      currency: String(currency || 'GBP').trim().toUpperCase() || 'GBP',
      stock: parsedStock,
      isActive: typeof isActive === 'boolean' ? isActive : true,
      isApprovedByAdmin: true,
    });

    return res.status(201).json({
      success: true,
      product: sanitizeRetailerProduct(row),
    });
  } catch (error) {
    return next(error);
  }
};

exports.getMyRetailerProducts = async (req, res, next) => {
  try {
    const rows = await RetailerProduct.find({ ownerUserId: req.user._id }).sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      products: rows.map(sanitizeRetailerProduct),
    });
  } catch (error) {
    return next(error);
  }
};

exports.updateRetailerProduct = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const row = await RetailerProduct.findOne({ _id: productId, ownerUserId: req.user._id });
    if (!row) {
      return next(new ApiError('Retailer product not found', 404));
    }

    const {
      name,
      category,
      description,
      image,
      productUrl,
      price,
      currency,
      stock,
      isActive,
    } = req.body || {};

    if (typeof name === 'string' && name.trim()) row.name = name.trim();
    if (typeof category === 'string' && category.trim()) row.category = category.trim();
    if (typeof description === 'string') row.description = description.trim();
    if (typeof image === 'string' && image.trim()) row.image = image.trim();
    if (typeof productUrl === 'string') row.productUrl = productUrl.trim();

    if (typeof price !== 'undefined') {
      const parsedPrice = Number(price);
      if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
        return next(new ApiError('Valid product price is required', 400));
      }
      row.price = parsedPrice;
    }

    if (typeof currency === 'string' && currency.trim()) {
      row.currency = currency.trim().toUpperCase();
    }

    if (typeof stock !== 'undefined') {
      const parsedStock = Number(stock);
      row.stock = Number.isFinite(parsedStock) ? Math.max(0, parsedStock) : 0;
    }

    if (typeof isActive === 'boolean') {
      row.isActive = isActive;
    }

    await row.save();

    return res.status(200).json({
      success: true,
      product: sanitizeRetailerProduct(row),
    });
  } catch (error) {
    return next(error);
  }
};

exports.deleteRetailerProduct = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const row = await RetailerProduct.findOneAndDelete({ _id: productId, ownerUserId: req.user._id });
    if (!row) {
      return next(new ApiError('Retailer product not found', 404));
    }

    return res.status(200).json({
      success: true,
      message: 'Retailer product deleted successfully.',
    });
  } catch (error) {
    return next(error);
  }
};
