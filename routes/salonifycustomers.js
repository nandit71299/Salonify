import express from "express";
import bodyParser from "body-parser";
import db from "../database.js";
import axios from "axios";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import authMiddleware from '../middleware/authMiddleware.js';
import { check, body, validationResult, param } from 'express-validator';
import nodemailer from "nodemailer";
import moment from "moment";
import dotenv from "dotenv";
import * as enums from "../enums.js"
import { fileURLToPath } from 'url';
import path, { parse } from 'path';
import fs from 'fs';


const router = express.Router();

const SecretKey = process.env.SecretKey;
export const app = express();
const saltRounds = Number(process.env.saltrounds);

let transporter =
    nodemailer.createTransport(
        {
            service: 'gmail',
            auth: {
                user: 'nanditsareria@gmail.com',
                pass: 'yefq hjde ubld xafq'
            }
        }
    );

app.use(bodyParser.urlencoded({ extended: true, }));

var jsonParser = bodyParser.json();

router.post("/sendOTP",
    check("email").isEmail(),
    async (req, res) => {
        // IF VALIDATION ERRORS RETURN ERRORS
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.send(errors);
        }

        // ELSE TRY FINDING CUSTOMER WITH THE PROVIDED EMAIL
        try {
            const email = req.body.email.toLowerCase();
            const findCustomer = await db.query("SELECT * FROM users WHERE email = $1 AND status = $2 AND user_type=$3 ", [email, enums.is_active.yes, enums.UserType.customer]);
            // IF CONDITION TO CHECK IF CUSTOMER WITH GIVEN MAIL IS FOUND
            if (findCustomer.rowCount > 0) {
                const OTP = Math.floor(Math.random().toPrecision() * 100000);
                const customer_id = findCustomer.rows[0].id;
                try {
                    // IF FOUND UPDATE OTP,VALIDITY AND TIMESTAMP IN THE DATABASE
                    const result = await db.query("UPDATE users SET OTP=$1, otp_validity=20, reset_password_timestamp = now() WHERE id =$2 RETURNING *", [OTP, customer_id])
                    //SEND OTP MAIL TO THE CUSTOMER
                    const info = await transporter.sendMail({
                        from: "Salonify", // sender address
                        to: "nanditsareria@gmail.com", // reciever address
                        subject: "Salonify: OTP to Reset your password", // Subject
                        // text: "Hello world?", // plain text body
                        html: "Hello, " + email + "<br>" + "Please use below mentioned OTP to reset your password. <br> <h1>" + OTP + "</h1>", // html body
                    });

                    res.send({
                        message: "OTP Sent to Registered mail address..",
                        otp: result.rows[0].otp
                    })
                }
                catch (error) {
                    res.send(error);
                }
            } else {
                res.send("OTP sent to Registered mail address.")
            }
        } catch (error) {
            res.send(error);
        }
    });

router.post("/registercustomer",
    check("email").isEmail(),
    check("password").isLength({ min: 6 }),
    check("fName").not().isEmpty(),
    check("lName").not().isEmpty(),
    check("phone_number").isMobilePhone(),
    check("dob").isDate(),
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const email = req.body.email.toLowerCase();
            const password = req.body.password;
            const name = req.body.fName + " " + req.body.lName;
            const phone_number = req.body.phone_number;
            const dob = req.body.dob;
            let isSuccess = false;

            // Check if email or phone number already exist
            const checkEmailExistence = await db.query("SELECT * FROM users WHERE email = $1 AND status = $2 AND user_type = $3", [email, enums.is_active.yes, enums.UserType.customer]);
            if (checkEmailExistence.rows.length > 0) {
                return res.status(409).json({ message: "User with this email is already registered, please login..." });
            }

            const checkMobileExistence = await db.query("SELECT * FROM users WHERE phone_number = $1 AND status = $2 AND user_type = $3", [phone_number, enums.is_active.yes, enums.UserType.customer]);
            if (checkMobileExistence.rows.length > 0) {
                return res.status(409).json({ message: "User with this phone number is already registered, please login..." });
            }

            // Hash the password
            const hashedPassword = await bcrypt.hash(password, saltRounds);
            const result = await db.query("INSERT INTO users (email,password,name,phone_number,dob,user_type,status,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id", [email, hashedPassword, name, phone_number, dob, enums.UserType.customer, enums.is_active.yes, moment().format()]);

            // Check if insertion was successful
            if (result.rows.length > 0) {
                isSuccess = true;
            }

            res.status(200).json({ isSuccess: isSuccess, id: result.rows[0].id });
        } catch (error) {
            console.error("Error registering customer:", error);
            res.status(500).json({ message: "Error registering customer." });
        }
    });


