const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer();

//Authentication Token Middleware
const authMiddleware = require("../config/authMiddleware.js");

// Validators
const saloonRegistrationData = require('../validation/saloonRegistration');
const customerLoginData = require('../validation/customerlogin.js');
const userRegistrationData = require('../validation/userRegistration');
const sendOtpData = require('../validation/sendotp');
const updatePasswordData = require('../validation/updatePassword');
const branch = require('../validation/branch');
const service = require('../validation/service');
const appointmentData = require('../validation/appointment');
const offerData = require('../validation/branchOffers.js');
const platform_coupon = require('../validation/platformCoupon')
const analytics = require('../validation/analytics')

//Controllers
const LoginController = require('../controller/loginController');
const UserController = require('../controller/userController');
const CategoryCotroller = require('../controller/categoriesController')
const BranchController = require('../controller/branchController');
const AppointmentController = require('../controller/appointmentController');
const ServiceController = require('../controller/serviceController');
const OfferController = require('../controller/branchOfferController')
const PlatformCouponController = require('../controller/platformCouponController')
const AnalyticsController = require('../controller/analyticsController')

// Login & Registration
router.post('/customer-login', customerLoginData.validateCustomerLogin, LoginController.login);
router.post('/saloon-registration', upload.single('image'), saloonRegistrationData.validateSalonRegistration, LoginController.register);
router.post('/user-registration', userRegistrationData.validateUserRegistration, UserController.store);
router.post('/send-otp', sendOtpData.validateSendOtp, UserController.sendOtp);
router.post('/verify-user', UserController.verify);
router.post('/update-password', updatePasswordData.updatePassword, LoginController.updatePassword);

// Categories
router.get('/categories', CategoryCotroller.getCategories);

// Branch Hours
router.post('/branch-hours', branch.validateBranchHours, BranchController.createBranchHours);
router.put('/branch-hours', branch.validateBranchHours, BranchController.updateBranchHours);
router.get('/branch-hours', branch.validateGetBranchHours, BranchController.getBranchHours);

// Appointment Related
router.post('/get-branch-vacancy', appointmentData.validateBranchVacancy, AppointmentController.branchvacancy);
router.get('/get-branch-offers', offerData.validateGetBranchOffers, OfferController.getBranchOffers);
router.get('/appointments', appointmentData.validateGetAllAppointments, AppointmentController.getAllAppointments)
router.get('/appointmentdetails', appointmentData.validateGetAppoitmentDetails, AppointmentController.getAppointmentDetails)
router.post('/book-appointment', appointmentData.validateApointmentBooking, AppointmentController.bookAppointment);

// Holidays
router.post('/holidays', branch.validateInsertBranchHoliday, BranchController.createHoliday);
router.delete('/holidays', branch.validateDeleteBranchHoliday, BranchController.deleteHoliday);
router.put('/holidays', branch.validateUpdateBranchHoliday, BranchController.updateHoliday);
router.get('/holidays', branch.validateGetBranchHoliday, BranchController.getHoliday);

// Services
router.post('/service', service.validateCreateService, ServiceController.createService);
router.get('/services', service.validateGetAllServices, ServiceController.getAllService);
router.delete('/services', service.validateDeleteServices, ServiceController.deleteServices);
router.put('/service', service.validateUpdateService, ServiceController.updateService);
router.get('/service', service.validateGetService, ServiceController.getService);


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

module.exports = router;
