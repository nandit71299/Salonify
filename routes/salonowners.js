import express, { application } from "express";
import bodyParser from "body-parser";
import db from "../database.js";
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
import fs from 'fs';

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
            return res.status(400).json({ success: false, errors: errors.array() });
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
                return res.status(400).json({ success: false, message: "A user is already registered with this email address." });
            }

            if (phoneExistence.rowCount > 0) {
                return res.status(400).json({ success: false, message: "A user is already registered with this phone number." });
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

            return res.status(200).json({ success: true, message: "Salon registered successfully." });
        } catch (error) {
            await db.query("ROLLBACK");
            console.error("Error registering salon:", error);
            return res.status(500).json({ success: false, message: "Error registering salon." });
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
    authMiddleware,
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
            res.status(200).json({ success: true, data: [{ service_id: service_id }] })
        }
        catch (err) {
            await db.query("ROLLBACK")
            res.json(err);
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
            return res.status(400).json({ success: false, message: "Validation Error Occurred", errors: errors.array() });
        }

        const serviceId = req.body.service_id;
        const jsonData = req.body;
        try {
            await db.query("BEGIN");

            if (Object.keys(jsonData).length === 0) {
                return res.status(400).json({ success: false, message: "No data provided for updating service." });
            }

            // Check if the provided service_id exists
            const checkServiceExists = await db.query("SELECT id FROM services WHERE id = $1", [serviceId]);
            if (checkServiceExists.rows.length === 0) {
                return res.status(404).json({ success: false, message: "Service not found." });
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
                            return res.json({ success: false, message: `Additional Information with ID ${element.id} not found.` });
                        }
                    } else {
                        // If additional information ID is not provided, insert new information
                        await db.query("INSERT INTO additional_information (title, description, service_id) VALUES ($1, $2, $3)", [element.title, element.description, serviceId]);
                    }
                }
            }

            await db.query("COMMIT");
            return res.status(200).json({ success: true, message: "Service updated successfully." });
        } catch (error) {
            await db.query("ROLLBACK");
            console.error("Error updating service:", error);
            return res.status(500).json({ success: false, message: "Error updating service." });
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
            return res.status(400).json({ success: false, message: "Validation Error Occurred", errors: errors.array() });
        }

        const serviceIds = req.body.service_ids;
        try {
            await db.query("BEGIN");

            if (serviceIds.length === 0) {
                return res.status(400).json({ success: false, message: "No service IDs provided for deletion." });
            }

            // Check if the provided service IDs exist
            const checkServiceExistsQuery = await db.query("SELECT id FROM services WHERE id = ANY($1)", [serviceIds]);
            const existingServiceIds = checkServiceExistsQuery.rows.map(row => row.id);

            // Filter out non-existing service IDs
            const nonExistingServiceIds = serviceIds.filter(id => !existingServiceIds.includes(id));

            if (nonExistingServiceIds.length > 0) {
                return res.status(404).json({ success: false, message: `Services with IDs ${nonExistingServiceIds.join(', ')} not found.` });
            }

            // Update the status of services to 0 (inactive)
            const updateStatusQuery = await db.query("UPDATE services SET status = 0 WHERE id = ANY($1)", [serviceIds]);

            const updateOptionsStatusQuery = await db.query("UPDATE services_options SET status = 0 WHERE service_id = ANY($1)", [serviceIds]);

            // Update the status of associated additional information to 0 (inactive)
            const updateInfoStatusQuery = await db.query("UPDATE additional_information SET status = 0 WHERE service_id = ANY($1)", [serviceIds]);


            await db.query("COMMIT");
            return res.status(200).json({ success: true, message: "Services deleted successfully." });
        } catch (error) {
            await db.query("ROLLBACK");
            console.error("Error deactivating services:", error);
            return res.status(500).json({ success: false, message: "Error deleting services." });
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



