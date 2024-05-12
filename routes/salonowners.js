import express, { application, response } from "express";
import bodyParser from "body-parser";
import db from "../database.js";
// import bcrypt, { compareSync } from "bcrypt";
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken";
import authMiddleware from '../middleware/authMiddleware.js';
import { check, body, validationResult, header } from 'express-validator';
import nodemailer from "nodemailer";
import moment from "moment";
import dotenv from "dotenv";
import * as enums from "../enums.js"
import { fileURLToPath } from 'url';
import path, { parse } from 'path';
import fs, { appendFile, appendFileSync, stat } from 'fs';

const router = express.Router();
const saltRounds = Number(process.env.saltrounds);
const SecretKey = process.env.SecretKey;


var jsonParser = bodyParser.json();

let transporter =
    nodemailer.createTransport(
        {
            service: 'gmail',
            auth: {
                user: 'nanditsareria@gmail.com',
                pass: `${process.env.mailPass}`,
            }
        }
    );


router.get("/testsalonownerroute", async (req, res) => {
});

//TODO we have to have a functionality where different branches can signup with their own registered email and password
//TODO we have to add latitude / logitude with the queries
router.post("/registersalon",
    check("email").trim().isEmail().not().isEmpty(),
    check("password").trim().isLength({ min: 6 }),
    check("personalName").trim().isString().not().isEmpty(),
    check("personalPhone").trim().isMobilePhone().not().isEmpty(),
    check("image").isBase64().not().isEmpty(),
    check("salon_name").trim().isString().not().isEmpty().not().isEmpty(),
    check("contact_number").trim().isNumeric().not().isEmpty(),
    check("salonDescription").trim().isString().not().isEmpty(),
    check("location").trim().isString().not().isEmpty(),
    check("address").trim().isString().not().isEmpty(),
    check("type").trim().isNumeric().not().isEmpty(),
    check("seats").trim().isNumeric().not().isEmpty(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }

        const {
            email,
            password,
            personalName,
            personalPhone,
            dob,
            salon_name,
            contact_number,
            salonDescription,
            location,
            address,
            type,
            seats,
            image,
            city_id,
            latitude,
            longitude
        } = req.body;

        const filePath = path.join(process.cwd(), '/public/salonimages/', salon_name + ".png");

        try {
            const [emailExistence, phoneExistence] = await Promise.all([
                db.query("SELECT email FROM users WHERE email = $1", [email]),
                db.query("SELECT phone_number FROM users WHERE phone_number = $1", [personalPhone])
            ]);

            if (emailExistence.rowCount > 0) {
                return res.status(409).json({ success: false, message: "A user is already registered with this email address.", data: [] });
            }

            if (phoneExistence.rowCount > 0) {
                return res.status(409).json({ success: false, message: "A user is already registered with this phone number.", data: [] });
            }

            const hashedPassword = await bcrypt.hash(password, saltRounds);
            const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
            const imageBuffer = Buffer.from(base64Data, 'base64');

            await fs.promises.writeFile(filePath, imageBuffer);

            await db.query("BEGIN");

            const registerUser = await db.query("INSERT INTO users (email,password,name,phone_number,dob,user_type) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id;", [email, hashedPassword, personalName, personalPhone, dob, enums.UserType.salon_admin]);
            const registerSalon = await db.query("INSERT INTO saloon (user_id,saloon_name,contact_number,description) VALUES ($1,$2,$3,$4) RETURNING id;", [registerUser.rows[0].id, salon_name, contact_number, salonDescription]);
            const registerBranch = await db.query("INSERT INTO branches (saloon_id,name,city_id,address,type,latitude,seats,longitude) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id", [registerSalon.rows[0].id, salon_name, city_id, address, type, latitude, seats, longitude]);

            await db.query("COMMIT");

            return res.status(201).json({ success: true, message: "Salon registered successfully.", data: [{ branch_id: registerBranch.rows[0].id }] });
        } catch (error) {
            await db.query("ROLLBACK");
            console.error("Error registering salon:", error);
            return res.status(500).json({ success: false, message: "Error registering salon.", data: [] });
        }
    });


router.post("/login", check("email").isEmail(), check("password").not().isEmpty(), async (req, res) => {

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
    }
    const { email, password } = req.body;

    try {
        const result = await db.query(`SELECT * FROM "users" WHERE "email" = $1 AND status = $2 AND user_type = $3`, [email.toLowerCase(), enums.is_active.yes, enums.UserType.salon_admin]);


        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: "No user found with the given email address.", data: [] });
        }


        const user = result.rows[0];
        const getBranchDetails = await db.query('select * from branches where saloon_id = (select id from saloon where user_id = $1)', [user.id]);
        bcrypt.compare(password, user.password, (err, passwordMatch) => {
            if (err || !passwordMatch) {
                return res.status(401).json({ success: false, message: "Invalid email or password.", data: [] });
            }
            const token = jwt.sign({ user }, SecretKey, { expiresIn: '1h' });
            return res.json({ success: true, token, user_id: user.id, branch_id: getBranchDetails.rows[0].id });
        });
    } catch (error) {
        console.error("Error in login:", error);
        return res.status(500).json({ success: false, message: "Internal server error.", data: [] });
    }
});

router.post("/sendOTP", check("email").isEmail(), async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }

        const email = req.body.email.toLowerCase();
        const findOwner = await db.query("SELECT * FROM users WHERE email = $1 AND status = $2 AND user_type=$3", [email, enums.is_active.yes, enums.UserType.salon_admin]);

        if (findOwner.rowCount > 0) {
            const OTP = Math.floor(Math.random().toPrecision() * 100000);
            const customer_id = findOwner.rows[0].id;

            // Update OTP and other details in parallel
            const [updateResult, sendMailResult] = await Promise.all([
                db.query("UPDATE users SET OTP=$1, otp_validity=20, reset_password_timestamp = now() WHERE id =$2 RETURNING *", [OTP, customer_id]),
                transporter.sendMail({
                    from: "Salonify",
                    to: `${email}`,
                    subject: "Salonify: OTP to Reset your password",
                    html: `Hello, ${email}<br>Please use below mentioned OTP to reset your password.<br><h1>${OTP}</h1>`
                })
            ]);

            return res.json({
                success: true,
                message: "OTP Sent to Registered mail address.",
                data: ({ otp: updateResult.rows[0].otp })
            });
        } else {
            return res.json({ success: true, message: "OTP sent to Registered mail address.", data: [] });
        }
    } catch (error) {
        res.json({ success: false, message: "Internal Server Error Occurred.", data: [] });
    }
});

router.post("/updatepassword",
    check("password").isLength({ min: 6 }),
    check("email").isEmail(),
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
            }

            const email = req.body.email.toLowerCase();
            const password = req.body.password;

            const findUser = await db.query("SELECT email FROM users WHERE email = $1 AND user_type = $2 AND status = $3", [email, enums.UserType.salon_admin, enums.is_active.yes]);

            if (findUser.rowCount > 0) {
                // Hash the new password
                const hashedPassword = await bcrypt.hash(password, saltRounds);

                // Update the password in the database
                const result = await db.query("UPDATE users SET password = $1, reset_password_timestamp = now() WHERE email = $2 RETURNING *", [hashedPassword, email]);

                if (result.rowCount > 0) {
                    return res.status(200).json({ success: true, message: "Password Updated Successfully", data: [] });
                } else {
                    return res.status(500).json({ success: false, message: "Error updating password", data: [] });
                }
            } else {
                return res.status(404).json({ success: false, message: "No user found with the given email address", data: [] });
            }
        } catch (error) {
            console.error("Error updating password:", error);
            return res.status(500).json({ success: true, message: "Error updating password", data: [] });
        }
    }
);

