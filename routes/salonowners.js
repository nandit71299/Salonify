import express, { application } from "express";
import bodyParser from "body-parser";
import db from "../db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import authMiddleware from '../middleware/authMiddleware.js';
import { check, body, validationResult, header } from 'express-validator';
import nodemailer from "nodemailer";
import moment from "moment";
import dotenv from "dotenv";
import * as enums from "../enums.js"
import { fileURLToPath } from 'url';
import path, { parse } from 'path';
import fs from 'fs/promises';

const router = express.Router();
const saltRounds = Number(process.env.saltrounds);

var jsonParser = bodyParser.json();


router.get("/testsalonownerroute", (req, res) => {
    res.send("Test Succesfull");
})

router.post("/registersalon",
    check("email").trim().isEmail(),
    check("password").trim().isLength({ min: 6 }),
    check("personalName").trim().isString(),
    check("personalPhone").trim().isMobilePhone(),
    check("image").isBase64(),
    check("salon_name").trim().isAlphanumeric(),
    check("contact_number").trim().isNumeric(),
    check("salonDescription").trim().isString(),
    check("location").trim().isAlphanumeric(),
    check("address").trim().isString(),
    check("type").trim().isNumeric(),
    check("seats").trim().isNumeric(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.send(errors);
        }
        else {
            // User Details  
            const email = req.body.email.toLowerCase();
            const password = req.body.password;
            const personalName = req.body.name;
            const personalPhone = req.body.personalPhone;
            const dob = req.body.dob;

            // Salon Details
            const salon_name = req.body.salon_name;
            const contact_number = req.body.contact_number;
            const salonDescription = req.body.description;
            const location = req.body.location;

            //Branch Details
            const name = salon_name;
            //TODO change city_id and make it dynamic later...
            const city_id = 1;
            const address = req.body.address;
            const salon_type = req.body.type;
            //TODO change latitude, longitude and make it dynamic later...
            const latitude = 111;
            const longitude = 111;
            const seats = req.body.seats;
            const image = req.body.image;

            const fileName = salon_name; // File name to save
            const filePath = path.join(process.cwd(), '/public/salonimages/', salon_name + ".png"); // Path to save the image file

            try {
                const checkEmailExistence = await db.query("SELECT email FROM users WHERE email = $1", [email]);
                const checkPhoneExistence = await db.query("SELECT phone_number FROM users WHERE phone_number = $1", [personalPhone]);
                if (checkPhoneExistence.rowCount > 0) {
                    res.send({ success: false, message: "A user is already registered with this phone number" });
                } else {
                    if (checkEmailExistence.rowCount > 0) {
                        res.send({ success: false, message: "A user is already registered with this email address." });
                    }
                    else {
                        bcrypt.hash(password, saltRounds, async (err, hash) => {
                            if (err) {
                                console.log("Error hashing password", err);
                                res.send({ success: false, message: "Error in making request, contact administrator" });
                            } else {

                                try {

                                    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');

                                    // Create buffer from base64 data
                                    const imageBuffer = Buffer.from(base64Data, 'base64');

                                    // Write buffer to file
                                    await fs.writeFile(filePath, imageBuffer, (err) => {
                                        if (err) {
                                            console.error('Error saving image:', err);
                                            res.status(500).json({ success: false, message: 'Error saving image.' });
                                            return;
                                        }
                                    });

                                    await db.query("BEGIN");
                                    const registerUser = await db.query("INSERT INTO users (email,password,name,phone_number,dob,user_type) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id;", [email, hash, personalName, personalPhone, dob, enums.UserType.salon_admin]);
                                    const registerSalon = await db.query("INSERT INTO saloon (user_id,saloon_name,contact_number,description) VALUES ($1,$2,$3,$4) RETURNING id;", [registerUser.rows[0].id, salon_name, contact_number, salonDescription]);
                                    const registerBranch = await db.query("INSERT INTO branches (saloon_id,name,city_id,address,type,latitude,seats,longitude) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id", [registerSalon.rows[0].id, name, city_id, address, salon_type, latitude, seats, longitude]);
                                    await db.query("COMMIT");
                                    res.send({
                                        success: true,
                                        message: "Salon registered succesfully."
                                    });
                                } catch (error) {
                                    await db.query("ROLLBACK");
                                    res.send({ error: error, message: "Could not complete the request." })
                                };
                            }
                        });


                    }
                }
            } catch (error) {
                res.status(404).send({ success: false, message: "Error Registering Salon...", error: error });
            }
        }



    });


router.post("/login", async (req, res) => {
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
                    const result = await db.query(`SELECT * FROM "users" where "email" = $1 AND status=$2 AND user_type = $3`, [email, enums.is_active.yes, enums.UserType.salon_admin]);

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
                            isSuccess: success,
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
        }
});