router.post("/customerlogin",
    check("email").isEmail(),
    check("password").not().isEmpty(), async (req, res) => {

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.send(errors);
        } else {

            try {
                const email = req.body.email.toLowerCase();
                const password = req.body.password;
                var success = false;
                // CHECK IF USER EMAIL EXISTS IN THE DATABASE
                const result = await db.query(`SELECT * FROM "users" where "email" = $1 AND status=$2 AND user_type = $3`, [email, enums.is_active.yes, enums.UserType.customer]);

                // IF EXISTS COMPARE PASSWORD
                if (result.rowCount > 0) {
                    const user = result.rows[0];
                    try {
                        bcrypt.compare(password, user.password, async (err, result) => {
                            if (err) {
                                res.send(err)
                            } else {
                                // IF PASSWORD MATCHES RETURN CUSTOMER DATA AND UPDATE LAST LOGIN TIMESTAMP AND IP ADDRESS
                                if (result) {
                                    success = true;
                                    // const result = await db.query("UPDATE users SET last_login_ip = $1,  last_login_timestamp = now()  WHERE customer_id = $2 returning *",[req.socket.remoteAddress,user.customer_id])
                                    const token = jwt.sign({ user }, SecretKey, { expiresIn: '1h' });
                                    res.send({
                                        success: success,
                                        // data:result.rows[0],
                                        token
                                    })
                                } else {
                                    res.send({
                                        success: success,
                                    })
                                }
                            }
                        })
                    } catch (error) {
                        res.send({
                            message: error,
                            error: "Error in making request"
                        })
                    }
                }
                // IF USER NOT FOUND RETURN ERROR
                else {
                    res.send({
                        isSuccess: isSuccess,
                        message: "No user found with the given email address."
                    })
                }
            } catch (error) {
                res.send({
                    message: error,
                    error: "Error in making request"
                })
            }
        }
    });

router.post("/updatepassword",
    check("password").isLength({ min: 6 }),
    check("email").isEmail(),
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const email = req.body.email.toLowerCase();
            const password = req.body.password;

            const findUser = await db.query("SELECT email FROM users WHERE email = $1", [email]);

            if (findUser.rowCount > 0) {
                // Hash the new password
                const hashedPassword = await bcrypt.hash(password, saltRounds);

                // Update the password in the database
                const result = await db.query("UPDATE users SET password = $1, reset_password_timestamp = now() WHERE email = $2 RETURNING *", [hashedPassword, email]);

                if (result.rowCount > 0) {
                    return res.status(200).json({ message: "Password update successful" });
                } else {
                    return res.status(500).json({ message: "Error updating password" });
                }
            } else {
                return res.status(404).json({ message: "No user found with the given email address" });
            }
        } catch (error) {
            console.error("Error updating password:", error);
            return res.status(500).json({ message: "Error updating password" });
        }
    }
);