router.get("/dashboard", check('user_id').isInt(), authMiddleware, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }

        const user_id = req.query.user_id;
        const branch_id = req.query.branch_id;

        // Get User Information
        const getUserInfo = await db.query("SELECT name FROM users WHERE id = $1 AND status = $2 AND user_type = $3", [user_id, enums.is_active.yes, enums.UserType.salon_admin]);
        if (getUserInfo.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found.",
                data: []
            });
        }
        const userInfo = getUserInfo.rows[0];
        const { name: user_name } = userInfo;
        // Get Salon Information
        const getSalonInfo = await db.query(`select saloon.id,saloon.user_id , saloon.saloon_name from saloon left join branches on saloon.id = branches.saloon_id 
        WHERE saloon.user_id = $1 AND branches.id = $2 AND branches.status = $3`, [user_id, branch_id, enums.is_active.yes]);
        if (getSalonInfo.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Saloon/Branch not found",
                data: []
            })
        }
        const salonInfo = getSalonInfo.rows[0];
        const { id: saloon_id, saloon_name: salon_name } = salonInfo;

        // Get Branches
        const getBranches = await db.query("SELECT * FROM branches WHERE saloon_id = $1 AND status = $2", [saloon_id, enums.is_active.yes]);
        const branches = getBranches.rows;

        // Check if there are any offers available to participate
        const checkOffers = await db.query('select count(*) from platform_coupon WHERE id NOT IN (select platform_coupon_id from platform_coupon_branch WHERE branch_id = $1) AND status = $2', [branch_id, enums.is_active.yes]);
        const offersCount = parseInt(checkOffers.rows[0].count);
        const offerbannertoshow = offersCount > 0;

        const data = {
            user: { name: user_name, salon_name: salon_name },
            branches: branches,
            offerbannertoshow: offerbannertoshow
        };

        res.json({ success: true, data: data, message: "OK" });
    } catch (error) {
        console.error("Error in dashboard route:", error);
        res.status(500).json({
            success: false,
            data: [],
            message: "Internal server error."
        });
    }
});


router.get("/appoitmentanalyticswithdaterange", check("branch_id").isInt(), check("from_date_range").isDate().optional(), check("to_date_range").isDate().optional(), authMiddleware, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
    }
    try {
        let from_date_range = moment();
        let to_date_range = moment();
        // If no date range provided, use current date
        if (req.query.from_date_range && req.query.to_date_range) {
            from_date_range = moment(req.query.from_date_range).format("YYYY-MM-DD");
            to_date_range = moment(req.query.to_date_range).format("YYYY-MM-DD");
        }

        // Parse date range using Moment.js
        const momentFromDateRange = moment(from_date_range).format("YYYY-MM-DD");
        const momentToDateRange = moment(to_date_range).format("YYYY-MM-DD");
        const branch_id = req.query.branch_id;

        // Fetch appointments within the specified date range
        const getAppointmentData = await db.query("SELECT * FROM appointment WHERE branch_id = $1 AND appointment_date >= $2 AND appointment_date <= $3 AND status NOT IN ($4);", [branch_id, momentFromDateRange, momentToDateRange, enums.appointmentType.Pending_Payment_Confirmation]);

        const total_appointments = getAppointmentData.rows.length;

        let completedAppointments = 0;
        let cancelledAppointments = 0;

        // Count completed and cancelled appointments
        for (const appointment of getAppointmentData.rows) {
            if (parseInt(appointment.status) === enums.appointmentType.Closed) {
                completedAppointments++;
            }
            if (parseInt(appointment.status) === enums.appointmentType.Cancelled) {
                cancelledAppointments++;
            }
        }

        // Calculate expected sales within the date range
        const getExpectedSales = await db.query("SELECT SUM(net_amount) FROM appointment WHERE status IN ($1, $2, $3) AND branch_id = $4 AND appointment_date >= $5 AND appointment_date <= $6;", [enums.appointmentType.Confirmed, enums.appointmentType.Closed, enums.appointmentType.NoShow, branch_id, momentFromDateRange, momentToDateRange]);
        const expectedSales = getExpectedSales.rows[0].sum;

        res.json({
            success: true,
            data: {
                total_appointments: total_appointments,
                completed: completedAppointments,
                cancelled: cancelledAppointments,
                expectedSales: expectedSales
            },
            message: "OK"
        });
    } catch (error) {
        console.log(error)
        res.status(500).json({ success: false, message: "Internal Server Error", data: [] });
    }
});

router.get("/paymentswithdaterange", check("branch_id").isInt(), check("from_date_range").isDate().optional(), check("to_date_range").isDate().optional(), authMiddleware, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
    }
    try {
        let from_date_range = moment().format("YYYY-MM-DD");
        let to_date_range = moment().format("YYYY-MM-DD");
        // If no date range provided, use current date
        if (req.query.from_date_range && req.query.to_date_range) {
            from_date_range = moment(req.query.from_date_range).format("YYYY-MM-DD");
            to_date_range = moment(req.query.to_date_range).format("YYYY-MM-DD");
        }

        // Parse date range using Moment.js
        const momentFromDateRange = moment(from_date_range).format("YYYY-MM-DD");
        const momentToDateRange = moment(to_date_range).format("YYYY-MM-DD");
        const branch_id = req.query.branch_id;

        const getNetSales = await db.query("SELECT SUM(total_amount_paid) FROM appointment WHERE status = $1 AND appointment_date >= $2 AND appointment_date <= $3 AND branch_id = $4", [enums.appointmentType.Closed, from_date_range, to_date_range, branch_id]);
        const netSales = getNetSales.rows[0].sum;
        const closedAppointments = getNetSales.rowCount;

        res.json({
            success: true,
            data: {
                netSales: netSales,
                closed_appointments: `${closedAppointments} Closed Appointments`
            },
            message: "OK"
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error Occured",
            data: []
        });
    }


});

router.get("/serviceanalyticswithfilter", check("branch_id").isInt(), check("from_date_range").isDate().optional(), check("to_date_range").isDate().optional(), authMiddleware, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
    }

    try {
        const branch_id = req.query.branch_id;

        let from_date_range = moment().format("YYYY-MM-DD");
        let to_date_range = moment().format("YYYY-MM-DD");
        // If no date range provided, use current date
        if (req.query.from_date_range && req.query.to_date_range) {
            from_date_range = moment(req.query.from_date_range).format("YYYY-MM-DD");
            to_date_range = moment(req.query.to_date_range).format("YYYY-MM-DD");
        }

        const getServicesQuery = `WITH service_options AS (
            SELECT so.id AS service_option_id
            FROM services s
            JOIN services_options so ON s.id = so.service_id
            WHERE s.branch_id = $1
              AND s.status = $2
              AND so.status = $3
        ),
        appointment_ids AS (
            SELECT ai.appointment_id
            FROM appointment_items ai
            JOIN service_options so ON ai.service_option_id = so.service_option_id
        ),
        appointments_with_sales AS (
            SELECT a.id AS appointment_id,
                   a.net_amount
            FROM appointment a
            JOIN appointment_ids ai ON a.id = ai.appointment_id
            WHERE a.status = $4
            AND a.appointment_date >= $7
            AND a.appointment_date <= $8 
        )
        SELECT s.id AS service_id,
               s.name AS service_name,
               COUNT(a.appointment_id) AS total_bookings,
               SUM(a.net_amount) AS total_sales
        FROM services s
        JOIN services_options so ON s.id = so.service_id
        JOIN appointment_items ai ON so.id = ai.service_option_id
        JOIN appointments_with_sales a ON ai.appointment_id = a.appointment_id
        WHERE s.status = $5
          AND so.status = $6
        GROUP BY s.id, s.name
        ORDER BY total_sales DESC
        LIMIT $9;    
        `;

        let limit = req.query.limit ? req.query.limit : 10;
        const queryVariables = [branch_id, enums.is_active.yes, enums.is_active.yes, enums.appointmentType.Closed, enums.is_active.yes, enums.is_active.yes, from_date_range, to_date_range, limit];

        const getResult = await db.query(getServicesQuery, queryVariables);

        const result = getResult.rows;

        res.json({ success: true, data: result, message: "OK" })

    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error Occured.", data: []
        })
    }


});

router.get("/toppayingcustomers", check("branch_id").isInt(), check("from_date_range").isDate().optional(), check("to_date_range").isDate().optional(), authMiddleware, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
    }

    const branch_id = req.query.branch_id;
    let from_date_range = moment().format("YYYY-MM-DD");
    let to_date_range = moment().format("YYYY-MM-DD");
    // If no date range provided, use current date
    if (req.query.from_date_range && req.query.to_date_range) {
        from_date_range = moment(req.query.from_date_range).format("YYYY-MM-DD");
        to_date_range = moment(req.query.to_date_range).format("YYYY-MM-DD");
    }

    try {
        const query = `WITH appointments_with_sales AS (
            SELECT a.user_id,
                   SUM(a.total_amount_paid) AS total_amount_paid
            FROM appointment a
            WHERE a.branch_id = $1
              AND a.status = $2
              AND a.appointment_date >= $3 
              AND a.appointment_date <= $4 
            GROUP BY a.user_id
        )
        SELECT u.id AS user_id,
               u.name AS user_name,
               u.email AS user_email,
               aws.total_amount_paid
        FROM appointments_with_sales aws
        JOIN users u ON aws.user_id = u.id
        WHERE u.status = $5
        ORDER BY aws.total_amount_paid DESC
        LIMIT 10;
        `;
        const queryVariables = [branch_id, enums.appointmentType.Closed, from_date_range, to_date_range, enums.is_active.yes];

        const queryTopPayingCustomers = await db.query(query, queryVariables);
        const topPayingCustomers = queryTopPayingCustomers.rows;

        res.json({
            success: true,
            data: topPayingCustomers,
            message: "OK"
        })

    } catch (error) {
        res.status(500).json({ success: false, message: "Internal Server Error", data: [] })
    }
});