router.get("/initializepayment", authMiddleware, async (req, res) => {
    res.send("You are in")
})


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
        return res.status(400).json({ success: false, message: "Validation Error Occurred.", errors: errors.array() });
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
                return res.status(409).json({ success: false, message: `Store hours already exist for branch with ID ${branch_id}. Please update instead.` });
            }

            // Iterate over days and add data to storeHoursData array
            for (const [day, { start_time, end_time, status }] of Object.entries(item)) {
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
        res.status(200).json({ success: true, message: "Store hours inserted successfully" });
    } catch (error) {
        await db.query("ROLLBACK");
        console.error("Error inserting store hours:", error);
        res.status(500).json({ success: false, message: "Internal server error occurred." });
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
        return res.status(400).json({ errors: errors.array() });
    }

    const branchId = req.body[0].branch_id;
    const branch_hours = req.body;
    const storeHoursData = [];

    try {
        await db.query('BEGIN');

        // Check if store hours exist for the branch
        const checkExistence = await db.query('SELECT id from branch_hours WHERE branch_id = $1', [branchId]);
        if (checkExistence.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Store hours not found for this branch' });
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
        res.status(200).json({ success: true, message: 'Store hours updated successfully' });
    } catch (error) {
        await db.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal server error' });
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
            return res.status(400).json({ errors: errors.array() });
        }

        const { branch_id, from_date, to_date, status } = req.body;

        try {
            const checkExisting = await db.query("SELECT COUNT(*) AS overlap_count FROM holiday_hours WHERE branch_id = $1 AND status = 1 AND ((from_date, to_date) OVERLAPS ($2, $3));", [branch_id, from_date, to_date])
            if (checkExisting.rows[0].overlap_count > 0) {
                res.status(409).json({ success: false, message: "We're unable to save the new holiday hours because they overlap with existing holiday hours. Please select a different time period or modify existing one." });
            } else {
                // Insert holiday hours
                await db.query('INSERT INTO holiday_hours (branch_id, from_date, to_date, status) VALUES ($1, $2, $3, $4)',
                    [branch_id, from_date, to_date, status]);

                res.status(201).json({ success: true, message: 'Holiday hours added successfully' });
            }
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, message: 'Internal server error' });
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
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const { id } = req.body;
        const { branch_id, from_date, to_date, status } = req.body;

        // Check if the holiday hours exist
        const checkExistence = await db.query("SELECT id FROM holiday_hours WHERE id = $1", [id]);
        if (checkExistence.rowCount === 0) {
            return res.status(404).json({ success: false, message: "Holiday hours not found" });
        }

        // Check for overlapping holiday hours
        const checkOverlap = await db.query("SELECT id FROM holiday_hours WHERE branch_id = $1 AND id != $2 AND (($3 BETWEEN from_date AND to_date) OR ($4 BETWEEN from_date AND to_date))", [branch_id, id, from_date, to_date]);
        if (checkOverlap.rowCount > 0) {
            return res.status(400).json({ success: false, message: "The provided holiday hours overlap with other existing holiday hours" });
        }

        // Update the holiday hours
        await db.query("UPDATE holiday_hours SET branch_id = $1, from_date = $2, to_date = $3, status = $4 WHERE id = $5", [branch_id, from_date, to_date, status, id]);

        res.status(200).json({ success: true, message: "Holiday hours updated successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});

router.delete('/holidays',
    check('id').isInt(),
    authMiddleware
    , async (req, res) => {

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.status(500).json({
                success: false, messaage: "Invalid value for id", errors: errors.array()
            })
        } else {

            const { id } = req.body;

            try {
                // Check if the holiday hours exist
                const existingHolidayHours = await db.query('SELECT id FROM holiday_hours WHERE id = $1', [id]);
                if (existingHolidayHours.rowCount === 0) {
                    return res.status(404).json({ success: false, message: 'Holiday hours not found' });
                }

                // Delete the holiday hours
                await db.query('DELETE FROM holiday_hours WHERE id = $1', [id]);

                res.status(200).json({ success: true, message: 'Holiday hours deleted successfully' });

            }
            catch (error) {
                console.error('Error deleting holiday hours:', error);
                res.status(500).json({ success: false, message: 'Internal server error' });
            }
        }
    });

router.post("/services",
    jsonParser,
    body().isObject(),
    body("service_name").isAlphanumeric(),
    body("branch_id").isInt(),
    body("category_id").isInt(),
    body("description").isString(),
    body("additional_information").isArray(),
    body("additional_information.*.title").isAlphanumeric(),
    body("additional_information.*.description").isString(),
    body("service_options").isArray(),
    body("service_options.*.name").isAlphanumeric(),
    body("service_options.*.discount").isInt(),
    body("service_options.*.price").isInt(),
    body("service_options.*.description").isString(),
    body("service_options.*.duration").isInt(),
    async (req, res) => {
        // res.send(req.body.service_name)
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.send(errors);
        }

        const jsonData = req.body;
        try {
            const service_name = jsonData.service_name;
            const branch_id = jsonData.branch_id;
            const category_id = jsonData.category_id;
            const description = jsonData.description;
            // Using forEach method to iterate over service options
            await db.query("BEGIN");
            const insertService = await db.query("INSERT INTO services (name,branch_id,category_id,description) VALUES ($1,$2,$3,$4) RETURNING id", [service_name, branch_id, category_id, description]);
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
            res.status(200).json({ success: true, data: [{ service_id: service_id }] })
        }
        catch (err) {
            await db.query("ROLLBACK")
            res.json(err);
        }
    }
);

router.get("/getServiceCreationDetails", authMiddleware, async (req, res) => {

    try {
        const getDepartments = await db.query("SELECT id, name FROM department");
        const department = getDepartments.rows;
        const getCategories = await db.query("SELECT id,name FROM categories");
        const categories = getCategories.rows;
        res.status(200).json({ department: department, categories: categories });
        // res.send("Hello")
    }
    catch (error) {
        res.status(400).json(error);
    }
})






export default router;