router.get("/getallcategories", async (req, res) => {
    try {
        // Fetch categories from the database
        const dbQuery = await db.query("SELECT id, name, image_path FROM categories");

        // Check if any categories were found
        if (dbQuery.rowCount === 0) {
            return res.status(404).json({ success: false, message: "No categories found" });
        }

        const categories = [];
        // Iterate through the fetched categories
        for (const category of dbQuery.rows) {
            const categoryName = category.name;
            const categoryImage = category.image_path;

            // Read image file asynchronously
            const filePath = new URL(categoryImage, import.meta.url);
            const contents = await fs.promises.readFile(filePath, { encoding: 'base64' });

            categories.push({ id: category.id, name: categoryName, image: contents });
        }

        // Send the categories as response
        return res.json({ success: true, data: categories });
    } catch (error) {
        console.error("Error fetching categories:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});


// TODO - Modify Salons in City Endpoint is when city is dynamic
router.get('/getallsalonsincity', async (req, res) => {
    const cityId = req.query.city_id; // Use req.query to access query parameters

    try {
        let query = 'SELECT * FROM branches WHERE city_id = $1 AND status = 1';
        const queryParams = [cityId];

        // Check for additional filtering parameters and modify the query accordingly
        let filterOption = req.query.filterOption;
        if (filterOption) { filterOption = filterOption.toLowerCase(); }
        if (filterOption) {
            if (filterOption == "unisex") {
                query += ' AND type = $2';
                queryParams.push(enums.salon_type.unisex);
            }
            if (filterOption == "womens") {
                query += ' AND type = $2';
                queryParams.push(enums.salon_type.womens);
            }
            if (filterOption == "mens") {
                query += ' AND type = $2';
                queryParams.push(enums.salon_type.mens);
            }
        }

        // Execute the modified query
        const salonBranches = await db.query(query, queryParams);

        if (salonBranches.rows.length === 0) {
            return res.json({ success: true, message: 'No salons found in the specified city.', salons: [] });
        }

        res.json({ success: true, salons: salonBranches.rows });
    } catch (error) {
        console.error('Error listing salons:', error);
        res.status(500).json({ success: false, message: 'Error listing salons.' });
    }
});

router.get('/getsalonvacancy', jsonParser,
    body('branch_id').isInt(),
    body("appointment_date").isDate(),
    body('services').isArray(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.json({
                success: false,
                message: "Validation Error Occurred",
                errors: errors.array(),
            });
        }

        try {
            const branch_id = req.body.branch_id;
            const formatedAppointmentDate = moment(req.body.appointment_date, 'YYYY/MM/DD').format("YYYY-MM-DD");
            const weekdayName = moment(formatedAppointmentDate).format('dddd').toLowerCase();

            const getBranchHours = await db.query("SELECT start_time, end_time FROM branch_hours WHERE branch_id = $1 AND day =$2 ", [branch_id, weekdayName]);
            if (getBranchHours.rows.length === 0) {
                return res.json({
                    success: false,
                    message: "Branch is closed on the selected day.",
                });
            }

            let branchStartTime = getBranchHours.rows[0].start_time;
            let branchEndTime = moment(getBranchHours.rows[0].end_time, 'HH:mm').subtract(30, 'minutes').format('HH:mm');

            const getHolidayHours = await db.query("SELECT * FROM holiday_hours WHERE branch_id = $1 AND $2 >= from_date AND $2 <= to_date AND status = 1", [branch_id, formatedAppointmentDate]);
            let isHoliday = false;
            let holidayEndTime = null;
            if (getHolidayHours.rows.length > 0) {
                const holidayHours = getHolidayHours.rows;
                for (const holiday of holidayHours) {
                    const fromDateTime = moment(holiday.from_date);
                    const toDateTime = moment(holiday.to_date);
                    if (moment(formatedAppointmentDate).isBetween(fromDateTime, toDateTime, null, '[]')) {
                        isHoliday = true;
                        holidayEndTime = toDateTime.format('HH:mm');
                        break;
                    }
                }
            }

            if (isHoliday) {
                // Set branch start time to holiday end time
                branchStartTime = holidayEndTime;
            }

            let getServiceTotalDuration = 0;

            for (const element of req.body.services) {
                const service_id = element.service_id;
                const getServiceDuration = await db.query("SELECT duration FROM services_options WHERE id = $1", [service_id]);
                const serviceDuration = parseInt(getServiceDuration.rows[0].duration);
                getServiceTotalDuration += serviceDuration;
            }

            let firstSlotStartTime = branchStartTime;

            // Calculate ending slot time by adding total service duration to starting slot time
            const endingSlotTime = moment(branchStartTime, 'HH:mm').add(getServiceTotalDuration, 'minutes').format('HH:mm');
            // Define slot interval (e.g., duration of the longest service)
            const slotInterval = getServiceTotalDuration; // You can adjust this according to your requirements

            // Initialize array to store slots
            const slots = [];

            // Generate slots until the adjusted branch end time
            let currentSlotStartTime = moment(branchStartTime, 'HH:mm'); // Start from the adjusted start time
            while (currentSlotStartTime.isSameOrBefore(moment(branchEndTime, 'HH:mm'))) {
                const slotEndTime = currentSlotStartTime.clone().add(slotInterval, 'minutes');
                slots.push({
                    start_time: currentSlotStartTime.format('HH:mm'),
                    end_time: slotEndTime.format('HH:mm')
                });
                currentSlotStartTime.add(slotInterval, 'minutes');
            }

            const getSalonSeats = await db.query("SELECT seats FROM branches where id=$1", [branch_id]);
            const seats = getSalonSeats.rows[0].seats;
            const availableSlots = [];
            const unavailableSlots = [];

            for (let i = 1; i <= seats; i++) {
                const seatNo = i;
                const appointments = await db.query("SELECT start_time, end_time FROM appointment WHERE branch_id = $1 AND seat_number = $2 AND appointment_date = $3", [branch_id, seatNo, formatedAppointmentDate]);

                // Check each slot against existing appointments
                for (const slot of slots) {
                    let isAvailable = true;
                    for (const appointment of appointments.rows) {
                        // Check if slot overlaps with any existing appointment
                        if (
                            (moment(slot.start_time, 'HH:mm').isSameOrAfter(moment(appointment.start_time, 'HH:mm')) && moment(slot.start_time, 'HH:mm').isSameOrBefore(moment(appointment.end_time, 'HH:mm'))) ||
                            (moment(slot.end_time, 'HH:mm').isSameOrAfter(moment(appointment.start_time, 'HH:mm')) && moment(slot.end_time, 'HH:mm').isSameOrBefore(moment(appointment.end_time, 'HH:mm'))) ||
                            (moment(slot.start_time, 'HH:mm').isSameOrBefore(moment(appointment.start_time, 'HH:mm')) && moment(slot.end_time, 'HH:mm').isSameOrAfter(moment(appointment.end_time, 'HH:mm')))
                        ) {
                            isAvailable = false;
                            break;
                        }
                    }
                    if (isAvailable) {
                        availableSlots.push(slot);
                    } else {
                        unavailableSlots.push(slot);
                    }
                }
            }

            // Return available and unavailable slots
            return res.json({
                success: true,
                message: "Appointment slots generated successfully.",
                available_slots: availableSlots,
                unavailable_slots: unavailableSlots
            });
        } catch (error) {
            console.error("Error generating appointment slots:", error);
            return res.status(500).json({
                success: false,
                message: "Error generating appointment slots."
            });
        }
    });

router.post("/bookappointment",
    check("user_id").isNumeric(),
    check("branch_id").isNumeric(),
    check("appointment_date").isDate(), check("start_time").custom(value => {
        return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value) ? true : (() => {
            throw new Error('Value must be in the time format HH:MM');
        })();
    }),
    authMiddleware,
    async (req, res) => {

        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return res.status(400).json({
                errors: errors.array()
            });
        }

        try {
            const {
                user_id,
                branch_id,
                appointment_date,
            } = req.body;
            let start_time = req.body.start_time;

            const status = enums.appointmentType.Pending_Payment_Confirmation;
            const services = req.body.services;
            const platform_coupon_id = req.body.platform_coupon_id || 0;

            let taxAmount = 0;
            let discountAmount = 0;
            let advance_percentage = 30;

            // Handle platform coupon discount
            if (!isNaN(platform_coupon_id) && parseInt(platform_coupon_id) !== 0) {
                const couponAmount = await db.query("SELECT discount_amount,advance_percentage FROM platform_coupon WHERE id = $1", [platform_coupon_id]);
                if (couponAmount.rowCount > 0) {
                    discountAmount = couponAmount.rows[0].discount_amount;
                    advance_percentage = couponAmount.rows[0].advance_percentage;
                } else {
                    return res.status(400).json({
                        success: false,
                        message: "Error applying discount coupon..."
                    });
                }
            }

            // Determine the weekday name of the appointment date
            const formattedAppointmentDate = moment(appointment_date, 'YYYY/MM/DD').format('YYYY-MM-DD');
            const appointmentWeekday = moment(formattedAppointmentDate).format('dddd').toLowerCase();
            // Query branch hours for the appointment weekday
            const branchHoursQuery = await db.query("SELECT start_time, end_time, status FROM branch_hours WHERE branch_id = $1 AND day = $2", [branch_id, appointmentWeekday]);
            if (branchHoursQuery.rowCount === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Salon is not open on the selected appointment day."
                });
            }

            // check if salon is on holiday on the selected day..
            const appointmentDateTime = new Date(`${appointment_date} ${start_time}`);
            const checkHolidayQuery = await db.query("SELECT id FROM holiday_hours WHERE branch_id = $1 AND $2 BETWEEN from_date AND to_date AND status = 1", [branch_id, appointmentDateTime]);
            if (checkHolidayQuery.rowCount > 0) {
                return res.status(400).json({ success: false, message: "The salon is closed for holiday on the selected appointment date." });
            }
            // Check if the salon is closed on the selected appointment day
            const branchStatus = branchHoursQuery.rows[0].status;
            if (branchStatus === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Salon is closed on the selected appointment day."
                });
            }

            // Extract start and end times from the query result
            const storeStartTime = branchHoursQuery.rows[0].start_time;
            const storeEndTime = branchHoursQuery.rows[0].end_time;

            // Convert start and end times to moment objects for comparison
            const momentStoreStartTime = moment(storeStartTime, 'HH:mm');
            const momentStoreEndTime = moment(storeEndTime, 'HH:mm');

            // Convert appointment start time to a moment object
            const momentAppointmentStartTime = moment(start_time, 'HH:mm');

            // Check if the appointment start time is outside of store hours
            if (momentAppointmentStartTime.isBefore(momentStoreStartTime) || momentAppointmentStartTime.isAfter(momentStoreEndTime)) {
                return res.status(400).json({
                    success: false,
                    message: "Appointment time is outside of store hours."
                });
            }

            // Initialize end time with the start time
            let endTime = moment(start_time, 'HH:mm');

            // Loop through each service and add its duration to the end time
            for (const serviceId of services) {
                const serviceOptionQuery = await db.query("SELECT duration FROM services_options WHERE id = $1", [serviceId]);
                const serviceDuration = serviceOptionQuery.rows[0].duration;

                // Add service duration to the end time
                endTime.add(serviceDuration, 'minutes');
            }

            // Format the end time back to HH:mm format
            endTime = moment(endTime, "HH:mm").subtract(1, "minutes").format('HH:mm');


            // Check available seats
            const checkSeatsQuery = await db.query("SELECT seats FROM branches WHERE id = $1", [branch_id]);
            const totalSeats = checkSeatsQuery.rows[0].seats;

            let availableSeat = 0;
            for (let seatNumber = 1; seatNumber <= totalSeats; seatNumber++) {
                const checkAppointmentsQuery = await db.query("SELECT id FROM appointment WHERE branch_id = $1 AND seat_number = $2 AND appointment_date = $3 AND ((start_time <= $4 AND end_time >= $4) OR (start_time <= $5 AND end_time >= $5))", [branch_id, seatNumber, appointment_date, start_time, endTime]);
                if (checkAppointmentsQuery.rowCount === 0) {
                    availableSeat = seatNumber;
                    break;
                }
            }

            if (availableSeat === 0) {
                return res.status(400).json({
                    success: false,
                    message: "No available seats for the given time slot."
                });
            }

            // Continue with the rest of the code...
            await db.query('BEGIN');

            let finalTotalDiscount = 0;
            let finalTotalTax = 0;
            let finalSubtotal = 0;

            start_time = moment(start_time, 'HH:mm').add(1, 'minutes').format('HH:mm');

            const createAppointment = await db.query("INSERT INTO appointment (user_id, branch_id, appointment_date, subtotal, total_discount, total_tax, net_amount, total_amount_paid, status, start_time, end_time, seat_number) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id", [user_id, branch_id, appointment_date, 0, 0, 0, 0, 0, status, start_time, endTime, availableSeat]);
            const appointmentId = createAppointment.rows[0].id;

            // Insert service options
            for (let index = 0; index < services.length; index++) {
                const getServicePrice = await db.query("SELECT price FROM services_options WHERE id = $1", [services[index]]);
                const servicePrice = parseFloat(getServicePrice.rows[0].price);
                const total_item_discount = discountAmount !== 0 ? parseFloat(servicePrice * (discountAmount / 100)) : 0;
                const total_tax = taxAmount !== 0 ? parseFloat(servicePrice * (taxAmount / 100)) : 0;
                const total_price_paid = 0;

                await db.query("INSERT INTO appointment_items (appointment_id,service_id,service_price,total_item_discount,total_tax,total_price_paid) VALUES ($1,$2,$3,$4,$5,$6)", [appointmentId, services[index], servicePrice, total_item_discount, total_tax, total_price_paid]);

                finalSubtotal += servicePrice;
                finalTotalDiscount += total_item_discount;
                finalTotalTax += total_tax;
            }


            const finalNetAmount = finalSubtotal - finalTotalDiscount + finalTotalTax;
            const updateAppointment = await db.query("UPDATE appointment SET subtotal = $1,total_discount=$2,total_tax=$3,net_amount=$4 WHERE id = $5 RETURNING *", [finalSubtotal, finalTotalDiscount, finalTotalTax, finalNetAmount, appointmentId]);

            let advance_amount = (finalNetAmount * advance_percentage) / 100;

            await db.query('COMMIT');
            res.json({
                success: true,
                message: "Appointment booked successfully.",
                data: updateAppointment.rows[0],
                advance_amount: parseFloat(`${advance_amount}`).toFixed(2)
            });
        } catch (error) {
            await db.query('ROLLBACK');
            console.error("Error making request:", error);
            res.status(500).json({
                success: false,
                message: "Error making request."
            });
        }
    });

