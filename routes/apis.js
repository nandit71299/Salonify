const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer();


//Authentication Token Middleware
const authMiddleware = require("../config/authMiddleware.js");

// Validators
const loginregister = require('../validation/loginregister')
const branch = require('../validation/branch');
const service = require('../validation/service');
const serviceOption = require('../validation/serviceOption.js');
const appointmentData = require('../validation/appointment');
const offerData = require('../validation/branchOffers');
const platform_coupon = require('../validation/platformCoupon');
const analytics = require('../validation/analytics');
const cart = require('../validation/cart')
const search = require('../validation/search')
const wishlist = require('../validation/wishlist')

//Controllers
const LoginRegisterController = require('../controller/loginregister')
const CategoryCotroller = require('../controller/categoriesController')
const BranchController = require('../controller/branchController.js');
const AppointmentController = require('../controller/appointmentController');
const ServiceController = require('../controller/serviceController');
const ServiceOptionController = require('../controller/serviceOptionController')
const OfferController = require('../controller/branchOfferController')
const PlatformCouponController = require('../controller/platformCouponController')
const AnalyticsController = require('../controller/analyticsController')
const CartController = require('../controller/cartController')
const SearchController = require('../controller/searchController')
const WishtlistController = require('../controller/wishlistController')
const PaymentsController = require('../controller/paymentsController')

// Login & Registration
router.post('/registersalon', upload.single('image'), loginregister.validateSalonRegistration, LoginRegisterController.registerSalon);
router.post('/salon-login', loginregister.validateSalonLogin, LoginRegisterController.salonLogin);
router.post('/customer-registration', loginregister.validateCustomerRegistration, LoginRegisterController.customerRegistration);
router.post('/customer-login', loginregister.validateCustomerLogin, LoginRegisterController.customerLogin);
router.post('/send-otp', loginregister.validateSendOtp, LoginRegisterController.sendOtp);
router.post('/verify-user', loginregister.validateVerifyUser, LoginRegisterController.verify);
router.put('/update-password', loginregister.updatePassword, LoginRegisterController.updatePassword);

// Dashboard
router.get('/dashboard', branch.validateGetDashboard, BranchController.getDashboard)


// Categories
router.get('/categories', CategoryCotroller.getCategories);

// Branch Hours
router.post('/store-hours', branch.validateBranchHours, BranchController.createBranchHours);
router.put('/update-store-hours', branch.validateBranchHours, BranchController.updateBranchHours);
router.get('/store-hours', branch.validateGetBranchHours, BranchController.getBranchHours);

// Appointment Related
router.get('/appointments', appointmentData.validateGetAllAppointments, AppointmentController.getAllAppointments)
router.get('/appointmentdetails', appointmentData.validateGetAppoitmentDetails, AppointmentController.getAppointmentDetails)

// Holidays
router.post('/holiday', branch.validateInsertBranchHoliday, BranchController.createHoliday);
router.delete('/holiday', branch.validateDeleteBranchHoliday, BranchController.deleteHoliday);
router.put('/holiday', branch.validateUpdateBranchHoliday, BranchController.updateHoliday);
router.get('/holidays', branch.validateGetBranchHoliday, BranchController.getHoliday);

// Services
router.post('/service', service.validateCreateService, ServiceController.createService);
router.get('/services', service.validateGetAllServices, ServiceController.getAllService);
router.delete('/services', service.validateDeleteServices, ServiceController.deleteServices);
router.put('/service', service.validateUpdateService, ServiceController.updateService);
router.get('/service', service.validateGetService, ServiceController.getService);
router.delete('/serviceoption', serviceOption.validateDeleteServiceOption, ServiceOptionController.deleteServiceOption)

// Coupons Related
router.post('/join-platform-coupon', platform_coupon.validateJoinPlatformCoupon, PlatformCouponController.joinPlatformCoupon)
router.post('/exit-platform-coupon', platform_coupon.validateExitPlatformCoupon, PlatformCouponController.exitPlatformCoupon)