router.get("/detailedappointmentanalytics", check("branch_id").isInt(), check("from_date_range").isDate().optional(), check("to_date_range").isDate().optional(), authMiddleware, async (req, res) => {


    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
    }

    const branch_id = req.query.branch_id;
    let from_date_range = moment().format("YYYY-MM-DD");
    let to_date_range = moment().format("YYYY-MM-DD");
    // If no date range provided, use current date
    if (req.query.from_date_range && req.query.to_date_range) {
        from_date_range = moment(req.query.from_date_range).format("YYYY-MM-DD");
        to_date_range = moment(req.query.to_date_range).format("YYYY-MM-DD");
    }

    try {
        const querySalesOverTime = `
        SELECT 
        A.appointment_date,
        SUM(A.total_amount_paid) AS "Sales"
        FROM appointment A
        WHERE 
        A.appointment_date BETWEEN $1 AND $2 AND A.status = $3 AND branch_id = $4 
        GROUP BY A.appointment_date
        ORDER BY A.appointment_date ASC;
        `;

        const querySalesOverTimeParams = [from_date_range, to_date_range, enums.appointmentType.Closed, branch_id]

        const queryFigures = `
        SELECT 
        SUM(A.net_amount) AS "Expected Sales",
        AVG(A.net_amount) AS "Avg. Appointment Value",
        COUNT(*) AS "Total Appointments"
        FROM appointment A
        WHERE 
        A.appointment_date BETWEEN $1 AND $2 AND branch_id = $3
        `;

        const queryFiguresParams = [from_date_range, to_date_range, branch_id];

        const getSalesOverTime = await db.query(querySalesOverTime, querySalesOverTimeParams);
        const getFigures = await db.query(queryFigures, queryFiguresParams);


        res.json({
            success: true,
            data: {
                figures: getFigures.rows,
                sales: getSalesOverTime.rows,
            },
            message: "OK"
        })

    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error Occured.",
            data: []
        })
    }

})

router.get("/salesovertimereport", check("branch_id").isInt(), check("from_date_range").isDate().optional(), check("to_date_range").isDate().optional(), authMiddleware, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
    }

    const branch_id = req.query.branch_id;
    let from_date_range = moment().format("YYYY-MM-DD");
    let to_date_range = moment().format("YYYY-MM-DD");
    // If no date range provided, use current date
    if (req.query.from_date_range && req.query.to_date_range) {
        from_date_range = moment(req.query.from_date_range).format("YYYY-MM-DD");
        to_date_range = moment(req.query.to_date_range).format("YYYY-MM-DD");
    }

    try {
        const query = await db.query(`
        SELECT
        A.appointment_date,
        SUM(A.net_amount) AS "Total Sales",
        AVG(A.net_amount) AS "Avg. Appointment Value",
        COUNT(*) AS "Total Appointments"
        FROM appointment A
        WHERE
        A.appointment_date BETWEEN $1 AND $2 AND A.branch_id = $3 AND A.status = $4
        GROUP BY A.appointment_date
        ORDER BY A.appointment_date ASC;
        `, [from_date_range, to_date_range, branch_id, enums.appointmentType.Closed]);

        const result = query.rows
        res.json({ success: true, data: result, message: "OK" })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error Occured",
            data: []
        })
    }
});

router.get("/salesbyservicereport", check("branch_id").isInt(), check("from_date_range").isDate().optional(), check("to_date_range").isDate().optional(), async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
    }

    const branch_id = req.query.branch_id;
    let from_date_range = moment().format("YYYY-MM-DD");
    let to_date_range = moment().format("YYYY-MM-DD");
    // If no date range provided, use current date
    if (req.query.from_date_range && req.query.to_date_range) {
        from_date_range = moment(req.query.from_date_range).format("YYYY-MM-DD");
        to_date_range = moment(req.query.to_date_range).format("YYYY-MM-DD");
    }

    try {

        const query = await db.query(`
        SELECT 
        S.name,
        COUNT(*) AS "Total Appointments",
        AVG(A.net_amount) AS "Avg. Appointment Value",
        SUM(A.net_amount) AS "Total Sales"
        FROM appointment A
        INNER JOIN appointment_items AI ON A.id = AI.appointment_id 
        INNER JOIN services_options S ON AI.service_option_id = S.id
        WHERE A.status = $1 AND A.branch_id = $2 AND A.appointment_date BETWEEN $3 AND $4 -- Filter for completed appointments
        GROUP BY S.name
        ORDER BY S.name ASC;
        `, [enums.appointmentType.Closed, branch_id, from_date_range, to_date_range,]);
        const data = query.rows
        res.json({ success: true, data: data, message: "OK" });

    }
    catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error Occured",
            data: []
        })
    }
});

router.get("/toppayingcustomersreport", check("branch_id").isInt(), check("from_date_range").isDate().optional(), check("to_date_range").isDate().optional(), async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
    }

    const branch_id = req.query.branch_id;
    let from_date_range = moment().format("YYYY-MM-DD");
    let to_date_range = moment().format("YYYY-MM-DD");
    // If no date range provided, use current date
    if (req.query.from_date_range && req.query.to_date_range) {
        from_date_range = moment(req.query.from_date_range).format("YYYY-MM-DD");
        to_date_range = moment(req.query.to_date_range).format("YYYY-MM-DD");
    }

    try {

        const result = await db.query(
            `
        WITH RankedCustomers AS (
            SELECT 
              C.id AS user_id,
              C.name AS customer_name,
              COUNT(*) AS total_appointments,
              AVG(A.net_amount) AS avg_appointment_value,
              SUM(A.net_amount) AS total_sales
            FROM appointment A
            INNER JOIN appointment_items AI ON A.id = AI.appointment_id
            INNER JOIN users C ON A.user_id = C.id
            WHERE A.status = $1 AND A.branch_id = $2 AND A.appointment_date BETWEEN $3 AND $4
          GROUP BY C.id, C.name
            ORDER BY total_sales DESC
          )
          SELECT 
            ROW_NUMBER() OVER (ORDER BY total_sales DESC) AS serial_no,
            user_id,
            customer_name,
            total_appointments,
            avg_appointment_value,
            total_sales
          FROM RankedCustomers;
          `, [enums.appointmentType.Closed, branch_id, from_date_range, to_date_range]);

        res.json({
            success: true,
            data: result.rows,
            message: "OK"
        })

    }
    catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error Occured",
            data: []
        })
    }
});

router.get("/services", check("branch_id").isInt(), authMiddleware, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
    }

    const branch_id = req.query.branch_id;

    const services = []
    const data = { services }
    try {

        const getAllServices = await db.query("SELECT id,name,branch_id,category_id,description,department FROM services WHERE branch_id = $1 AND status = $2", [branch_id, enums.is_active.yes]);
        if (getAllServices.rowCount === 0) {
            return res.json({ success: true, message: "No Services Found.", data: [] })
        }
        for (const iterator of getAllServices.rows) {
            const { id, name, branch_id, category_id, description } = iterator;
            const category = await db.query('SELECT name FROM categories WHERE id = $1 ', [iterator.category_id]);
            const department = await db.query('SELECT name FROM department WHERE id = $1 ', [iterator.department]);
            services.push({
                id: id,
                name: name,
                branch_id: branch_id,
                category_id: category_id,
                category: category.rows[0].name,
                department: department.rows[0].name,
                description: description,
            })
        }



        res.json({ success: true, data: data, message: "OK" })

    }
    catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error Occured",
            data: []
        })
    }
});