// FIXME Maybe in this route we need to get the current total_price_paid from the tables and add it to the new payment amount... , also deicde when to add payment details in payment table whether in this route or payment route
router.put("/confirm-appointment",
    check('appointment_id').isInt(),
    check('paid_amount').isFloat(), async (req, res) => {

        // Validate request parameters
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const appointment_id = req.body.appointment_id;
            const paid_amount = req.body.paid_amount;

            // Start a database transaction
            await db.query("BEGIN");

            // Fetch the existing total_amount_paid from the database
            const getAppointment = await db.query("SELECT total_amount_paid FROM appointment WHERE id = $1", [appointment_id]);

            if (getAppointment.rowCount === 0) {
                await db.query('ROLLBACK');
                return res.status(404).json({ success: false, message: "Appointment not found." });
            }

            const existingPaidAmount = getAppointment.rows[0].total_amount_paid;

            // Calculate the new total_amount_paid
            const newTotalPaidAmount = existingPaidAmount + paid_amount;

            // Update total_amount_paid in the appointment table
            const updateAppointment = await db.query("UPDATE appointment SET total_amount_paid = $1 WHERE id = $2", [newTotalPaidAmount, appointment_id]);

            if (updateAppointment.rowCount === 0) {
                await db.query('ROLLBACK');
                return res.status(404).json({ success: false, message: "Appointment not found." });
            }

            // Fetch the service items associated with the appointment
            const getServiceItems = await db.query("SELECT * FROM appointment_items WHERE appointment_id = $1", [appointment_id]);

            if (getServiceItems.rowCount > 0) {
                const serviceItems = getServiceItems.rows;

                // Calculate the new total_price_paid for each service item
                for (const item of serviceItems) {
                    const newTotalPricePaid = item.service_price * (paid_amount / existingPaidAmount);
                    // Update total_price_paid for each service item
                    await db.query("UPDATE appointment_items SET total_price_paid = $1 WHERE id = $2", [newTotalPricePaid, item.id]);
                }
            }

            // Commit the transaction
            await db.query("COMMIT");

            return res.status(200).json({ success: true, message: "Appointment confirmed and total amount paid updated." });
        } catch (error) {
            // Rollback the transaction in case of an error
            await db.query('ROLLBACK');
            console.error("Error making request:", error);
            return res.status(500).json({ success: false, message: "Error making request." });
        }
    });