// Analytics Related
router.get('/appoitmentanalyticswithdaterange', analytics.validateGetAppointmentAnalyticsWithDateRange, AnalyticsController.getAppointmentAnalyticsWithDateRange)
router.get('/paymentswithdaterange', analytics.validateGetPaymentsWithDateRange, AnalyticsController.getPaymentsWithDateRange)
router.get('/serviceanalyticswithdaterange', analytics.validateGetServiceAnalyticsWithDateRange, AnalyticsController.getServiceAnalyticsWithDateRange)
router.get('/toppayingcustomers', analytics.validateGetTopPayingCustomers, AnalyticsController.getTopPayingCustomers);
router.get('/detailedappointmentanalytics', analytics.validateGetDetailedAppointmentAnalytics, AnalyticsController.getDetailedAppointmetAnalytics);
router.get('/salesovertimereport', analytics.validateGetSalesOverTimeReport, AnalyticsController.getSalesOverTimeReport);
router.get('/salesbyservicereport', analytics.validateGetSalesByServiceReport, AnalyticsController.getSalesByServiceReport);
router.get('/toppayingcustomersreport', analytics.validateGetTopPayingCustomersReport, AnalyticsController.getTopPayingCustomersReport);


// Salon/Branch Related
router.get('/salonprofiledetails', branch.validateGetSalonProfileDetails, BranchController.getSalonProfileDetails);



// Offers/Coupons
router.get('/platform-offers', platform_coupon.validateGetPlatformOffers, PlatformCouponController.getPlatformOffers);
router.get('/platform-offer-insights', platform_coupon.validateGetPlatformOfferInsights, PlatformCouponController.getPlatformOfferInsights)
router.get('/sales-over-time-with-platform-offer', platform_coupon.validateGetSalesOverTimeWithPlatformOffer, PlatformCouponController.getSalesOverTimeWithPlatformOffer)
router.get('/sales-by-service-with-platform-offer', platform_coupon.validateGetSalesByServiceWithPlatformOffer, PlatformCouponController.getSalesByServiceWithPlatformOffer)
router.get('/top-paying-customers-with-platform-offer', platform_coupon.validateGetTopPayingCustomersWithPlatformOffer, PlatformCouponController.getTopPayingCustomersWithPlatformOffer)













// Customer App
router.get('/branchesincity', branch.validateGetNearbySalons, BranchController.getNearbySalons);
router.get('/branchesbycategory', branch.validateGetBranchesByCategory, BranchController.getBranchesByCategory);
router.post('/add-to-cart', cart.validateAddToCart, CartController.addToCart);
router.delete('/remove-from-cart', cart.validateRemoveFromCart, CartController.removeFromCart)
router.delete('/cart-delete-all', cart.validateCartDeleteAll, CartController.cartDeleteAll)
router.get('/cartcount', cart.validateGetCartCount, CartController.getCartCount);
router.post('/ratebranch', branch.validateRateBranch, BranchController.rateBranch);
router.post('/searchserviceorsalon', search.validateSearchServiceOrBranch, SearchController.searchServiceOrBranch);
router.get('/branchdetails', branch.validateGetBranchDetails, BranchController.getBranchDetails);
router.get('/branchservices', service.validateGetBranchServices, ServiceController.getBranchServices);
router.get('/reserveaseat', appointmentData.validateReserveASeat, AppointmentController.reserveASeat)
router.get('/get-branch-offers', offerData.validateGetBranchOffers, OfferController.getBranchOffers);
router.post('/get-branch-vacancy', appointmentData.validateBranchVacancy, AppointmentController.branchvacancy);
router.post('/book-appointment', appointmentData.validateApointmentBooking, AppointmentController.bookAppointment);
router.get('/bookingshistory', appointmentData.validateGetBookingHistory, AppointmentController.getBookingHistory);
router.put('/wishlist', wishlist.validateCreateOrUpdateWishlist, WishtlistController.createOrUpdateWishlist);
// router.post("/initiateadvancepayment");
// router.post("/initiatepostservicepayment");
router.get("/customerappointmentdetails", appointmentData.validateGetCustomerAppointmentDetails, AppointmentController.getCustomerAppointmentDetails);
router.get("/cancellationsummary", appointmentData.validateGetCancellationSummary, AppointmentController.getCancellationSummary);
router.put("/rescheduleappointment", appointmentData.validateRescheduleAppointment, AppointmentController.rescheduleAppointment);
router.get("/wishlisteditems", wishlist.validateGetAllWishlistedItems, WishtlistController.getAllWishlistedItems);
router.get("/customerprofile", loginregister.validateGetCustomerProfile, LoginRegisterController.getCustomerProfile);
router.put('/customerprofile', loginregister.validateUpdateCustomerProfile, LoginRegisterController.updateCustomerProfile)

// router.get("/getallpayments");


router.post('/confirm-appointment', PaymentsController.confirmAppointment)

module.exports = router;