router.get("/service/:service_id", check('service_id').isInt(), authMiddleware, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
    }

    const service_id = req.params.service_id;
    try {

        const getServiceDetails = await db.query("SELECT * from services WHERE id = $1;", [service_id]);
        if (getServiceDetails.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Service Not Found.",
                data: []
            })
        }
        const getServiceOptions = await db.query("SELECT * from services_options WHERE service_id = $1 AND status = $2;", [service_id, enums.is_active.yes]);

        const getServiceAdditionalInformations = await db.query("SELECT * FROM additional_information WHERE service_id = $1 AND status = $2", [service_id, enums.is_active.yes]);

        const data = { service_details: [getServiceDetails.rows[0]], services_options: getServiceOptions.rows, additional_information: getServiceAdditionalInformations.rows }

        res.json({ success: true, data: data, message: "OK" });

    }
    catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            data: [],
            message: "Internal Server Error Occured"
        })
    }
});

router.get("/appointments", check("branch_id").isInt(), authMiddleware, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }

        const branch_id = req.query.branch_id;

        // Define the base SQL query
        let query = "SELECT * FROM appointment WHERE branch_id = $1";
        const queryParams = [branch_id];

        // Check for appointment status filter
        if (req.query.appointment_status) {
            query += " AND status = $2";
            queryParams.push(req.query.appointment_status);
        }

        // Check for payment status filter
        if (req.query.payment_status === 'paid') {
            query += " AND total_amount_paid >= net_amount";
        } else if (req.query.payment_status === 'unpaid') {
            query += " AND total_amount_paid = 0";
        } else if (req.query.payment_status === 'partially_paid') {
            query += " AND total_amount_paid > 0 AND total_amount_paid < net_amount";
        }

        // Check for booking start time filter
        if (req.query.booking_time === 'earliest_first') {
            query += " ORDER BY start_time ASC";
        } else if (req.query.booking_time === 'earliest_last') {
            query += " ORDER BY start_time DESC";
        }

        // Retrieve appointments from the database based on the constructed query
        const { rows: appointments, rowCount: total_appointments } = await db.query(query, queryParams);

        if (total_appointments === 0) {
            return res.status(404).json({
                success: true,
                message: "No Appointments Found",
                data: []
            });
        }

        // Process and format appointments
        const formattedAppointments = appointments.map(appointment => {
            const { id, user_id, receipt_number, appointment_date, subtotal, total_discount, total_tax, is_rescheduled, start_time, end_time, seat_number, status, total_amount_paid, net_amount } = appointment;

            // Determine payment status based on net_amount and paid_amount
            let paymentStatus = "Unpaid";
            if (total_amount_paid >= net_amount) {
                paymentStatus = "Paid";
            } else if (total_amount_paid > 0) {
                paymentStatus = "Partially Paid";
            }

            // Map appointment status
            let appointmentStatus = "No Show";
            switch (status) {
                case 1:
                    appointmentStatus = "Pending Payment Confirmation";
                    break;
                case 2:
                    appointmentStatus = "Confirmed";
                    break;
                case 3:
                    appointmentStatus = "Closed";
                    break;
                case 4:
                    appointmentStatus = "Cancelled";
                    break;
            }

            return {
                id,
                user_id,
                receipt_number,
                appointment_date,
                subtotal,
                total_discount,
                total_tax,
                net_amount,
                total_amount_paid,
                is_rescheduled,
                start_time,
                end_time,
                seat_number,
                paymentStatus,
                appointmentStatus
            };
        });

        res.json({ success: true, total_appointments: total_appointments, data: { appointments: formattedAppointments }, message: "OK" });
    } catch (error) {
        console.error("Error fetching appointments:", error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error Occurred", data: []
        });
    }
});

router.get("/appointmentdetails", check("appointment_id").isInt(), check("branch_id").isInt(), async (req, res) => {
    // Validate request parameters
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
    }

    try {
        // Extract appointment_id from request query
        const appointment_id = req.query.appointment_id;
        const branch_id = req.query.branch_id;
        // Get appointment details from the database
        const getAppointmentDetails = await db.query("SELECT * FROM appointment WHERE id = $1 AND branch_id = $2;", [appointment_id, branch_id]);
        if (getAppointmentDetails.rows.length === 0) {
            // If appointment not found, return 404 response
            return res.status(404).json({
                success: false,
                message: "Appointment not found.", data: []
            });
        }

        // Get user details associated with the appointment
        const user_id = getAppointmentDetails.rows[0].user_id;
        const getUserDetails = await db.query("SELECT * FROM users WHERE id = $1", [user_id]);
        const userDetails = getUserDetails.rows[0];

        // Get service options associated with the appointment
        const getServiceOptions = await db.query("SELECT * FROM appointment_items WHERE appointment_id = $1;", [appointment_id]);
        const services = [];
        let salon_services_amount = 0;
        let platform_fee = 5;
        let discount = 0;
        let gst = 0;
        let total_amount_paid = 0;

        // Iterate through each service option and calculate relevant amounts
        for (const service of getServiceOptions.rows) {
            const serviceOption_id = service.service_option_id;
            const { service_price, total_item_discount, total_tax, total_price_paid } = service;

            // Calculate amounts for payments info
            salon_services_amount += parseFloat(service_price);
            discount += parseFloat(total_item_discount);
            gst += parseFloat(total_tax);
            discount += parseFloat(total_item_discount);
            total_amount_paid += parseFloat(total_price_paid);

            // Get service option details
            const getServiceOptionDetails = await db.query("SELECT * FROM services_options WHERE id = $1", [serviceOption_id]);
            if (getServiceOptionDetails.rows.length === 0) {
                // If service option not found, return 404 response
                return res.status(404).json({
                    success: false,
                    message: "Service not found.",
                    data: []
                });
            }
            const { service_id, name } = getServiceOptionDetails.rows[0];

            // Get service name
            const getServiceName = await db.query("SELECT * FROM services WHERE id = $1", [service_id]);
            const serviceName = getServiceName.rows[0].name;

            // Push service details into services array
            services.push({
                service_id: service_id,
                service_name: serviceName,
                service_option_details: [{
                    service_option_id: serviceOption_id,
                    service_option_name: name,
                    service_price: service_price,
                }]
            });
        }

        const getPayments = await db.query("SELECT * from payments WHERE appointment_id = $1;", [appointment_id]);
        const transaction_info = [];
        for (const iterator of getPayments.rows) {
            const { id, user_id: uid, payment_gateway_transaction_id, payment_method, payment_date, amount, status, remarks } = iterator;
            transaction_info.push({
                id: id,
                user_id: uid,
                payment_gateway_transaction_id: payment_gateway_transaction_id,
                payment_method: payment_method,
                payment_date: payment_date,
                amount: amount,
                status: status == 1 ? "Success" : "Failed",
                remarks: remarks
            })
        }

        // Payments Info
        const payment_info = {
            salon_services_amount: parseFloat(salon_services_amount).toFixed(2),
            platform_fee: parseFloat(platform_fee).toFixed(2), // Hardcoded platform fee for now
            total_item_discount: parseFloat(discount).toFixed(2),
            gst: parseFloat(gst).toFixed(2),
            total_price_paid: parseFloat(total_amount_paid).toFixed(2),
            net_total: parseFloat(salon_services_amount + platform_fee - discount + gst).toFixed(2),
            total_remaining: parseFloat((salon_services_amount + platform_fee - discount + gst) - total_amount_paid).toFixed(2)

        };

        // Send response with appointment, user, services, and payment information
        res.json({
            success: true,
            data: {
                appointment_details: getAppointmentDetails.rows[0],
                user_details: {
                    id: userDetails.id,
                    email: userDetails.email,
                    name: userDetails.name,
                    phone_number: userDetails.phone_number,
                },
                services_details: services,
                payment_info: payment_info,
                transaction_info: transaction_info,
            },
            message: "OK"
        });
    } catch (error) {
        // Handle unexpected errors
        console.error("Error fetching appointment details:", error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error Occurred",
            data: []
        });
    }
});