router.post("/add-to-cart",
    check('user_id').isInt(),
    check('branch_id').isInt(),
    check('services').isArray(),
    check('services.*').isInt(),
    authMiddleware, async (req, res) => {

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { user_id, branch_id, services } = req.body;

        try {
            // Check if there is any cart exists for the user
            const existingCart = await db.query("SELECT * FROM cart WHERE user_id = $1", [parseInt(user_id)]);

            if (existingCart.rows.length > 0) {
                // Cart exists for the user
                const cartBranchId = existingCart.rows[0].branch_id;

                // Check if the cart branch is the same as the branch user is adding services for
                if (cartBranchId === parseInt(branch_id)) {
                    // Insert services to cart_items, skipping those that already exist
                    for (let index = 0; index < services.length; index++) {
                        const existingService = await db.query("SELECT * FROM cart_items WHERE cart_id = $1 AND service_option_id = $2", [existingCart.rows[0].id, services[index]]);
                        if (existingService.rows.length === 0) {
                            const serviceDetails = await db.query("SELECT price FROM services_options WHERE id = $1", [services[index]]);

                            // Check if serviceDetails.rows.length is greater than 0 to ensure a valid service is found
                            if (serviceDetails.rows.length > 0) {
                                const price = serviceDetails.rows[0].price;

                                // Insert the service into the cart_items table with fetched price and total_tax
                                await db.query("INSERT INTO cart_items (cart_id, service_option_id, price, total_tax, total_amount_paid) VALUES ($1, $2, $3, $4, $5)", [existingCart.rows[0].id, services[index], price, 0, 0]);
                            } else {
                                // Handle the case where no valid service is found in the services_options table
                                console.error("No valid service found with service_option_id:", services[index]);
                            }
                        }
                    }

                    // Update cart table with the latest sum of all the amount columns
                    await db.query(`
                    UPDATE cart 
                    SET subtotal = (
                        SELECT COALESCE(SUM(price), 0) FROM cart_items WHERE cart_id = $1
                    ),
                    total_tax = (
                        SELECT COALESCE(SUM(total_tax), 0) FROM cart_items WHERE cart_id = $1
                    ),
                    total_amount_paid = (
                        SELECT COALESCE(SUM(total_amount_paid), 0) FROM cart_items WHERE cart_id = $1
                    )
                    WHERE id = $1
                `, [existingCart.rows[0].id]);

                    res.json({ success: true, message: "Services added to the cart successfully." });
                } else {
                    // Cart branch does not match the branch user is adding services for
                    res.status(400).json({ success: false, message: "Cannot add services to cart. Cart belongs to a different branch." });
                }
            } else {
                // No cart exists for the user, create a new cart and add services
                const newCart = await db.query("INSERT INTO cart (user_id, branch_id) VALUES ($1, $2) RETURNING id", [user_id, branch_id]);
                const cartId = newCart.rows[0].id;
                for (let index = 0; index < services.length; index++) {
                    const serviceDetails = await db.query("SELECT price FROM services_options WHERE id = $1", [services[index]]);

                    const price = serviceDetails.rows[0].price;

                    const insertCart = await db.query("INSERT INTO cart_items (cart_id, service_option_id, price, total_tax, total_amount_paid) VALUES ($1, $2, $3, $4, $5)", [cartId, services[index], price, 0, 0]);
                }

                // Update cart table with the latest sum of all the amount columns
                await db.query(`
                UPDATE cart 
                SET subtotal = (
                    SELECT COALESCE(SUM(price), 0) FROM cart_items WHERE cart_id = $1
                ),
                total_tax = (
                    SELECT COALESCE(SUM(total_tax), 0) FROM cart_items WHERE cart_id = $1
                ),
                total_amount_paid = (
                    SELECT COALESCE(SUM(total_amount_paid), 0) FROM cart_items WHERE cart_id = $1
                )
                WHERE id = $1
            `, [cartId]);

                res.json({ success: true, message: "Cart created and services added successfully." });
            }
        } catch (error) {
            console.error("Error adding services to cart:", error);
            res.status(500).json({ success: false, message: "Error adding services to cart." });
        }
    });

