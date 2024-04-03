import express from "express";
import bodyParser from "body-parser";
import db from "../db.js";
import axios from "axios";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import authMiddleware from '../middleware/authMiddleware.js';
import { check, body, validationResult } from 'express-validator';
import nodemailer from "nodemailer";
import moment from "moment";
import dotenv from "dotenv";
import * as enums from "../enums.js"
import { fileURLToPath } from 'url';
import path, { parse } from 'path';
import fs from 'fs/promises';

const router = express.Router();


router.get("/testsalonifycustomerroute", (req, res) => {

    console.log("Test Succesfull.")
})

const SecretKey = process.env.SecretKey;
export const app = express();
const saltRounds = Number(process.env.saltrounds);


app.use(bodyParser.urlencoded({ extended: true, }));


router.post("/sendOTP",
    check("email").isEmail(),
    async (req, res) => {
        // IF VALIDATION ERRORS RETURN ERRORS
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.send(errors);
        }
        else {
            // ELSE TRY FINDING CUSTOMER WITH THE PROVIDED EMAIL
            try {
                const email = req.body.email.toLowerCase();
                console.log(email)
                const findCustomer = await db.query("SELECT * FROM users WHERE email like $1 AND status = $2 ", [email, enums.is_active.yes]);
                // IF CONDITION TO CHECK IF CUSTOMER WITH GIVEN MAIL IS FOUND
                if (findCustomer.rowCount > 0) {
                    const OTP = Math.floor(Math.random().toPrecision() * 100000);
                    const customer_id = findCustomer.rows[0].id;
                    try {
                        // IF FOUND UPDATE OTP,VALIDITY AND TIMESTAMP IN THE DATABASE
                        const result = await db.query("UPDATE users SET OTP=$1, otp_validity=20, reset_password_timestamp = now() WHERE id =$2 RETURNING *", [OTP, customer_id])
                        //SEND OTP MAIL TO THE CUSTOMER
                        const info = await transpoter.sendMail({
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
                    console.log("not found");
                    res.send("OTP sent to Registered mail address.")
                }
            } catch (error) {
                res.send(error);
            }
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
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            res.send(errors);
        } else {

            try {
                const email = req.body.email.toLowerCase();
                const password = req.body.password;
                const name = req.body.fName + " " + req.body.lName;
                const phone_number = req.body.phone_number;
                const dob = req.body.dob;
                var isSuccess = false;


                //CHECK EXISTENCE OF MOBILE AND EMAIL IN DATABASE, IF EXISTS RETURN ERROR MESSAGE
                const checkEmailExistence = await db.query("SELECT * FROM users WHERE email = $1 AND status = $2 AND user_type = $3", [email, enums.is_active.yes, enums.UserType.customer]);
                const checkMobileExistence = await db.query("SELECT * FROM users WHERE phone_number = $1 AND status = $2 AND user_type = $3 ", [phone_number, enums.is_active.yes, enums.UserType.customer]);

                if (checkEmailExistence.rows.length > 0) {
                    const user = checkEmailExistence.rows[0];
                    if (user.email == email) {
                        res.send(
                            {
                                isSuccess: isSuccess,
                                message: "User with this email is already registered, please login..."
                            });
                    }
                }
                else if (checkMobileExistence.rows.length > 0) {
                    const user = checkMobileExistence.rows[0];
                    if (user.phone_number == mobile) {
                        res.send({
                            isSuccess: isSuccess,
                            message: "User with this phone number is already registered, please login..."
                        });
                    }
                }

                // ELSE INSERT NEW CUSTOMER AND RETURN CUSTOMER ID
                else {
                    bcrypt.hash(password, saltRounds, async (err, hash) => {
                        if (err) {
                            console.log("Error hashing password", err);
                            res.send("Error in making request, contact administrator");
                        } else {
                            try {
                                const result = await db.query("INSERT INTO users (email,password,name,phone_number,dob,user_type,status,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) returning *", [email, hash, name, phone_number, dob, enums.UserType.customer, enums.is_active.yes, moment().format()]);
                                if (result.rows.length > 0) {
                                    isSuccess = true;
                                }
                                else {
                                    isSuccess = false;
                                }
                                res.status(200).send({
                                    isSuccess: isSuccess,
                                    id: result.rows[0].id
                                });
                            } catch (error) {
                                console.log(error);
                            }

                        }
                    })
                }
            } catch (error) {
                console.log(error)
            }
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

router.post("/updatepassword", check("password").isLength({ min: 6 }), check("email").isEmail(), async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        // If there are validation errors, render the form again with errors
        res.send({ errors: errors.array() });
    } else {
        const email = req.body.email.toLowerCase();
        const password = req.body.password;
        try {
            const findUser = await db.query("SELECT email FROM users WHERE email = $1", [email]);

            if (findUser.rowCount > 0) {
                console.log("you in")
                bcrypt.hash(password, saltRounds, async (err, hash) => {
                    if (err) {
                        console.log("Error hashing password", err);
                        res.send("Error in making request, contact administrator");
                    } else {
                        try {
                            console.log("you are in")
                            const result = await db.query("UPDATE users SET password = $1,reset_password_timestamp=now() where email = $2 RETURNING *", [hash, email]);

                            if (result.rowCount > 0) {
                                res.send({ message: "Password Update Succsefull" });
                            } else {
                                res.send({ message: "Error updating password" })
                            }
                        }
                        catch (err) {
                            console.log(err);
                            res.status(404).send("Error in making request. " + err);
                        }
                    }
                })
            }
            else {
                res.status(200).send("No user found with given email address");
            }
        } catch (err) {
            res.send(err)
        }
    }
});

router.get("/getallcategories", authMiddleware, async (req, res) => {

    const dbquery = await db.query("SELECT name, image_path from categories")
    const categories = [];

    for (let index = 0; index < dbquery.rowCount; index++) {
        const categoryNames = dbquery.rows[index].name;
        const categoryImage = dbquery.rows[index].image_path;
        try {
            const filePath = new URL(categoryImage, import.meta.url);
            const contents = await fs.readFile(filePath);
            // console.log(contents);  
            categories.push({ name: categoryNames, image: contents.toString('base64') })
        } catch (err) {
            console.log(err.message);
        }

    }
    res.send(categories)

});

// TODO - Modify Salons in City Endpoint is when city is dynamic
app.get('/getallsalonsincity', async (req, res) => {
    const cityId = req.body.city_id;

    try {
        // Query the branches table to retrieve salon branches in the specified city
        const salonBranches = await db.query('SELECT * FROM branches WHERE city_id = $1', [cityId]);

        // If no salon branches are found in the specified city, return an empty array
        if (salonBranches.rows.length === 0) {
            res.json({ success: true, message: 'No salons found in the specified city.', salons: [] });
            return;
        }

        // If salon branches are found, return them in the response
        res.json({ success: true, salons: salonBranches.rows });
    } catch (error) {
        console.error('Error listing salons:', error);
        res.status(500).json({ success: false, message: 'Error listing salons.' });
    }
});


// router.post("/bookappointment",
//     check("user_id").isNumeric(),
//     check("branch_id").isNumeric(),
//     check("appointment_date").isDate(),
//     check("start_time").custom(value => {
//         return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value) ? true : (() => { throw new Error('Value must be in the time format HH:MM') })();
//     }),
//     authMiddleware, async (req, res) => {

//         // TODO continue creating appointment api once creating salon and branch is finished...
//         // TODO validate seat booking before appointment creation...
//         // TODO update and set user cart items as inactive 
//         // TODO 

//         const errors = validationResult(req);
//         if (!errors.isEmpty()) {
//             return res.status(400).json({ errors: errors.array() });
//         }

//         try {
//             const { user_id, branch_id, appointment_date, start_time, end_time } = req.body;
//             const status = enums.appointmentType.Pending_Payment_Confirmation;
//             const seat_number = 2;
//             const services = req.body.services;
//             const platform_coupon_id = req.body.platform_coupon_id || 0;

//             let taxAmount = 0; // TAX AMOUNT
//             let discountAmount = 0; // DISCOUNT AMOUNT INITALLY SET TO 0
//             let advance_percentage = 30; // INITIALLY SET TO 30 BELIEVING NO COUPON USED...
//             if (!isNaN(platform_coupon_id) && parseInt(platform_coupon_id) !== 0) {
//                 const result = await db.query("SELECT * FROM platform_coupon WHERE id = $1", [platform_coupon_id]);
//                 if (result.rowCount > 0) {
//                     discountAmount = result.rows[0].discount_amount;
//                     advance_percentage = result.rows[0].advance_percentage;
//                 }
//             }


//             await db.query('BEGIN');

//             let finalTotalDiscount = 0;
//             let finalTotalTax = 0;
//             let finalSubtotal = 0;

//             const createAppointment = await db.query("INSERT INTO appointment (user_id, branch_id, appointment_date, subtotal, total_discount, total_tax, net_amount, total_amount_paid, status, start_time, end_time, seat_number) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id", [user_id, branch_id, appointment_date, 0, 0, 0, 0, 0, status, start_time, end_time, seat_number]);
//             const appointmentId = createAppointment.rows[0].id;
//             for (let index = 0; index < services.length; index++) {

//                 const getServicePrice = await db.query("SELECT price FROM services_options WHERE id = $1", [services[index]]);
//                 const servicePrice = getServicePrice.rows[0].price;
//                 const total_item_discount = discountAmount !== 0 ? servicePrice * (discountAmount / 100) : 0;
//                 const total_tax = taxAmount !== 0 ? servicePrice * (taxAmount / 100) : 0;
//                 const total_price_paid = 0;

//                 await db.query("INSERT INTO appointment_items (appointment_id,service_id,service_price,total_item_discount,total_tax,total_price_paid) VALUES ($1,$2,$3,$4,$5,$6)", [appointmentId, services[index], servicePrice, total_item_discount, total_tax, total_price_paid]);

//                 finalSubtotal += servicePrice;
//                 finalTotalDiscount += total_item_discount;
//                 finalTotalTax += total_tax;
//             }


//             const finalNetAmount = (finalSubtotal - finalTotalDiscount) + finalTotalTax;
//             const updateAppointment = await db.query("UPDATE appointment SET subtotal = $1,total_discount=$2,total_tax=$3,net_amount=$4 WHERE id = $5 RETURNING *", [finalSubtotal, finalTotalDiscount, finalTotalTax, finalNetAmount, appointmentId]);

//             let advance_amount = (finalNetAmount * advance_percentage) / 100;

//             await db.query('COMMIT');
//             res.json({ success: true, message: "Appointment booked successfully.", data: updateAppointment.rows[0], advance_amount: advance_amount });
//         } catch (error) {
//             await db.query('ROLLBACK');
//             console.error("Error making request:", error);
//             res.status(500).json({ success: false, message: "Error making request." });
//         }
//     });

router.post("/bookappointment",
    check("user_id").isNumeric(),
    check("branch_id").isNumeric(),
    check("appointment_date").isDate(),
    check("start_time").custom(value => {
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
                start_time
            } = req.body;
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

            // check if salon is on holiday on the selected day...

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
            endTime = endTime.format('HH:mm');


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





router.post("/confirm-appointment",
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
            await db.query("BEGIN")
            // Update total_amount_paid in the appointment table
            const updateAppointment = await db.query("UPDATE appointment SET total_amount_paid = $1 WHERE id = $2", [paid_amount, appointment_id]);
            if (updateAppointment.rowCount > 0) {
                // Get appointment items
                const getAppointmentItems = await db.query("SELECT * from appointment_items WHERE appointment_id = $1", [appointment_id]);
                if (getAppointmentItems.rowCount > 0) {
                    const appointmentItems = getAppointmentItems.rows;

                    // Calculate the total price of all items
                    let totalPrice = 0;

                    for (let index = 0; index < appointmentItems.length; index++) {
                        totalPrice += appointmentItems[index].service_price;
                    }

                    // Update each appointment item with the paid amount
                    for (const item of appointmentItems) {
                        const paidPrice = item.service_price * (paid_amount / totalPrice);
                        const updateItem = await db.query("UPDATE appointment_items SET total_price_paid = $1 WHERE id = $2", [paidPrice, item.id]);
                    }
                    await db.query("COMMIT")
                    res.status(200).json({ success: true, message: "Appointment confirmed and items marked as paid." });
                } else {
                    res.status(404).json({ success: false, message: "Appointment items not found." });
                }
            } else {
                res.status(404).json({ success: false, message: "Appointment not found." });
            }
        } catch (error) {
            await db.query('ROLLBACK');
            console.error("Error making request:", error);
            res.status(500).json({ success: false, message: "Error making request." });
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

router.get('/getSalonServices', authMiddleware, check("salonId").isNumeric(), async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        // If there are validation errors, render the form again with errors
        res.send({ errors: errors.array() });
    } else {
        try {
            const { salonId } = req.query;
            // Query to fetch services offered by the specified salon
            const result = await db.query(`
            SELECT s.service_id, s.service_name,s.price,s.duration,s.is_active, v.variant_id, v.name AS variant_name, v.price AS variant_price
            FROM public.service s
            LEFT JOIN public.service_variant v ON s.service_id = v.service_id
            WHERE s.salon_id = $1
            ORDER BY s.service_id, v.variant_id;
        `, [salonId]);

            const rows = result.rows;
            // Execute query
            // const { rows } = await pool.query(query, [salonId]);

            // Organize data into a structured format
            const services = [];
            let currentService = null;

            // Loop through the rows returned by the query
            for (const row of rows) {
                // Check if this row is for a new service
                if (!currentService || currentService.service_id !== row.service_id) {
                    // If so, create a new service object
                    currentService = {
                        service_id: row.service_id,
                        service_name: row.service_name,
                        service_price: row.price,
                        service_duration: row.duration,
                        is_active: row.is_active,
                        variants: [],
                    };
                    // Push the new service object into the services array
                    services.push(currentService);
                }

                // If the row has variant data, add it to the current service's variants array
                if (row.variant_id) {
                    currentService.variants.push({
                        variant_id: row.variant_id,
                        variant_name: row.variant_name,
                        variant_price: row.variant_price,
                    });
                }
            }

            // Send the structured data as the API response
            res.json({ services });
        } catch (error) {
            console.error('Error fetching services:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
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


router.get("/getsalonwithid", authMiddleware, async (req, res) => {
    var id = parseInt(req.query.salonId);
    try {
        const result = await db.query("SELECT * from salon where salon_id=$1", [id]);
        if (result.rowCount > 0) {
            const data = {
                salon_name: result.rows[0].salon_name,
                location: result.rows[0].location,
                contact_number: result.rows[0].contact_number,
                description: result.rows[0].description,
                is_active: result.rows[0].is_active,
                email: result.rows[0].email,
                salon_id: result.rows[0].salon_id,
            }
            res.send(data);
        } else {
            res.send({ message: "No Salon Found" });
        }
    } catch (error) {
        console.log(error)
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