router.get("/salonprofiledetails", check("branch_id"), async (req, res) => {
    // Validate request parameters
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
    }
    try {
        const branch_id = req.query.branch_id;

        const getBranchDetails = await db.query("SELECT * FROM branches WHERE id = $1 AND status = $2;", [branch_id, enums.is_active.yes]);
        if (getBranchDetails.rowCount === 0) {
            return res.json({
                success: false,
                message: "Salon/Branch not found.",
                data: []
            })
        }
        const branchDetails = getBranchDetails.rows[0];

        const saloon_id = branchDetails.saloon_id;
        const branch_name = branchDetails.name;
        const city_id = branchDetails.city_id;
        const address = branchDetails.city_id;
        const type = branchDetails.type === 1 ? "Unisex" : branchDetails.type === 2 ? "Men's" : "Women's";
        const seats = branchDetails.seats;
        const latitude = branchDetails.latitude;
        const longitude = branchDetails.longitude;

        res.json({
            success: true,
            data: {
                saloon_id: saloon_id,
                branch_name: branch_name,
                city_id: city_id,
                address: address,
                type: type,
                seats: seats,
                latitude: latitude,
                longitude: longitude
            },
            message: "OK"
        })

    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error"
        })
    }
});
// router.get("/settlementdetailswithfilter");
// router.get("/detailedsettlementsdetails");

router.get("/platform-offers", check("branch_id").isInt(), async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
    }
    try {
        const branch_id = req.query.branch_id;

        const getOffers = await db.query("SELECT * FROM platform_coupon");

        const data = [];
        for (const offer of getOffers.rows) {
            let isParticipated = false;

            const checkParticipation = await db.query("SELECT * FROM platform_coupon_branch WHERE branch_id = $1 AND platform_coupon_id = $2;", [branch_id, offer.id]);

            if (checkParticipation.rowCount > 0) {
                isParticipated = true;
            }

            data.push({
                id: offer.id,
                //TODO
                // name:offer.name,
                discount_amount: offer.discount_amount,
                remark: offer.remark,
                status: offer.status,
                max_advance_payment: offer.max_advance_payment,
                advance_percentage: offer.advance_percentage,
                isParticipated: isParticipated
            })
        }

        res.json({
            success: true,
            data: data,
            message: "OK"
        })
    } catch (error) {
        console.log(error);
        res.json({
            success: false,
            message: "Internal Server Error",
            data: []
        })
    }
});

router.post("/join-platform-offer", check("branch_id").isInt(), check("platform_coupon_id").isInt(), async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
    }
    try {
        const branch_id = req.body.branch_id;
        const platform_coupon_id = req.body.platform_coupon_id;
        const checkPlatformCouponStatus = await db.query("SELECT * FROM platform_coupon WHERE id=$1 AND status = $2;", [platform_coupon_id, enums.is_active.yes]);
        if (checkPlatformCouponStatus.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Platform Coupon Not Found.",
                data: [],
            })
        }

        const checkParticipation = await db.query("SELECT * FROM platform_coupon_branch WHERE branch_id = $1 AND platform_coupon_id = $2;", [branch_id, platform_coupon_id]);
        if (checkParticipation.rowCount === 0) {

            const joinPlatformCoupon = await db.query("INSERT INTO platform_coupon_branch (branch_id,platform_coupon_id) VALUES ($1,$2);", [branch_id, platform_coupon_id]);

            res.status(201).json({
                success: true,
                message: "Successfully joined the offer.",
                data: []
            })
        } else {
            return res.status(409).json({
                success: false,
                message: "Already Participated.",
                data: []
            })
        }

    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
            data: []
        })
    }
});

router.get("/platform-offer-insights", check("branch_id").isInt(), check("platform_coupon_id").isInt(), check('from_date_range').isDate().optional(), check("to_date_range").isDate().optional(), async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }

        const branchId = req.query.branch_id;
        const platformCouponId = req.query.platform_coupon_id;
        let fromDateRange = req.query.from_date_range;
        let toDateRange = req.query.to_date_range;

        let query = `
            SELECT A.id AS appointment_id, 
            A.user_id,
            A.receipt_number,
            A.branch_id,
            A.appointment_date,
            A.subtotal,
            A.total_discount,
            A.total_tax,
            A.net_amount,
            A.total_amount_paid,
            A.status,
            A.start_time,
            A.end_time,
            A.seat_number,
            AD.coupon_type,
            AD.coupon_id,
            AI.service_option_id,
            AI.total_price_paid
            FROM appointment AS A 
            RIGHT JOIN appointment_discount AS AD ON A.id = AD.appointment_id 
            RIGHT JOIN appointment_items AS AI ON A.id = AI.appointment_id 
            WHERE A.branch_id = $1 AND A.status = $2 AND AD.coupon_id = $3`;

        const queryParams = [branchId, enums.appointmentType.Closed, platformCouponId];

        if (fromDateRange && toDateRange) {
            fromDateRange = moment(fromDateRange, "YYYY-MM-DD").format("YYYY-MM-DD");
            toDateRange = moment(toDateRange, "YYYY-MM-DD").format("YYYY-MM-DD");
            query += " AND A.appointment_date BETWEEN $4 AND $5";
            queryParams.push(fromDateRange, toDateRange);
        }

        const getAppointments = await db.query(query, queryParams);

        let totalSales = 0;
        let totalDiscountAmount = 0;
        const appointmentIds = [];
        const appointmentsWithOffer = [];

        for (const appointment of getAppointments.rows) {
            appointmentIds.push(parseInt(appointment.appointment_id));
            const appointmentDate = moment(appointment.appointment_date, "YYYY-MM-DD").format("YYYY-MM-DD");
            const paidAmount = appointment.total_amount_paid;
            appointmentsWithOffer.push({ appointment_date: appointmentDate, paid_amount: paidAmount });
            totalSales += parseFloat(paidAmount);
            totalDiscountAmount += parseFloat(appointment.total_discount);
        }

        const data = { appointments_with_offer: appointmentsWithOffer, total_sales: totalSales.toFixed(2), total_discount_amount: totalDiscountAmount.toFixed(2) };

        const getServiceIdsQuery = `
            SELECT so.service_id, s.name AS service_name, SUM(ai.total_price_paid) AS total_sales 
            FROM appointment_items ai 
            INNER JOIN services_options so ON ai.service_option_id = so.id
            INNER JOIN services s ON so.service_id = s.id
            WHERE ai.appointment_id IN (${appointmentIds.join(',')})
            GROUP BY so.service_id, s.name`;

        const serviceIdsResult = await db.query(getServiceIdsQuery);

        // Retrieve top paying customers
        const topPayingCustomersQuery = `
            SELECT A.user_id, U.email, U.name, SUM(A.total_amount_paid) AS total_amount_paid
            FROM appointment AS A
            JOIN users AS U ON A.user_id = U.id
            WHERE A.branch_id = $1 AND A.status = $2 AND A.id IN (${appointmentIds.join(',')})
            GROUP BY A.user_id, U.email, U.name
            ORDER BY total_amount_paid DESC`;

        const topPayingCustomers = await db.query(topPayingCustomersQuery, [branchId, enums.appointmentType.Closed]);

        res.json({
            success: true,
            data: { appointmentments_with_offer: data.appointments_with_offer, total_sales: data.total_sales, total_discount_amount: data.total_discount_amount, most_booked_services: serviceIdsResult.rows, top_paying_customers: topPayingCustomers.rows },
            message: "OK"
        });
    } catch (error) {
        console.error("Error fetching platform offer insights:", error);
        res.status(500).json({ success: false, message: "Internal Server Error", data: [] });
    }
});

// router.post("/exit-from-platform-offer");

router.get("/sales-over-time-with-platform-offer", check("branch_id").isInt(), check("platform_coupon_id").isInt(), async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }

        const branchId = req.query.branch_id;
        const platformCouponId = req.query.platform_coupon_id;
        let fromDateRange = req.query.from_date_range;
        let toDateRange = req.query.to_date_range;

        let queryParams = [branchId, enums.appointmentType.Closed, platformCouponId];
        let query = `
            SELECT appointment_date, COUNT(*) AS total_appointments, 
            AVG(total_amount_paid) AS avg_paid_amount, 
            SUM(total_amount_paid) AS total_paid_amount
            FROM appointment
            WHERE branch_id = $1 AND status = $2 AND id IN (
                SELECT appointment_id FROM appointment_discount WHERE coupon_id = $3
            )`;

        if (fromDateRange && toDateRange) {
            fromDateRange = moment(fromDateRange, "YYYY-MM-DD").format("YYYY-MM-DD");
            toDateRange = moment(toDateRange, "YYYY-MM-DD").format("YYYY-MM-DD");
            query += " AND appointment_date BETWEEN $4 AND $5";
            queryParams.push(fromDateRange, toDateRange);
        }

        query += " GROUP BY appointment_date";

        const appointmentsData = await db.query(query, queryParams);

        // Format average paid amount and total paid amount to two decimal places
        appointmentsData.rows.forEach(appointment => {
            appointment.appointment_date = moment(appointment.appointment_date, "YYYY-MM-DD").format("YYYY-MM-DD");
            appointment.avg_paid_amount = parseFloat(appointment.avg_paid_amount).toFixed(2);
            appointment.total_paid_amount = parseFloat(appointment.total_paid_amount).toFixed(2);
        });

        res.json({ success: true, data: appointmentsData.rows, message: "OK" });
    } catch (error) {
        console.error("Error fetching platform offer appointments data:", error);
        res.status(500).json({ success: false, message: "Internal Server Error", data: [] });
    }
});