router.delete("/remove-from-cart",
    check('user_id').isInt(),
    check('branch_id').isInt(),
    check('serviceOptionId').isInt(),
    async (req, res) => {


        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { user_id, branch_id } = req.body;
        const serviceOptionId = req.body.serviceOptionId;

        try {
            // Check if the cart item exists and belongs to the specified user and branch
            const existingCartItem = await db.query("SELECT c.* FROM cart_items c INNER JOIN cart ON c.cart_id = cart.id WHERE c.service_option_id = $1 AND cart.user_id = $2 AND cart.branch_id = $3", [serviceOptionId, user_id, branch_id]);

            if (existingCartItem.rows.length > 0) {
                // Remove the cart item
                await db.query("DELETE FROM cart_items WHERE service_option_id = $1", [serviceOptionId]);

                // Fetch the cart ID for the updated cart
                const cartId = existingCartItem.rows[0].cart_id;

                // Update the cart table with the latest sum of all the amount columns
                await db.query(`
                UPDATE cart 
                SET subtotal = (
                    SELECT COALESCE(SUM(price), 0) FROM cart_items WHERE cart_id = $1
                ),
                total_tax = (
                    SELECT COALESCE(SUM(total_tax), 0) FROM cart_items WHERE cart_id = $1
                ),
                total_amount_paid = (
                    SELECT COALESCE(SUM(total_amount_paid), 0) FROM cart_items WHERE cart_id = $1
                )
                WHERE id = $1
            `, [cartId]);

                res.json({ success: true, message: "Cart item removed successfully." });
            } else {
                // Cart item not found or does not belong to the specified user and branch
                res.status(404).json({ success: false, message: "Cart item not found or does not belong to the specified user and branch." });
            }
        } catch (error) {
            console.error("Error removing cart item:", error);
            res.status(500).json({ success: false, message: "Error removing cart item." });
        }
    });