router.get("/sales-by-service-with-platform-offer", check("branch_id").isInt(), check("platform_coupon_id").isInt(), check("from_date_range").isDate().optional(), check("to_date_range").isDate().optional(), async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
    }

    const branch_id = req.query.branch_id;
    const platform_coupon_id = req.query.platform_coupon_id;
    let fromDateRange;
    let toDateRange;

    // If from_date_range and to_date_range provided, use them
    if (req.query.from_date_range && req.query.to_date_range) {
        fromDateRange = moment(req.query.from_date_range).format("YYYY-MM-DD");
        toDateRange = moment(req.query.to_date_range).format("YYYY-MM-DD");
    }

    try {
        const queryParams = [enums.appointmentType.Closed, branch_id, platform_coupon_id];
        let query = `
        SELECT 
        S.name,
        COUNT(*) AS "Total Appointments",
        AVG(A.net_amount) AS "AvgAppointmentValue",
        SUM(A.net_amount) AS "TotalSales"
    FROM 
        appointment A
        INNER JOIN appointment_items AI ON A.id = AI.appointment_id 
        INNER JOIN services_options S ON AI.service_option_id = S.id
        INNER JOIN appointment_discount AD ON A.id = AD.appointment_id
    WHERE 
        A.status = $1 
        AND A.branch_id = $2 
        AND AD.coupon_id = $3`
            ;

        // If date range provided, add it to the query
        if (fromDateRange && toDateRange) {
            query += " AND A.appointment_date BETWEEN $4 AND $5"; // Filter for appointment date range
            queryParams.push(fromDateRange, toDateRange);
        }

        query += `
        GROUP BY 
        S.name
        ORDER BY 
        S.name ASC`;
        const queryResult = await db.query(query, queryParams);
        const data = queryResult.rows;
        data.forEach(element => {
            element.AvgAppointmentValue = parseFloat(element.AvgAppointmentValue).toFixed(2);
            element.TotalSales = parseFloat(element.TotalSales).toFixed(2);
        });
        res.json({ success: true, data: data, message: "OK" });

    } catch (error) {
        console.error("Error fetching sales by service:", error);
        res.status(500).json({ success: false, message: "Internal Server Error", data: [] });
    }
});


router.get("/top-paying-customers-with-platform-offer", check("branch_id").isInt(), check("platform_coupon_id").isInt(), check("from_date_range").isDate().optional(), check("to_date_range").isDate().optional(), async (req, res) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
    }

    try {
        const branch_id = req.query.branch_id;
        const platform_coupon_id = req.query.platform_coupon_id;

        let query = `
        SELECT
        ROW_NUMBER() OVER () AS serial_number,
        A.user_id,
        U.name AS name,
        SUM(A.total_amount_paid) AS total_paid_amount,
        COUNT(A.id) AS total_appointment
    FROM
        appointment A
        JOIN users U ON A.user_id = U.id
        JOIN appointment_discount AD ON A.id = AD.appointment_id
    WHERE
        A.status = $1
        AND A.branch_id = $2
        AND U.user_type = $3
        AND AD.coupon_id = $4
    `;
        const queryParams = [enums.appointmentType.Closed, branch_id, enums.UserType.customer, platform_coupon_id];
        let fromDateRange;
        let toDateRange;

        // If from_date_range and to_date_range provided, use them
        if (req.query.from_date_range && req.query.to_date_range) {
            fromDateRange = moment(req.query.from_date_range).format("YYYY-MM-DD");
            toDateRange = moment(req.query.to_date_range).format("YYYY-MM-DD");
            query += `AND A.appointment_date BETWEEN $5 AND $6`;
            queryParams.push(fromDateRange);
            queryParams.push(toDateRange);
        }

        query += `
        GROUP BY
            A.user_id, U.name
        ORDER BY
            total_paid_amount ASC;
        `;
        const getData = await db.query(query, queryParams);
        res.json({ success: true, data: getData.rows, message: "OK" })

    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
            data: []
        })
    }
});


router.post('/store-hours', jsonParser, [
    body('[0].branch_id').isNumeric().withMessage('Branch ID must be an integer'),
    body().isArray().withMessage('Store hours data must be an array'),
    body().custom(value => {
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        return value.every(item => {
            return days.every(day => item.hasOwnProperty(day));
        });
    }).withMessage('Store hours must be provided for all days of the week'),
    body().custom(value => {
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        return value.every(item => {
            return days.every(day => {
                return (
                    item[day] &&
                    typeof item[day].start_time === 'string' &&
                    typeof item[day].end_time === 'string' &&
                    ['0', '1'].includes(item[day].status)
                );
            });
        });
    }).withMessage('Each day must contain start_time, end_time, and status'),
    body().custom(value => {
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        return value.every(item => {
            return days.every(day => {
                return (
                    item[day] &&
                    typeof item[day].start_time === 'string' &&
                    typeof item[day].end_time === 'string' &&
                    ['0', '1'].includes(item[day].status) &&
                    /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(item[day].start_time) &&
                    /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(item[day].end_time)
                );
            });
        });
    }).withMessage('Each day must contain valid start_time, end_time, and status in HH:MM format'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
    }

    try {
        await db.query("BEGIN");

        const branch_hours = req.body;
        const storeHoursData = [];

        // Iterate over each item in the request array
        for (const item of branch_hours) {
            const branch_id = item.branch_id;

            // Check if store hours already exist for this branch
            const checkExistence = await db.query("SELECT id FROM branch_hours WHERE branch_id = $1", [branch_id]);
            if (checkExistence.rowCount > 0) {
                return res.status(409).json({ success: false, message: `Store hours already exist for branch with ID ${branch_id}. Please update instead.`, data: [] });
            }

            // Iterate over days and add data to storeHoursData array
            for (let [day, { start_time, end_time, status }] of Object.entries(item)) {
                day = day.toLowerCase()
                storeHoursData.push({
                    branch_id,
                    day,
                    start_time,
                    end_time,
                    status
                });
            }
        }


        // Insert store hours into the database
        for (let index = 1; index < storeHoursData.length; index++) {
            await db.query("INSERT INTO branch_hours (branch_id, day, start_time, end_time) VALUES ($1, $2, $3, $4) RETURNING id",
                [storeHoursData[index].branch_id, storeHoursData[index].day, storeHoursData[index].start_time, storeHoursData[index].end_time]);
        }

        await db.query("COMMIT");
        res.status(200).json({ success: true, message: "Store hours inserted successfully", data: [] });
    } catch (error) {
        await db.query("ROLLBACK");
        console.error("Error inserting store hours:", error);
        res.status(500).json({ success: false, message: "Internal server error occurred.", data: [] });
    }
});

router.get('/store-hours', check("branch_id").isInt(), async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
    }
    try {

        const branch_id = req.query.branch_id;

        const getStoreHours = await db.query("SELECT * FROM branch_hours WHERE branch_id = $1", [branch_id]);
        const branch_hours = [];

        for (const storeHours of getStoreHours.rows) {
            branch_hours.push(storeHours)
        }

        res.json({ success: true, data: branch_hours.sort((a, b) => a.id - b.id), message: "OK" })
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal server error occurred.", data: [] });
    }
});

router.put('/update-store-hours/', jsonParser, [
    body('[0].branch_id').isNumeric().withMessage('Branch ID must be an integer'),
    body().isArray().withMessage('Store hours data must be an array'),
    body().custom(value => {
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        return value.every(item => {
            return days.every(day => item.hasOwnProperty(day));
        });
    }).withMessage('Store hours must be provided for all days of the week'),
    body().custom(value => {
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        return value.every(item => {
            return days.every(day => {
                return (
                    item[day] &&
                    typeof item[day].start_time === 'string' &&
                    typeof item[day].end_time === 'string' &&
                    ['0', '1'].includes(item[day].status) &&
                    /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(item[day].start_time) &&
                    /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(item[day].end_time)
                );
            });
        });
    }).withMessage('Each day must contain valid start_time, end_time, and status in HH:MM format'),
], authMiddleware, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
    }

    const branchId = req.body[0].branch_id;
    const branch_hours = req.body;
    const storeHoursData = [];

    try {
        await db.query('BEGIN');

        // Check if store hours exist for the branch
        const checkExistence = await db.query('SELECT id from branch_hours WHERE branch_id = $1', [branchId]);
        if (checkExistence.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Store hours not found for this branch', data: [] });
        }

        // Update store hours for the branch
        for (const iterator of branch_hours) {
            for (const [day, { start_time, end_time, status }] of Object.entries(iterator)) {
                storeHoursData.push({
                    branch_id: branchId,
                    day,
                    start_time,
                    end_time,
                    status
                });
            }
        }

        for (let index = 1; index < storeHoursData.length; index++) {
            await db.query('UPDATE branch_hours SET start_time = $1, end_time = $2, status = $3 WHERE branch_id = $4 AND day = $5', [storeHoursData[index].start_time, storeHoursData[index].end_time, storeHoursData[index].status, branchId, storeHoursData[index].day]);
        }


        await db.query('COMMIT');
        res.status(200).json({ success: true, message: 'Store hours updated successfully', data: [] });
    } catch (error) {
        await db.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal server error', data: [] });
    }
});

router.get('/holidays', jsonParser, check('branch_id').isInt().withMessage('Branch ID must be an integer'), authMiddleware,
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }

        try {
            const branch_id = req.query.branch_id;

            const getHolidays = await db.query("SELECT * FROM holiday_hours WHERE branch_id = $1 AND status = $2;", [branch_id, enums.is_active.yes]);

            if (getHolidays.rowCount === 0) {
                return res.json({
                    success: true,
                    message: "No Holidays Found",
                    data: []
                })
            }

            const formatedData = []

            for (const holiday of getHolidays.rows) {
                const id = holiday.id;
                const from_date = moment(holiday.from_date, "YYYY-MM-DD HH:mm:ss").format("dddd") + ", " + moment(holiday.from_date, "YYYY-MM-DD HH:mm:ss").format("MMM DD YYYY");
                const to_date = moment(holiday.to_date, "YYYY-MM-DD HH:mm:ss").format("dddd") + ", " + moment(holiday.to_date, "YYYY-MM-DD HH:mm:ss").format("MMM DD YYYY");

                // Calculate Duration
                const differenceInMilliseconds = moment.duration(moment(holiday.to_date, "YYYY-MM-DD HH:mm:ss").diff(moment(holiday.from_date, "YYYY-MM-DD HH:mm:ss")));
                const duration = moment.duration(Math.abs(differenceInMilliseconds));
                const days = Math.floor(duration.asDays()); // Calculate the number of whole days
                const hours = duration.hours();
                const subline = `${days} days and ${hours} hours`;
                formatedData.push({
                    id: id, from_date: from_date, to_date, subline: subline
                });
            }


            res.json({
                success: true,
                data: formatedData,
                message: "OK"
            });
        } catch (error) {
            console.log(error)
            res.status(500).json({
                success: false,
                message: "Internal Server Error"
            });
        }

    });

router.post('/holidays', jsonParser, [
    body('branch_id').isNumeric().withMessage('Branch ID must be an integer'),
    body('from_date').isISO8601().toDate().withMessage('From date must be a valid ISO8601 date'),
    body('to_date').isISO8601().withMessage('To date must be a valid ISO8601 date'),
], authMiddleware,
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }

        const { branch_id, from_date, to_date, status } = req.body;

        try {
            const checkExisting = await db.query("SELECT COUNT(*) AS overlap_count FROM holiday_hours WHERE branch_id = $1 AND status = 1 AND ((from_date, to_date) OVERLAPS ($2, $3));", [branch_id, from_date, to_date])
            if (checkExisting.rows[0].overlap_count > 0) {
                res.status(409).json({ success: false, message: "We're unable to save the new holiday hours because they overlap with existing holiday hours. Please select a different time period or modify existing one.", data: [] });
            } else {
                // Insert holiday hours
                const insertHoliday = await db.query('INSERT INTO holiday_hours (branch_id, from_date, to_date, status) VALUES ($1, $2, $3, $4) RETURNING id',
                    [branch_id, from_date, to_date, status]);

                res.status(201).json({ success: true, message: 'Holiday hours added successfully', data: { id: insertHoliday.rows[0].id } });
            }
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, message: 'Internal server error', data: [] });
        }
    });

router.put('/holidays', jsonParser, [
    body('id').isInt().withMessage('Invalid holiday ID'),
    body('branch_id').isInt().withMessage('Branch ID must be an integer'),
    body('from_date').isISO8601().withMessage('Invalid start date format'),
    body('to_date').isISO8601().withMessage('Invalid end date format'),
    body('status').isIn(['0', '1']).withMessage('Invalid status value'),
], authMiddleware, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
    }
    try {
        const { id } = req.body;
        const { branch_id, from_date, to_date, status } = req.body;

        // Check if the holiday hours exist
        const checkExistence = await db.query("SELECT id FROM holiday_hours WHERE id = $1 AND branch_id=$2", [id, branch_id]);
        if (checkExistence.rowCount === 0) {
            return res.status(404).json({ success: false, message: "Holiday hours not found", data: [] });
        }

        // Check for overlapping holiday hours
        const checkOverlap = await db.query("SELECT id FROM holiday_hours WHERE branch_id = $1 AND id != $2 AND (($3 BETWEEN from_date AND to_date) OR ($4 BETWEEN from_date AND to_date))", [branch_id, id, from_date, to_date]);
        if (checkOverlap.rowCount > 0) {
            return res.status(400).json({ success: false, message: "The provided holiday hours overlap with other existing holiday hours", data: [] });
        }

        // Update the holiday hours
        await db.query("UPDATE holiday_hours SET from_date = $2, to_date = $3, status = $4 WHERE id = $5", [from_date, to_date, status, id]);

        res.status(200).json({ success: true, message: "Holiday hours updated successfully", data: [] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Internal Server Error", data: [] });
    }
});

router.delete('/holidays',
    check('id').isInt(),
    check('branch_id').isInt(),
    authMiddleware
    , async (req, res) => {

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        } else {

            const { id, branch_id } = req.query;

            try {
                // Check if the holiday hours exist
                const existingHolidayHours = await db.query('SELECT id FROM holiday_hours WHERE id = $1 AND branch_id = $2', [id, branch_id]);
                if (existingHolidayHours.rowCount === 0) {
                    return res.status(404).json({ success: false, message: 'Holiday hours not found', data: [] });
                }

                // Delete the holiday hours
                await db.query('DELETE FROM holiday_hours WHERE id = $1', [id]);

                res.status(200).json({ success: true, message: 'Holiday hours deleted successfully', data: [] });

            }
            catch (error) {
                console.error('Error deleting holiday hours:', error);
                res.status(500).json({ success: false, message: 'Internal server error', data: [] });
            }
        }
    });

router.post("/services",
    jsonParser,
    body().isObject(),
    body("service_name").isString(),
    body("branch_id").isInt(),
    body("category_id").isInt(),
    body("description").isString(),
    body("additional_information").isArray(),
    body("additional_information.*.title").isString(),
    body("additional_information.*.description").isString(),
    body("service_options").isArray(),
    body("service_options.*.name").isString(),
    body("service_options.*.discount").isInt(),
    body("service_options.*.price").isInt(),
    body("service_options.*.description").isString(),
    body("service_options.*.duration").isInt(),
    authMiddleware,
    async (req, res) => {
        // res.send(req.body.service_name)
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }

        const jsonData = req.body;
        try {
            const service_name = jsonData.service_name;
            const branch_id = jsonData.branch_id;
            const category_id = jsonData.category_id;
            const description = jsonData.description;
            let department = jsonData.department;
            // Using forEach method to iterate over service options
            await db.query("BEGIN");
            const insertService = await db.query("INSERT INTO services (name,branch_id,category_id,description,department) VALUES ($1,$2,$3,$4,$5) RETURNING id", [service_name, branch_id, category_id, description, department]);
            const service_id = insertService.rows[0].id;

            for (let i = 0; i < jsonData.service_options.length; i++) {
                const option = jsonData.service_options[i];

                const name = option.name;
                const discount = option.discount;
                const price = option.price;
                const description = option.description;
                const duration = option.duration;

                const query = await db.query("INSERT INTO services_options (service_id,name,discount,price,description,duration) VALUES ($1,$2,$3,$4,$5,$6)", [service_id, name, discount, price, description, duration])
            }

            for (let i = 0; i < jsonData.additional_information.length; i++) {
                const element = jsonData.additional_information[i];
                await db.query("INSERT INTO additional_information (title,description,service_id) VALUES ($1,$2,$3)", [element.title, element.description, service_id]);
            }

            await db.query("COMMIT");
            res.status(200).json({ success: true, data: [{ service_id: service_id }], data: [] })
        }
        catch (err) {
            await db.query("ROLLBACK")
            res.status(500).json({ success: false, message: "Internal Server Error", data: [] });
        }
    }
);