router.delete('/cartdeleteall',
    check('userId').isInt(),
    authMiddleware,
    async (req, res) => {

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const userId = req.body.user_id;

        try {
            await db.query('BEGIN');

            // Get the cart_id associated with the user_id
            const cartQuery = await db.query('SELECT id FROM cart WHERE user_id = $1', [userId]);

            if (cartQuery.rows.length === 0) {
                await db.query('ROLLBACK');
                return res.status(404).json({ success: false, message: 'Cart not found for the user.' });
            }

            const cartId = cartQuery.rows[0].id;

            // Delete all cart items associated with the cart_id
            await db.query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);

            // Delete the cart record for the user
            await db.query('DELETE FROM cart WHERE id = $1', [cartId]);

            await db.query('COMMIT');

            res.json({ success: true, message: 'Cart deleted successfully.' });
        } catch (error) {
            await db.query('ROLLBACK');
            console.error('Error deleting cart:', error);
            res.status(500).json({ success: false, message: 'Error deleting cart.' });
        }
    });

router.get("/getcartcount",
    check('user_id').isInt(),
    authMiddleware, async (req, res) => {

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const user_id = req.body.user_id;

        try {
            // Query to get the number of items and branch_id associated with the user's cart
            const cartDetails = await db.query(`
            SELECT COUNT(*) AS item_count, c.branch_id
            FROM cart_items ci
            INNER JOIN cart c ON ci.cart_id = c.id
            WHERE c.user_id = $1
            GROUP BY c.branch_id
        `, [user_id]);

            if (cartDetails.rows.length === 0) {
                // If no rows are returned, set item_count to 0
                res.json({ success: true, item_count: 0, branch_id: null });
                return;
            }
            // Extract the item count and branch_id from the result
            const { item_count, branch_id } = cartDetails.rows[0];

            res.json({ success: true, item_count, branch_id });
        } catch (error) {
            console.error('Error fetching cart item count:', error);
            res.status(500).json({ success: false, message: 'Error fetching cart item count.' });
        }

    });

// router.get("/getsalonsbyfilter",)
// router.get("/searchservices",)
// router.get("/searchsalons",)
// router.get("/getsalondetails",)

router.get('/getsalonservices', check("id").isInt(), authMiddleware, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.send({ errors: errors.array() });
    }
    try {
        const branch_id = req.query.id;
        const departmentsQuery = await db.query("SELECT * FROM department");
        const departments = {};

        // Iterate over departments
        for (const department of departmentsQuery.rows) {
            const departmentName = department.name;
            departments[departmentName] = {};

            // Get services for the current department
            const servicesQuery = await db.query("SELECT * FROM services WHERE branch_id = $1 AND department = $2 AND status = $3", [branch_id, department.id, enums.is_active.yes]);

            // Iterate over services for the current department
            for (const service of servicesQuery.rows) {
                const categoryId = service.category_id;

                // Get category name for the current service
                const categoryQuery = await db.query("SELECT name FROM categories WHERE id = $1", [categoryId]);
                const categoryName = categoryQuery.rows[0].name;

                // Get service options for the current service
                const serviceOptionsQuery = await db.query("SELECT * FROM services_options WHERE service_id = $1 AND status = $2", [service.id, enums.is_active.yes]);
                const serviceOptions = serviceOptionsQuery.rows;

                // Skip adding service if it doesn't have any service options
                if (serviceOptions.length === 0) {
                    continue;
                }

                // Initialize the category if it doesn't exist
                if (!departments[departmentName][categoryName]) {
                    departments[departmentName][categoryName] = [];
                }

                // Add service with its options to the category
                departments[departmentName][categoryName].push({
                    service_id: service.id,
                    service_name: service.name,
                    service_options: serviceOptions
                });
            }
        }

        res.json({ success: true, departments: departments });
    } catch (error) {
        console.error('Error fetching services:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});





// router.get("/getsalonoffers",)
// router.get("/checkcurrentcartstatus",)
// router.get("/updatecart",)
// router.get("/updateservicewishlist",)
// router.get("/updatesalonwishlist",)
// router.get("/getsalonvacancy",)
// router.get("/initiateadvancepayment",)
// router.get("/initiatepostservicepayment",)
// router.get("/getbookingshistory",)
// router.get("/cancelappointment",)
// router.get("/rescheduleappointment",)
// router.get("/getappointmentdetails",)
// router.get("/getwishlisteditems",)


router.get('/getbranchwithid', check("id").isInt(), async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: "Validation Error Occurred", errors: errors.array() });
    }

    const branch_id = req.query.id;

    try {
        const result = await db.query("SELECT * FROM branches WHERE id = $1", [branch_id]);
        // Check if a branch with the specified ID exists
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Branch not found." });
        }
        res.status(200).json({
            success: true,
            data: result.rows[0] // Access the first row directly
        });
    } catch (error) {
        console.error("Error fetching branch:", error);
        res.status(500).json({ success: false, message: "Error fetching branch." });
    }
});

router.get("/getappointmentdetails", authMiddleware, async (req, res) => {
    var id = parseInt(req.query.id);
    try {
        const result = await db.query("SELECT * from appointment where appointment_id=$1", [id]);
        res.send(result.rows);
    } catch (error) {
        console.log(error)
    }
})


router.get("/initializepayment", authMiddleware, async (req, res) => {
    res.send("You are in")
})

router.get("/getallpayments", authMiddleware, async (req, res) => {
    try {
        const result = await db.query("SELECT * from payments");
        res.send(result.rows);
    } catch (error) {
        console.log(error)
    }
})





export default router;