router.put("/services",
    jsonParser,
    body().isObject(),
    body('service_id').isInt(),
    body("service_name").optional().isString(),
    body("branch_id").optional().isInt(),
    body("category_id").optional().isInt(),
    body("description").optional().isString(),
    body("additional_information").optional().isArray(),
    body("additional_information.*.title").optional().isString(),
    body("additional_information.*.description").optional().isString(),
    body("service_options").optional().isArray(),
    body("service_options.*.name").optional().isString(),
    body("service_options.*.discount").optional().isInt(),
    body("service_options.*.price").optional().isInt(),
    body("service_options.*.description").optional().isString(),
    body("service_options.*.duration").optional().isInt(),
    authMiddleware,
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }

        const serviceId = req.body.service_id;
        const jsonData = req.body;
        try {
            await db.query("BEGIN");

            if (Object.keys(jsonData).length === 0) {
                return res.status(400).json({ success: false, message: "No data provided for updating service.", data: [] });
            }

            // Check if the provided service_id exists
            const checkServiceExists = await db.query("SELECT id FROM services WHERE id = $1", [serviceId]);
            if (checkServiceExists.rows.length === 0) {
                return res.status(404).json({ success: false, message: "Service not found.", data: [] });
            }

            // Update service details
            const updateServiceValues = [];
            const updateServiceQuery = [];
            if (jsonData.service_name) {
                updateServiceValues.push(jsonData.service_name);
                updateServiceQuery.push("name = $1");
            }
            if (jsonData.category_id) {
                updateServiceValues.push(jsonData.category_id);
                updateServiceQuery.push("category_id = $2");
            }
            if (jsonData.description) {
                updateServiceValues.push(jsonData.description);
                updateServiceQuery.push("description = $3");
            }
            if (updateServiceValues.length > 0) {
                updateServiceValues.push(serviceId);
                const updateQuery = await db.query(`UPDATE services SET ${updateServiceQuery.join(',')}, updated_at = now() WHERE id = $${updateServiceValues.length} RETURNING *`, updateServiceValues);
            }

            // Update or insert service options
            if (jsonData.service_options && jsonData.service_options.length > 0) {
                for (const option of jsonData.service_options) {
                    if ('id' in option) {
                        // If service option ID is provided, update existing option
                        const updateQuery = await db.query("UPDATE services_options SET name = $1, discount = $2, price = $3, description = $4, duration = $5, updated_at = now() WHERE id = $6 RETURNING *", [option.name, option.discount, option.price, option.description, option.duration, option.id]);
                    } else {
                        // If service option ID is not provided, insert new option
                        const insertQuery = await db.query("INSERT INTO services_options (service_id, name, discount, price, description, duration) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *", [serviceId, option.name, option.discount, option.price, option.description, option.duration]);
                        console.log(insertQuery.rows[0]);
                    }
                }
            }

            // Update or insert additional information
            if (jsonData.additional_information && jsonData.additional_information.length > 0) {
                for (const element of jsonData.additional_information) {
                    if ('id' in element) {
                        const checkExistence = await db.query("SELECT id FROM additional_information WHERE id = $1", [element.id]);
                        // If additional information ID is provided, update existing information
                        if (checkExistence.rowCount > 0) {
                            await db.query("UPDATE additional_information SET title = $1, description = $2, updated_at = now() WHERE id = $3", [element.title, element.description, element.id]);
                        }
                        else {
                            return res.json({ success: false, message: `Additional Information with ID ${element.id} not found.`, data: [] });
                        }
                    } else {
                        // If additional information ID is not provided, insert new information
                        await db.query("INSERT INTO additional_information (title, description, service_id) VALUES ($1, $2, $3)", [element.title, element.description, serviceId]);
                    }
                }
            }

            await db.query("COMMIT");
            return res.status(200).json({ success: true, message: "Service updated successfully.", data: [] });
        } catch (error) {
            await db.query("ROLLBACK");
            console.error("Error updating service:", error);
            return res.status(500).json({ success: false, message: "Error updating service.", data: [] });
        }
    }
);

router.delete("/services",
    jsonParser,
    body().isObject(),
    body("service_ids").isArray(),
    body("service_ids.*").isInt(),
    authMiddleware,
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }

        const serviceIds = req.body.service_ids;
        try {
            await db.query("BEGIN");

            if (serviceIds.length === 0) {
                return res.status(400).json({ success: false, message: "No service IDs provided for deletion.", data: [] });
            }

            // Check if the provided service IDs exist
            const checkServiceExistsQuery = await db.query("SELECT id FROM services WHERE id = ANY($1)", [serviceIds]);
            const existingServiceIds = checkServiceExistsQuery.rows.map(row => row.id);

            // Filter out non-existing service IDs
            const nonExistingServiceIds = serviceIds.filter(id => !existingServiceIds.includes(id));

            if (nonExistingServiceIds.length > 0) {
                return res.status(404).json({ success: false, message: `Services with IDs ${nonExistingServiceIds.join(', ')} not found.`, data: [] });
            }

            // Update the status of services to 0 (inactive)
            const updateStatusQuery = await db.query("UPDATE services SET status = 0 WHERE id = ANY($1)", [serviceIds]);

            const updateOptionsStatusQuery = await db.query("UPDATE services_options SET status = 0 WHERE service_id = ANY($1)", [serviceIds]);

            // Update the status of associated additional information to 0 (inactive)
            const updateInfoStatusQuery = await db.query("UPDATE additional_information SET status = 0 WHERE service_id = ANY($1)", [serviceIds]);


            await db.query("COMMIT");
            return res.status(200).json({ success: true, message: "Services deleted successfully.", data: [] });
        } catch (error) {
            await db.query("ROLLBACK");
            console.error("Error deactivating services:", error);
            return res.status(500).json({ success: false, message: "Error deleting services.", data: [] });
        }
    }
);

router.delete("/serviceoption", check("option_id").isInt().customSanitizer(value => parseInt(value)), check("branch_id").isInt(), authMiddleware, async (req, res) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
    }
    try {
        const option_id = req.query.option_id;
        const branch_id = req.query.branch_id;

        //check service option if it belongs to the supplied branch_id

        const checkServiceOptionExists = await db.query(`SELECT services_options.*,services.branch_id FROM services_options LEFT JOIN services ON services_options.service_id = services.id 
        WHERE services_options.id = $1 AND services_options.status = $2 AND services.branch_id = $3
        `, [option_id, enums.is_active.yes, branch_id]);

        if (checkServiceOptionExists.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Service Option Not Found",
                data: []
            })
        }

        const deleteOption = await db.query("UPDATE services_options SET status = $1 WHERE id = $2 AND status = $3;", [enums.is_active.no, option_id, enums.is_active.yes])
        if (deleteOption.rowCount > 0) {
            return res.json({ success: true, message: "Service option deleted succesfully...", data: [] });
        } else {
            return res.json({ success: false, message: "Service option not found...", data: [] });
        }

    } catch (error) {
        console.log(error)
        res.status(500).json({ success: false, message: "Internal server error occurred.", data: [] })
    }

});

router.get("/getServiceCreationDetails", authMiddleware, async (req, res) => {

    try {
        const getDepartments = await db.query("SELECT id, name FROM department");
        const department = getDepartments.rows;
        const getCategories = await db.query("SELECT id,name FROM categories");
        const categories = getCategories.rows;
        res.status(200).json({ data: { department: department, categories: categories }, message: "OK" });
    }
    catch (error) {
        res.status(500).json({ success: false, message: "Internal Server Error", data: [] });
    }
})







export default router;



