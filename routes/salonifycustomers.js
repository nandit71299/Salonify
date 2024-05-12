import express, { query } from "express";
import bodyParser from "body-parser";
import db from "../database.js";
import axios from "axios";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import authMiddleware from '../middleware/authMiddleware.js';
import { check, body, validationResult, param } from 'express-validator';
import nodemailer from "nodemailer";
import moment from "moment-timezone";
import dotenv from "dotenv";
import * as enums from "../enums.js"
import { fileURLToPath } from 'url';
import path, { parse } from 'path';
import fs, { stat, unwatchFile } from 'fs';
moment.tz.setDefault('Asia/Kolkata');


const router = express.Router();

const SecretKey = process.env.SecretKey;
export const app = express();
const saltRounds = Number(process.env.saltrounds);

let transporter =
    nodemailer.createTransport(
        {
            service: 'gmail',
            auth: {
                user: process.env.mail_id,
                pass: `${process.env.mailPass}`
            }
        }
    );

app.use(bodyParser.urlencoded({ extended: true, }));

var jsonParser = bodyParser.json();


router.post("/sendOTP",
    check("email").isEmail(),
    async (req, res) => {
        try {
            // Check for validation errors
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, data: [], message: "400 Bad Request", errors: errors.array() });
            }

            // Normalize email address
            const email = req.body.email.toLowerCase();

            // Find customer with the provided email
            const findCustomer = await db.query("SELECT * FROM users WHERE email = $1 AND status = $2 AND user_type = $3", [email, enums.is_active.yes, enums.UserType.customer]);

            // If customer with the given email is found
            if (findCustomer.rowCount > 0) {
                // Generate OTP
                const OTP = Math.floor(Math.random() * 100000);
                const customer_id = findCustomer.rows[0].id;

                // Update OTP, validity, and timestamp in the database
                const result = await db.query("UPDATE users SET OTP = $1, otp_validity = 20, reset_password_timestamp = now() WHERE id = $2 RETURNING *", [OTP, customer_id]);

                // Send OTP mail to the customer
                const info = await transporter.sendMail({
                    from: "Salonify", // Sender address
                    to: email, // Receiver address
                    subject: "Salonify: OTP to Reset your password", // Subject
                    html: `Hello, ${email}<br>Please use the OTP <b>${OTP}</b> to reset your password.`, // HTML body
                });

                return res.status(200).json({
                    success: true,
                    message: "OTP sent to registered email address.",
                    data: [{ otp: OTP }]
                });
            } else {
                return res.status(404).json({ success: false, data: [], message: "User not found." });
            }
        } catch (error) {
            // Handle errors
            console.error("Error in sendOTP route:", error);
            return res.status(500).json({ success: false, data: [], message: "Internal Server Error", errors: error.message });
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
                return res.status(400).json({ success: false, data: [], message: "400 Bad Request", errors: errors.array() });
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
                return res.status(409).json({ success: false, data: [], message: "User with this email is already registered, please login..." });
            }

            const checkMobileExistence = await db.query("SELECT * FROM users WHERE phone_number = $1 AND status = $2 AND user_type = $3", [phone_number, enums.is_active.yes, enums.UserType.customer]);
            if (checkMobileExistence.rows.length > 0) {
                return res.status(409).json({ success: false, data: [], message: "User with this phone number is already registered, please login..." });
            }

            // Hash the password
            const hashedPassword = await bcrypt.hash(password, saltRounds);
            const result = await db.query("INSERT INTO users (email,password,name,phone_number,dob,user_type,status,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id", [email, hashedPassword, name, phone_number, dob, enums.UserType.customer, enums.is_active.yes, moment().format()]);

            // Check if insertion was successful
            if (result.rows.length > 0) {
                isSuccess = true;
            }

            res.status(201).json({ success: isSuccess, data: [{ id: result.rows[0].id }], message: "Customer Registered Succesfully" });
        } catch (error) {
            console.error("Error registering customer:", error);
            res.status(500).json({ success: false, data: [], message: "Internal Server Error." });
        }
    });

router.post("/login",
    [
        check("email").isEmail().normalizeEmail(),
        check("password").notEmpty()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: "400 Bad Request",
                errors: errors.array(),
                data: []
            });
        }

        const password = req.body.password;
        const email = req.body.email;
        try {
            const result = await db.query(`
                SELECT * FROM "users" 
                WHERE "email" = $1 AND status = $2 AND user_type = $3
            `, [email.toLowerCase(), enums.is_active.yes, enums.UserType.customer]);

            if (result.rowCount === 0) {
                return res.status(404).json({ success: false, data: [], message: "No user found with the given email address." });
            }

            const user = result.rows[0];
            bcrypt.compare(password, user.password, (err, passwordMatch) => {
                if (err || !passwordMatch) {
                    return res.status(401).json({ success: false, data: [], message: "Invalid email or password." });
                }

                const token = jwt.sign({ user }, SecretKey, { expiresIn: '1h' });
                return res.status(200).json({ success: true, data: [{ token, id: user.id }], message: "OK" });
            });
        } catch (error) {
            console.error("Error in login:", error);
            return res.status(500).json({ success: false, data: [], message: "Internal Server Error." });
        }
    }
);

router.post("/updatepassword",
    check("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters long."),
    check("email").isEmail().withMessage("Invalid email address."),
    async (req, res) => {
        try {
            // Validate request body
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, message: "400 Bad Request", data: [], errors: errors.array() });
            }

            // Normalize email address
            const email = req.body.email.toLowerCase();
            const password = req.body.password;

            // Check if user exists
            const findUser = await db.query("SELECT email FROM users WHERE email = $1", [email]);
            if (findUser.rowCount === 0) {
                return res.status(404).json({ success: false, data: [], message: "No user found with the given email address" });
            }

            // Hash the new password
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            // Update the password in the database
            const result = await db.query("UPDATE users SET password = $1, reset_password_timestamp = now() WHERE email = $2 RETURNING *", [hashedPassword, email]);

            if (result.rowCount > 0) {
                return res.status(201).json({ success: true, data: [{ id: result.rows[0].id }], message: "Password updated successfully" });
            } else {
                return res.status(500).json({ success: false, data: [], message: "Error updating password" });
            }
        } catch (error) {
            console.error("Error updating password:", error);
            return res.status(500).json({ success: false, data: [], message: "Internal Server Error" });
        }
    }
);


router.get("/categories", authMiddleware, async (req, res) => {
    try {
        // Fetch categories from the database
        const dbQuery = await db.query("SELECT id, name, image_path FROM categories");

        // Check if any categories were found
        if (dbQuery.rowCount === 0) {
            return res.status(204).json({ success: false, data: [], message: "No categories found" });
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
        return res.json({ success: true, data: categories, message: "OK" });
    } catch (error) {
        console.error("Error fetching categories:", error.message);
        return res.status(500).json({ success: false, data: [], message: "Internal server error" });
    }
});

// TODO - Modify GetAllBranchesinCity Endpoint is when city is dynamic
router.get('/branchesincity', authMiddleware, async (req, res) => {
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
            return res.status(404).json({ success: true, message: 'No branch found in the city.', data: [] });
        }

        res.json({ success: true, data: salonBranches.rows, message: "OK" });
    } catch (error) {
        console.error('Error listing salons:', error);
        res.status(500).json({ success: false, data: [], message: 'Internal Server Error' });
    }
});

router.get('/branchesbycategory', check("category_id").isInt(), authMiddleware, async (req, res) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, data: [], message: "400 Bad Request", errors: errors.array() });
    }

    try {
        const category_id = req.query.category_id;
        let salons = [];

        // Query to find services belonging to the specified category
        const servicesQuery = await db.query('SELECT * FROM services WHERE category_id = $1 AND status = $2', [category_id, enums.is_active.yes]);
        const services = servicesQuery.rows;

        for (const service of services) {
            // Check if service data is incomplete
            if (!service.branch_id) {
                continue; // Skip to the next iteration if branch_id is missing
            }

            // Query to retrieve branch information based on the service's branch_id
            const branchQuery = await db.query('SELECT * FROM branches WHERE id = $1 AND status = $2', [service.branch_id, enums.is_active.yes]);
            const branch = branchQuery.rows[0];

            // Check if branch data is incomplete
            if (!branch) {
                continue; // Skip to the next iteration if branch data is not found
            }

            // Add valid branch data to the salons array
            salons.push(branch);
        }

        const uniqueSalons = new Set(salons.map(salon => salon.id))
        salons = [];
        for (const element of uniqueSalons) {
            const branchQuery = await db.query('SELECT * FROM branches WHERE id = $1', [element]);
            const branch = branchQuery.rows[0];
            salons.push(branch);
        }

        if (salons.length === 0) {
            return res.status(404).json({ success: false, data: [], message: 'No active branches found for the specified category.' });
        }

        // Send the list of active branches as the response

        res.status(200).json({ success: true, data: salons, message: "OK" });
    } catch (error) {
        console.error('Error fetching active salons:', error);
        res.status(500).json({ success: false, data: [], message: 'Internal Server Error.' });
    }
});


router.get("/cartcount",
    check('user_id').isInt(),
    authMiddleware, async (req, res) => {

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
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
                res.status(200).json({ success: true, data: [{ item_count: 0, branch_id: null }], message: "OK" });
                return;
            }
            // Extract the item count and branch_id from the result
            const { item_count, branch_id } = cartDetails.rows[0];

            res.status(200).json({ success: true, data: [{ item_count: item_count, branch_id: branch_id }], message: "OK" });
        } catch (error) {
            console.error('Error fetching cart item count:', error);
            res.status(500).json({ success: false, data: [], message: 'Internal Server Error.' });
        }

    });

// router.get("/getCurrentAppointment")  USED IN DASHBOARD FOR DIRECT POST SERVICE PAYMENT
router.get("/rateSalon", async (req, res) => {
    const user_id = 1;
    const branch_id = 1;
    const rating = 1;
})

router.get("/searchservicesorbranches", check('searchstring').isString(), authMiddleware, async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, data: [], message: "400 Bad Request", errors: errors.array() });
    }

    const { searchstring, sortBy, sortOrder } = req.query;

    try {
        // Query to fetch branch name, service name, lowest and largest duration, and lowest price
        const query = `
        SELECT 
        b.id AS branch_id,
        b.name AS branch_name,
        b.address AS branch_address,
        s.id AS service_id,
        s.name AS service_name,
        MIN(so.duration) AS lowest_duration,
        MAX(so.duration) AS largest_duration,
        MIN(so.price) AS lowest_price
    FROM 
        branches b
    JOIN 
        services s ON b.id = s.branch_id
    JOIN 
        services_options so ON s.id = so.service_id
    WHERE 
        s.status = 1 
        AND so.status = 1 
        AND b.status = 1 
        AND s.name ILIKE $1
    GROUP BY 
        b.id, b.name, b.address, s.id,s.name;        
        `;

        let result = await db.query(query, [`%${searchstring}%`]);


        // Sorting
        if (sortBy && sortOrder) {
            let sortField;
            if (sortBy === 'price') {
                sortField = sortOrder === 'asc' ? 'lowest_price ASC' : 'lowest_price DESC';
            } else if (sortBy === 'duration') {
                sortField = sortOrder === 'asc' ? 'lowest_duration ASC' : 'lowest_duration DESC';
            }

            if (sortField) {
                result.rows.sort((a, b) => {
                    if (sortOrder === 'asc') {
                        return a[`${sortBy}_duration`] - b[`${sortBy}_duration`] || a.lowest_price - b.lowest_price;
                    } else {
                        return b[`${sortBy}_duration`] - a[`${sortBy}_duration`] || b.lowest_price - a.lowest_price;
                    }
                });
            }

        }


        const services = [];
        const branchesMap = {};

        result.rows.forEach(row => {
            const branchId = row.branch_id;
            if (!branchesMap[branchId]) {
                branchesMap[branchId] = {
                    branch_id: branchId,
                    branch_name: row.branch_name,
                    branch_address: row.branch_address
                };
            }
            services.push({
                branch_id: branchId,
                branch_name: row.branch_name,
                branch_address: row.branch_address,
                service_name: row.service_name,
                timings: {
                    lowest: row.lowest_duration,
                    largest: row.largest_duration
                },
                lowest_price: row.lowest_price
            });
        });

        const branches = Object.values(branchesMap);

        const searchResult = { services, branches };



        res.json({ success: true, data: searchResult, message: "OK" });
    } catch (error) {
        console.error('Error fetching service details:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error.', data: [] });
    }

});

router.get("/branchdetails", check('branch_id').isInt(), authMiddleware, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
    }

    const branch_id = req.query.branch_id;
    try {
        let data = {};

        const getBranch = await db.query("SELECT * from branches WHERE id = $1", [branch_id]);

        if (!getBranch.rowCount > 0) {
            return res.status(404).json({ success: false, errors: "Error Fetching Salon Details", data: [] });
        }

        const { saloon_id, name, city_id, address, type, latitude, longitude, seats, status } = getBranch.rows[0];

        let branchDetails = {
            saloon_id: saloon_id,
            name: name,
            city_id: city_id,
            address: address,
            type: parseInt(type) === 1 ? "Unisex Salon" : parseInt(type) === 2 ? "Men's Salon" : parseInt(type) === 3 ? "Women's Salon" : "",
            latitude: latitude,
            longitude: longitude,
            seats: seats,
            status: status
        };

        // Check if BranchDetails exists in data
        if (!data['BranchDetails']) {
            data['BranchDetails'] = [];
        }

        // Push branch details to the array
        data['BranchDetails'].push(branchDetails);

        // Fetch BranchHours for the current branch
        const getBranchHours = await db.query("SELECT * FROM branch_hours WHERE branch_id = $1 ORDER BY CASE day WHEN 'monday' THEN 1 WHEN 'tuesday' THEN 2 WHEN 'wednesday' THEN 3 WHEN 'thursday' THEN 4 WHEN 'friday' THEN 5 WHEN 'saturday' THEN 6 WHEN 'sunday' THEN 7 END", [branch_id]);
        if (getBranchHours.rows.length > 0) {
            // Initialize BranchHours array if it doesn't exist in data
            if (!data['BranchHours']) {
                data['BranchHours'] = [];
            }
            for (const iterator of getBranchHours.rows) {
                const day = iterator.day;
                const start_time = iterator.start_time;
                const end_time = iterator.end_time;
                // Push branch hours to the array
                let branch_hours = [{ day: day.charAt(0).toUpperCase() + day.slice(1), start_time: start_time, end_time: end_time }];

                data['BranchHours'].push(branch_hours);
            }
        }

        res.json({ success: true, data: data, message: "OK" });
    } catch (error) {
        console.error('Error fetching branch details:', error);
        res.status(500).json({ success: false, message: 'Internal server error', data: [] });
    }
});

//Add offers array in which branch has participated with this route
router.get('/branchservices', check("id").isInt(), authMiddleware, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
    }
    try {
        const branch_id = req.query.id;
        const departmentsQuery = await db.query("SELECT * FROM department");
        let departments = {};
        const sortingOption = req.query.sortingOption;
        const sortingMethod = req.query.sortingMethod;

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
                let serviceOptions = serviceOptionsQuery.rows;

                // Apply sorting based on sortingOption and sortingMethod
                if (sortingOption && sortingMethod) {
                    serviceOptions = serviceOptions.sort((a, b) => {
                        if (sortingMethod === 'asc') {
                            return a.price - b.price;
                        } else if (sortingMethod === 'desc') {
                            return b.price - a.price;
                        } else {
                            // Default to no sorting if sortingMethod is invalid
                            return 0;
                        }
                    });
                }

                // Skip adding service if it doesn't have any service options
                if (serviceOptions.length === 0) {
                    continue;
                }

                const additionalInformationQuery = await db.query("SELECT * FROM additional_information WHERE service_id = $1 AND status = $2;", [service.id, enums.is_active.yes]);
                let additionalInformation = [];
                if (additionalInformationQuery.rowCount > 0) {
                    additionalInformation = additionalInformationQuery.rows;
                }

                // Initialize the category if it doesn't exist
                if (!departments[departmentName][categoryName]) {
                    departments[departmentName][categoryName] = [];
                }

                // Add service with its options to the category
                departments[departmentName][categoryName].push({
                    service_id: service.id,
                    service_name: service.name,
                    service_description: service.description,
                    additional_information: additionalInformation,
                    service_options: serviceOptions
                });
            }
        }

        res.json({ success: true, data: departments, message: "OK" });
    } catch (error) {
        console.error('Error fetching services:', error);
        res.status(500).json({ success: false, data: [], message: 'Internal server error' });
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
            return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
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
                                await db.query("INSERT INTO cart_items (cart_id, service_option_id, price, total_tax, total_amount) VALUES ($1, $2, $3, $4, $5)", [existingCart.rows[0].id, services[index], price, 0, 0]);
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



                    res.json({ success: true, message: "Services added to the cart successfully.", data: [] });
                } else {
                    // Cart branch does not match the branch user is adding services for
                    res.status(400).json({ success: false, message: "Cannot add services to cart. Cart belongs to a different branch.", data: [] });
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

                res.json({ success: true, message: "Cart created and services added successfully.", data: [] });
            }
        } catch (error) {
            console.error("Error adding services to cart:", error);
            res.status(500).json({ success: false, message: "Internal Server Error.", data: [] });
        }
    });

router.delete("/remove-from-cart",
    check('user_id').isInt(),
    check('branch_id').isInt(),
    check('serviceOptionId').isInt(),
    async (req, res) => {


        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
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

                res.json({ success: true, message: "Cart item removed successfully.", data: [] });
            } else {
                // Cart item not found or does not belong to the specified user and branch
                res.status(404).json({ success: false, message: "Cart item not found or does not belong to the specified user and branch.", data: [] });
            }
        } catch (error) {
            console.error("Error removing cart item:", error);
            res.status(500).json({ success: false, message: "Internal Server Error.", data: [] });
        }
    });

router.delete('/cartdeleteall',
    check('userId').isInt(),
    authMiddleware,
    async (req, res) => {

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
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

            res.json({ success: true, message: 'Cart deleted successfully.', data: [] });
        } catch (error) {
            await db.query('ROLLBACK');
            console.error('Error deleting cart:', error);
            res.status(500).json({ success: false, message: 'Internal Server Error.', data: [] });
        }
    });


router.get('/branchvacancy', jsonParser, body('branch_id').isInt(), body("appointment_date").isDate(), body('services').isArray(), authMiddleware, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
    }

    try {
        const branch_id = req.body.branch_id;
        const formatedAppointmentDate = moment(req.body.appointment_date, 'YYYY/MM/DD').format("YYYY-MM-DD");
        const weekdayName = moment(formatedAppointmentDate).format('dddd').toLowerCase();

        const getBranchHours = await db.query("SELECT start_time, end_time FROM branch_hours WHERE branch_id = $1 AND day =$2 ", [branch_id, weekdayName]);
        if (getBranchHours.rows.length === 0) {
            return res.status(409).json({
                success: false,
                message: "Branch is closed on the selected day.",
                data: []
            });
        }

        let branchStartTime = moment(getBranchHours.rows[0].start_time, 'HH:mm').add(30, 'minutes').format('HH.mm');
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
            const getServiceDuration = await db.query("select duration,services_options.id as id,services.branch_id from services_options join services on services_options.service_id = services.id WHERE branch_id = $1 AND services.status = $2 AND services_options.id = $3", [branch_id, enums.is_active.yes, service_id]);
            if (getServiceDuration.rowCount === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Could'nt find one or more services.",
                    data: []
                })
                break;
            }
            const serviceDuration = parseInt(getServiceDuration.rows[0].duration);
            getServiceTotalDuration += serviceDuration;
        }

        // Define slot interval (e.g., duration of the longest service)
        const slotInterval = getServiceTotalDuration + 15; // You can adjust this according to your requirements

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

        // Initialize a set to store unique slot timings
        let availableSlots = new Set();
        let unavailableSlots = new Set();
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
                    // Add the slot to the set if it's available
                    availableSlots.add(JSON.stringify(slot));
                } else {
                    unavailableSlots.add(JSON.stringify(slot));
                }
            }
        }

        // Convert unique slots back to array format
        availableSlots = Array.from(availableSlots).map(slot => JSON.parse(slot));
        unavailableSlots = Array.from(unavailableSlots).map(slot => JSON.parse(slot));

        // Return available and unavailable slots
        return res.json({
            success: true,
            message: "Appointment slots generated successfully.",
            data: [{
                available_slots: availableSlots,
                unavailable_slots: unavailableSlots
            }]
        });
    } catch (error) {
        console.error("Error generating appointment slots:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            data: []
        });
    }
});

router.get("/branchoffers", check("branch_id").isInt(), authMiddleware, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
    }

    const branch_id = req.query.branch_id;
    const data = { coupons: [] };

    try {
        const getOffers = await db.query(`SELECT pcb.platform_coupon_id, pc.discount_amount, pc.remark, pc.max_advance_payment, pcb.branch_id
        FROM platform_coupon pc
        JOIN platform_coupon_branch pcb ON pc.id = pcb.platform_coupon_id
        WHERE pcb.branch_id = $1;
        `, [branch_id]);
        if (getOffers.rowCount > 0) {
            for (const iterator of getOffers.rows) {
                const platform_coupon_id = iterator.platform_coupon_id;
                const discount_amount = iterator.discountAmount;
                const remark = iterator.remark;
                const max_advance_payment = iterator.max_advance_payment;
                const branch_id = iterator.branch_id;

                data['coupons'].push({ platform_coupon_id, discount_amount, remark, max_advance_payment, branch_id });

            }
        }


        res.json({ success: true, data: data, message: "OK" });


    } catch (error) {

        res.status(500).json({ success: false, message: "Internal Server Error", data: [] });

    }


});


// ADD RESERVE A SEAT PAGE ROUTE WHICH GETS ALL SERVICES USER ADDED IN THE CART, GET ITS PRICE FROM SERVICE_OPTIONS AND SEND OTHER INFORMATION

router.post("/bookappointment",
    check("user_id").isNumeric(),
    check("branch_id").isNumeric(),
    check("services").isArray(),
    check("services.*").isNumeric(),
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
            return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
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

            // Check if services belong to the same branch? and services do exists?
            for (const service of services) {
                const service_id = service;
                const query = await db.query("SELECT services_options.*,services.branch_id FROM services_options LEFT JOIN services ON services_options.service_id = services.id WHERE services_options.id = $1 AND services_options.status = $2 AND services.branch_id = $3;", [service_id, enums.is_active.yes, branch_id]);
                if (query.rowCount === 0) {
                    return res.status(404).json({
                        success: false,
                        message: `Appologies. Seems like the branch is no longer accepting appointments for one of your service. Feel free to explore other services from this branch or other near by branches.`,
                        data: []
                    })
                }
            }


            let taxAmount = 0;
            let discountAmount = 0;
            let advance_percentage = 30;

            // Handle platform coupon discount
            if (!isNaN(platform_coupon_id) && parseInt(platform_coupon_id) !== 0) {
                // check if the branch has actually particiapted in the offer or not
                const checkBranchCoupon = await db.query("SELECT * FROM platform_coupon_branch WHERE branch_id = $1 AND platform_coupon_id = $2;", [branch_id, platform_coupon_id]);
                if (checkBranchCoupon.rowCount === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "Opps!! Looks like the coupon is not valid or is expired...",
                        data: [],
                    })
                }

                // check coupon exists or not. if yes assign respective values. if not return error
                const checkCoupon = await db.query("SELECT discount_amount,advance_percentage FROM platform_coupon WHERE id = $1", [platform_coupon_id]);
                if (checkCoupon.rowCount > 0) {
                    discountAmount = checkCoupon.rows[0].discount_amount;
                    advance_percentage = checkCoupon.rows[0].advance_percentage;
                } else {
                    return res.status(400).json({
                        success: false,
                        message: "Opps!! Looks like the coupon is not valid or is expired.",
                        data: [],
                    });
                }
            }

            // Determine the weekday name of the appointment date
            const formattedAppointmentDate = moment(appointment_date, 'YYYY/MM/DD').format('YYYY-MM-DD');
            const appointmentWeekday = moment(formattedAppointmentDate).format('dddd').toLowerCase();

            // Query branch hours for the appointment weekday , and 
            // Check if the salon is closed on the selected appointment day
            const branchHoursQuery = await db.query("SELECT start_time, end_time, status FROM branch_hours WHERE branch_id = $1 AND day = $2 AND status = $3", [branch_id, appointmentWeekday, enums.is_active.yes]);
            if (branchHoursQuery.rowCount === 0) {
                return res.status(409).json({
                    success: false,
                    message: "Salon is not open on the selected appointment day.",
                    data: []
                });
            }

            // check if salon is on holiday on the selected day..
            const appointmentDateTime = new Date(`${appointment_date} ${start_time}`);
            const checkHolidayQuery = await db.query("SELECT id FROM holiday_hours WHERE branch_id = $1 AND $2 BETWEEN from_date AND to_date AND status = 1", [branch_id, appointmentDateTime]);
            if (checkHolidayQuery.rowCount > 0) {
                return res.status(409).json({ success: false, message: "The salon is closed for holiday on the selected appointment date/time." });
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
                return res.status(409).json({
                    success: false,
                    message: "Appointment time is outside of store hours.",
                    data: []
                });
            }

            // Initialize end time with the start time
            let endTime = moment(start_time, 'HH:mm');

            // Loop through each service and add its duration to the end time
            for (const serviceId of services) {
                const serviceOptionQuery = await db.query("SELECT duration FROM services_options WHERE id = $1 AND status = $2", [serviceId, enums.is_active.yes]);
                if (serviceOptionQuery.rowCount === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "Apologies, it seems this service is currently unavailable. Please feel free to explore other services at this branch or similar ones at nearby branches. Thank you for your understanding!",
                        data: []
                    })
                }
                const serviceDuration = serviceOptionQuery.rows[0].duration;

                // Add service duration to the end time
                endTime.add(serviceDuration, 'minutes');
            }

            // Format the end time back to HH:mm format
            endTime = moment(endTime, "HH:mm").subtract(1, "minutes").format('HH:mm');


            // Check available seats
            const checkSeatsQuery = await db.query("SELECT seats FROM branches WHERE id = $1 AND status = $2", [branch_id, enums.is_active.yes]);
            if (checkSeatsQuery.rowCount === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Appologies, it seems the branch is not accepting the appointments right now.",
                    data: []
                })
            }
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
                return res.status(409).json({
                    success: false,
                    message: "No available seats for the given time slot.",

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

                await db.query("INSERT INTO appointment_items (appointment_id,service_option_id,service_price,total_item_discount,total_tax,total_price_paid) VALUES ($1,$2,$3,$4,$5,$6)", [appointmentId, services[index], servicePrice, total_item_discount, total_tax, total_price_paid]);

                finalSubtotal += servicePrice;
                finalTotalDiscount += total_item_discount;
                finalTotalTax += total_tax;
            }


            const finalNetAmount = finalSubtotal - finalTotalDiscount + finalTotalTax;
            const updateAppointment = await db.query("UPDATE appointment SET subtotal = $1,total_discount=$2,total_tax=$3,net_amount=$4 WHERE id = $5 RETURNING *", [finalSubtotal, finalTotalDiscount, finalTotalTax, finalNetAmount, appointmentId]);
            if (finalTotalDiscount > 0) {
                const insertAppointmentDiscount = await db.query("INSERT INTO appointment_discount (appointment_id,coupon_type,coupon_id,amount) VALUES ($1,$2,$3,$4);", [updateAppointment.rows[0].id, platform_coupon_id ? enums.coupon_type.platform_coupon : 2, platform_coupon_id, finalTotalDiscount])
            }

            let advance_amount = (finalNetAmount * advance_percentage) / 100;

            await db.query('COMMIT');
            res.json({
                success: true,
                message: "Appointment booked successfully.",
                data:
                    [{
                        appointment: updateAppointment.rows[0],
                        advance_amount: parseFloat(`${advance_amount}`).toFixed(2)
                    }]
            });
        } catch (error) {
            await db.query('ROLLBACK');
            console.error("Error making request:", error);
            res.status(500).json({
                success: false,
                message: "Error making request.",
                data: []
            });
        }
    })

// FIXME Maybe in this route we need to get the current total_price_paid from the tables and add it to the new payment amount... , also deicde when to add payment details in payment table whether in this route or payment route
router.put("/confirm-appointment",
    check('appointment_id').isInt(),
    check('paid_amount').isFloat(), authMiddleware, async (req, res) => {

        // Validate request parameters
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }

        try {
            const { appointment_id, paid_amount, transaction_id, payment_date, payment_amount, status, remarks } = req.body;
            const payment_method = "ONLINE";

            // Start a database transaction
            await db.query("BEGIN");



            // const getUserId = await db.query("SELECT user_id FROM appointments WHERE id = $1;", [appointment_id]);
            // if (getUserId.rowCount < 1) {
            //     return res.status(404).json({ success: false, errors: "Appointment not found." });
            // }
            // const user_id = getUserId.rows[0].user_id;

            // const recordPayment = await db.query("INSERT INTO payments (user_id,appointment_id,)")


            // Fetch the existing total_amount_paid from the database
            const getAppointment = await db.query("SELECT total_amount_paid FROM appointment WHERE id = $1", [appointment_id]);

            if (getAppointment.rowCount === 0) {
                await db.query('ROLLBACK');
                return res.status(404).json({ success: false, message: "Appointment not found.", data: [] });
            }

            const existingPaidAmount = parseFloat(getAppointment.rows[0].total_amount_paid);
            // Calculate the new total_amount_paid
            const newTotalPaidAmount = (parseFloat(existingPaidAmount) + parseFloat(paid_amount)).toFixed(2);

            // Update total_amount_paid in the appointment table
            const updateAppointment = await db.query("UPDATE appointment SET total_amount_paid = $1, status = $2 WHERE id = $3 RETURNING id", [newTotalPaidAmount, enums.appointmentType.Confirmed, appointment_id]);

            if (updateAppointment.rowCount === 0) {
                await db.query('ROLLBACK');
                return res.status(404).json({ success: false, message: "Appointment not found.", data: [] });
            }

            // Fetch the service items associated with the appointment
            const getAppointmentItems = await db.query("SELECT * FROM appointment_items WHERE appointment_id = $1", [appointment_id]);

            if (getAppointmentItems.rowCount === 0) {
                await db.query('ROLLBACK');
                return res.status(404).json({ success: false, message: "Error Fetching Appointment Items.", data: [] });
            }

            if (getAppointmentItems.rowCount > 0) {
                const serviceItems = getAppointmentItems.rows;

                // Calculate the new total_price_paid for each service item
                for (const item of serviceItems) {
                    const newTotalPricePaid = parseFloat(item.service_price) * parseFloat(paid_amount) + parseFloat(existingPaidAmount)
                    // const newTotalPricePaid = parseFloat(item.service_price) * ((parseFloat(paid_amount) / parseFloat(existingPaidAmount)));
                    // Update total_price_paid for each service item
                    await db.query("UPDATE appointment_items SET total_price_paid = $1 WHERE id = $2", [newTotalPricePaid, item.id]);
                }
            }


            // Commit the transaction
            await db.query("COMMIT");

            return res.status(200).json({ success: true, message: "Appointment confirmed.", data: [] });
        } catch (error) {
            // Rollback the transaction in case of an error
            await db.query('ROLLBACK');
            console.error("Error making request:", error);
            return res.status(500).json({ success: false, message: "Internal Server Error.", data: [] });
        }
    });

router.get("/bookingshistory", check("user_id").isInt(), authMiddleware, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
    }

    const user_id = req.body.user_id;

    try {
        const data = { upcoming: [], today: [], past: [] };
        const getUserAppointments = await db.query("SELECT * FROM appointment WHERE user_id = $1", [user_id]);
        const appointments = getUserAppointments.rows;

        for (const iterator of appointments) {
            const { id, receipt_number, branch_id, subtotal, total_discount, total_tax, net_amount, total_amount_paid, end_time, seat_number, created_at, is_rescheduled } = iterator;
            let { status } = iterator;

            // Formatting date and time
            let appointment_date = moment(iterator.appointment_date).format("YYYY-MM-DD");
            let start_time = moment(iterator.start_time, "HH:mm").format("HH:mm");

            // Get branch Details 
            const getBranchDetails = await db.query("SELECT name, address FROM branches WHERE id = $1", [branch_id]);
            const branchDetails = getBranchDetails.rows[0];

            const getAppointmentItemsIds = await db.query("SELECT service_option_id from appointment_items WHERE appointment_id = $1;", [id]);
            const appointmentItemsIds = getAppointmentItemsIds.rows;
            const services_options = [];
            for (const iterator of appointmentItemsIds) {
                const getServiceIds = await db.query("SELECT id,name FROM services_options WHERE id = $1", [iterator.service_id]);
                if (getServiceIds.rowCount < 1) {
                    continue;
                }
                services_options.push({ id: getServiceIds.rows[0].id, name: getServiceIds.rows[0].name });
            }



            // Calculate if appointment is cancellable or reschedulable
            const threeHoursBeforeAppointment = moment(`${appointment_date} ${start_time}`, 'YYYY-MM-DD HH:mm').subtract(3, 'hours');
            const isCancellable = (
                (status !== enums.appointmentType.Pending_Payment_Confirmation) &&
                (status === enums.appointmentType.Confirmed || status === enums.appointmentType.NoShow) &&
                status !== enums.appointmentType.Closed &&
                status !== enums.appointmentType.Cancelled
            ) || (status === enums.appointmentType.Confirmed && moment().isBefore(threeHoursBeforeAppointment) && is_rescheduled !== 1);

            const isRescheduleable = (
                (status !== enums.appointmentType.Pending_Payment_Confirmation) &&
                (status === enums.appointmentType.Confirmed && moment().isBefore(threeHoursBeforeAppointment) && is_rescheduled !== 1) &&
                status !== enums.appointmentType.Closed &&
                status !== enums.appointmentType.Cancelled &&
                status !== enums.appointmentType.NoShow
            );


            // Assign appointment to appropriate category
            const currentDate = moment().format("YYYY-MM-DD");
            if (appointment_date > currentDate) {
                data.upcoming.push(getAppointmentObject());
            } else if (appointment_date === currentDate) {
                data.today.push(getAppointmentObject());
            } else {
                data.past.push(getAppointmentObject());
            }

            function getAppointmentObject() {
                return {
                    user_id, id, receipt_number, branch_id, appointment_date, subtotal, total_discount, total_tax,
                    net_amount, total_amount_paid, start_time, end_time, status, seat_number, isRescheduleable, isCancellable,
                    created_at, branch_details: branchDetails, services_options
                };
            }
        }

        res.json({ success: true, data: data, message: "OK" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Internal Server Error", data: [] });
    }
});

router.put("/servicewishlist", check('user_id').isInt(), check('type_id').isInt(), authMiddleware, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
    }
    try {
        const { user_id, type_id } = req.body;

        // Check if a row exists for the given user, wishlist type, and type ID
        const existingRow = await db.query(
            `SELECT * FROM wishlist WHERE user_id = $1 AND wishlist_type = $2 AND type_id = $3`,
            [user_id, enums.wishlist_type.branch, type_id]
        );

        let statusToUpdate;
        if (existingRow.rows.length > 0) {
            // Toggle the status
            const currentStatus = existingRow.rows[0].status;
            statusToUpdate = currentStatus === 0 ? 1 : 0;

            // Update the row in the database with the new status
            if (statusToUpdate === 0) {
                // Set deleted_at to current timestamp
                await db.query(
                    `UPDATE wishlist SET status = $1, deleted_at = now() WHERE user_id = $2 AND wishlist_type = $3 AND type_id = $4`,
                    [statusToUpdate, user_id, enums.wishlist_type.branch, type_id]
                );
            } else {
                await db.query(
                    `UPDATE wishlist SET status = $1, deleted_at = NULL WHERE user_id = $2 AND wishlist_type = $3 AND type_id = $4`,
                    [statusToUpdate, user_id, enums.wishlist_type.branch, type_id]
                );
            }

        } else {
            // If the row does not exist, insert a new row with status 1
            statusToUpdate = 1;
            await db.query(
                `INSERT INTO wishlist(user_id, wishlist_type, type_id, status) VALUES($1, $2, $3, $4)`,
                [user_id, enums.wishlist_type.branch, type_id, statusToUpdate]
            );
        }

        res.json({ success: true, data: [{ status: statusToUpdate }], message: "OK" });
    } catch (error) {
        console.error('Error updating wishlist:', error);
        res.status(500).json({ success: false, message: 'Internal server error', data: [] });
    }
});

router.put("/branchwishlist", check('user_id').isInt, check('type_id').isInt(), authMiddleware, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
    }
    try {
        const { user_id, type_id } = req.body;

        // Check if a row exists for the given user, wishlist type, and type ID
        const existingRow = await db.query(
            `SELECT * FROM wishlist WHERE user_id = $1 AND wishlist_type = $2 AND type_id = $3`,
            [user_id, enums.wishlist_type.branch, type_id]
        );

        let statusToUpdate;
        if (existingRow.rows.length > 0) {
            // Toggle the status
            const currentStatus = existingRow.rows[0].status;
            statusToUpdate = currentStatus === 0 ? 1 : 0;

            // Update the row in the database with the new status
            if (statusToUpdate === 0) {
                // Set deleted_at to current timestamp
                await db.query(
                    `UPDATE wishlist SET status = $1, deleted_at = now() WHERE user_id = $2 AND wishlist_type = $3 AND type_id = $4`,
                    [statusToUpdate, user_id, enums.wishlist_type.branch, type_id]
                );
            } else {
                await db.query(
                    `UPDATE wishlist SET status = $1, deleted_at = NULL WHERE user_id = $2 AND wishlist_type = $3 AND type_id = $4`,
                    [statusToUpdate, user_id, enums.wishlist_type.branch, type_id]
                );
            }

        } else {
            // If the row does not exist, insert a new row with status 1
            statusToUpdate = 1;
            await db.query(
                `INSERT INTO wishlist(user_id, wishlist_type, type_id, status) VALUES($1, $2, $3, $4)`,
                [user_id, enums.wishlist_type.branch, type_id, statusToUpdate]
            );
        }

        res.json({ success: true, data: [{ status: statusToUpdate }], message: "OK" });
    } catch (error) {
        console.error('Error updating wishlist:', error);
        res.status(500).json({ success: false, message: 'Internal server error', data: [] });
    }
});

// router.get("/initiateadvancepayment",)
// router.get("/initiatepostservicepayment",)

router.get("/appointmentdetails", check("appointment_id").isInt(), check("branch_id").isInt(), authMiddleware, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
    }
    try {
        const appointmentId = req.query.appointment_id;
        const branch_id = req.query.branch_id;
        // Fetch appointment details
        const appointmentDetails = await db.query("SELECT * FROM appointment WHERE id = $1 AND branch_id = $2", [appointmentId, branch_id]);
        const appointment = appointmentDetails.rows[0];

        if (appointmentDetails.rowCount === 0) {
            return res.status(404).json({ success: false, message: "Appointment not found", data: [] })
        }

        // Fetch Branch Details
        const getBranchDetails = await db.query("SELECT * FROM branches WHERE id = $1;", [appointment.branch_id]);
        const branchDetails = getBranchDetails.rows[0];

        // Fetch payment details
        const paymentDetails = await db.query("SELECT * FROM payments WHERE appointment_id = $1", [appointmentId]);

        const data = {
            appointment_details: appointmentDetails.rows,
            branch_details: branchDetails,
            service_details: [],
            payment_details: {
                successfull_payments: [],
                failed_payments: [],
                refunded_payments: [],
                unknown_payment: []
            }
        };

        const services = {};

        const getAppointmentServices = await db.query("SELECT * FROM appointment_items WHERE appointment_id = $1;", [appointment.id]);
        for (const iterator of getAppointmentServices.rows) {
            const getServiceDetails = await db.query('SELECT * FROM services_options WHERE id = $1;', [iterator.service_id]);
            if (getServiceDetails.rowCount === 0) {
                continue;
            }
            const serviceName = getServiceDetails.rows[0].name;
            const servicePrice = iterator.service_price;
            data.service_details.push({ serviceName: serviceName, servicePrice: servicePrice });
        }

        // Categorize payment details
        paymentDetails.rows.forEach(payment => {
            switch (payment.status) {
                case enums.payment_status.succesfull:
                    data.payment_details.successfull_payments.push(payment);
                    break;
                case enums.payment_status.failed:
                    data.payment_details.failed_payments.push(payment);
                    break;
                case enums.payment_status.refunded:
                    data.payment_details.refunded_payments.push(payment);
                    break;
                default:
                    data.payment_details.unknown_payment.push(payment);
                    break;
            }
        });

        res.json({ success: true, data: data, message: "OK" });
    } catch (error) {
        console.error("Error fetching appointment details:", error);
        res.status(500).json({ success: false, message: "Internal server error", data: [] });
    }
});

router.get("/cancellationsummary", check("appointment_id"), authMiddleware, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
    }
    try {
        // Initialize data object to store appointment, service, and refund details
        const data = { appointmentDetails: [], serviceDetails: [], cancellation_reasons: [], refundSummary: [] };

        // Extract appointment ID from query parameter
        const appointment_id = req.query.appointment_id;

        // Retrieve appointment details from the database
        const getAppointmentData = await db.query("SELECT * FROM appointment WHERE id = $1;", [appointment_id]);
        const appointmentData = getAppointmentData.rows[0];

        // Check if appointment exists
        if (!appointmentData) {
            return res.status(404).json({ success: false, message: 'Appointment not found' });
        }

        // Retrieve branch details associated with the appointment
        const getBranchDetails = await db.query("SELECT * FROM branches WHERE id = $1;", [appointmentData.branch_id]);
        const branchName = getBranchDetails.rows[0].name;
        const branchAddress = getBranchDetails.rows[0].address;

        // Retrieve services associated with the appointment
        const getAppointmentServicesId = await db.query("SELECT * FROM appointment_items WHERE appointment_id = $1;", [appointment_id]);
        const appointmentServices = getAppointmentServicesId.rows;

        // Process appointment services and add to data object
        for (const iterator of appointmentServices) {
            const service = {};
            const service_price = iterator.service_price;
            const serviceDetails = await db.query("SELECT name FROM services_options WHERE id = $1;", [iterator.service_id]);
            service.name = serviceDetails.rows[0].name;
            service.price = service_price;
            data.serviceDetails.push(service);
        }

        // Format appointment date and start time
        const appointment_date = moment(appointmentData.appointment_date, "YYYY-MM-DD").format("YYYY-MM-DD");
        const start_time = moment(appointmentData.start_time, "HH:mm").format("HH:mm");

        // Calculate refund amount and cancellation charges based on appointment status
        let refund_amount = 0;
        let cancellation_charges = 0;
        const status = appointmentData.status;
        const paidAmount = appointmentData.total_amount_paid;
        if (status === 2) { // Confirmed
            if (parseInt(appointmentData.is_rescheduled) !== 1) { // Not rescheduled
                const threeHoursBeforeAppointment = moment(`${appointment_date} ${start_time}`, 'YYYY-MM-DD HH:mm').subtract(3, 'hours');
                if (moment().isBefore(threeHoursBeforeAppointment)) {
                    refund_amount = paidAmount;
                }
            }
            cancellation_charges = refund_amount === 0 ? paidAmount : 0;
        } else {
            // For other statuses, cancellation charges are equal to the paid amount
            cancellation_charges = paidAmount;
        }

        const getCancellationReasons = await db.query("SELECT id,reason FROM cancellation_reason;");
        const cancellationReasons = getCancellationReasons.rows;

        // Add refund summary and appointment details to data object
        data.refundSummary.push({ paidAmount: parseFloat(paidAmount).toFixed(2), refund_amount: parseFloat(refund_amount).toFixed(2), cancellation_charges: parseFloat(cancellation_charges).toFixed(2) });
        data.appointmentDetails.push({ name: branchName, address: branchAddress, appointment_reciept_number: appointmentData.receipt_number, appointment_date: appointment_date, start_time: start_time });
        for (const iterator of cancellationReasons) {
            data.cancellation_reasons.push(iterator)
        }
        // Send the data object as the response
        res.status(200).json({ success: true, data: data, message: "OK" });
    } catch (error) {
        // Handle any errors
        console.error(error);
        res.status(500).json({ success: false, message: "Internal server error", data: [] });
    }
});

// router.put("/cancelappointment",)
router.put("/rescheduleappointment", check("appointment_id").isInt(), check("newDate").isDate(), check("newStartTime").isTime(), async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
    }
    try {
        const { appointment_id, newDate } = req.query;
        let newStartTime = req.query.newStartTime;
        // Get Appointment Details
        const appointmentDetails = (await db.query("SELECT * FROM appointment WHERE id = $1;", [appointment_id])).rows[0];

        // Check if the appointment is reschedulable
        const is_rescheduled = appointmentDetails.is_rescheduled;
        const prevAppointment_date = moment(appointmentDetails.appointment_date).format("YYYY-MM-DD");
        const prevStart_time = moment(appointmentDetails.start_time, "HH:mm").format("HH:mm");
        const threeHoursBeforeAppointment = moment(`${prevAppointment_date} ${prevStart_time}`, 'YYYY-MM-DD HH:mm').subtract(3, 'hours');
        const status = appointmentDetails.status;

        // Checking if the appointment is rescheduleable
        const isRescheduleable = (
            (status !== enums.appointmentType.Pending_Payment_Confirmation) &&
            (status === enums.appointmentType.Confirmed && moment().isBefore(threeHoursBeforeAppointment) && is_rescheduled !== 1) &&
            status !== enums.appointmentType.Closed &&
            status !== enums.appointmentType.Cancelled &&
            status !== enums.appointmentType.NoShow
        );

        if (!isRescheduleable) {
            return res.status(403).json({ success: false, message: "Appointment is not eligible for Rescheduling...", data: [] });
        }

        // Calculate new end time
        const previousStartTimeMoment = moment(appointmentDetails.start_time, 'HH:mm');
        const previousEndTimeMoment = moment(appointmentDetails.end_time, 'HH:mm');
        const duration = moment.duration(previousEndTimeMoment.diff(previousStartTimeMoment));
        const minutes = duration.asMinutes();
        let newEndTime = moment(newStartTime, "HH:mm").add(minutes, "minutes").subtract(1, "minutes").format("HH:mm");

        // Check if appointment time is outside of store hours
        const appointmentWeekday = moment(newDate).format('dddd').toLowerCase();
        const branchHoursQuery = await db.query("SELECT start_time, end_time FROM branch_hours WHERE branch_id = $1 AND day = $2", [appointmentDetails.branch_id, appointmentWeekday]);
        if (branchHoursQuery.rowCount === 0) {
            return res.status(403).json({ success: false, message: "Salon is not open on the selected appointment day." });
        }

        const storeStartTime = branchHoursQuery.rows[0].start_time;
        const storeEndTime = branchHoursQuery.rows[0].end_time;
        const momentStoreStartTime = moment(storeStartTime, 'HH:mm');
        const momentStoreEndTime = moment(storeEndTime, 'HH:mm');
        const momentAppointmentStartTime = moment(newStartTime, 'HH:mm');

        if (momentAppointmentStartTime.isBefore(momentStoreStartTime) || momentAppointmentStartTime.isAfter(momentStoreEndTime)) {
            return res.status(403).json({ success: false, message: "Appointment time is outside of store hours." });
        }

        // Check for available seats
        const checkSeatsQuery = await db.query("SELECT seats FROM branches WHERE id = $1", [appointmentDetails.branch_id]);
        const totalSeats = checkSeatsQuery.rows[0].seats;
        let availableSeat = 0;
        newStartTime = moment(newStartTime, "HH:mm").format("HH:mm");
        newEndTime = moment(newEndTime, "HH:mm").format("HH:mm");
        for (let seatNumber = 1; seatNumber <= totalSeats; seatNumber++) {
            const checkAppointmentsQuery = await db.query("SELECT id FROM appointment WHERE branch_id = $1 AND seat_number = $2 AND appointment_date = $3 AND ((start_time <= $4 AND end_time >= $4) OR (start_time <= $5 AND end_time >= $5))", [appointmentDetails.branch_id, seatNumber, newDate, newStartTime, newEndTime]);
            if (checkAppointmentsQuery.rowCount === 0) {
                availableSeat = seatNumber;
                break;
            }
        }

        if (availableSeat === 0) {
            return res.status(409).json({ success: false, message: "No available seats for the given time slot." });
        }

        // Update the appointment
        const updateAppointment = await db.query("UPDATE appointment SET appointment_date = $1, start_time = $2, end_time = $3, is_rescheduled = 1 , seat_number = $4, updated_at = now()  WHERE id = $5 RETURNING *", [newDate, newStartTime, newEndTime, availableSeat, appointment_id]);

        res.json({ success: true, message: "OK", data: updateAppointment.rows })
    } catch (error) {
        console.error("Error in rescheduling appointment:", error);
        res.status(500).json({ success: false, message: "Internal Server Error." });
    }
});

router.get("/wishlisteditems", check("user_id").isInt(), async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
    }
    try {

        const user_id = req.query.user_id;
        const getWishlistData = await db.query("SELECT * FROM wishlist WHERE user_id = $1", [user_id]);
        if (getWishlistData.rowCount === 0) {
            return res.status(404).json({ success: true, message: "No Wishlisted Items Found.", data: [] })
        }
        const wishlistData = getWishlistData.rows;

        const data = {
            services: [],
            branches: []
        }
        for (const iterator of wishlistData) {
            if (parseInt(iterator.wishlist_type) === enums.wishlist_type.service) {
                const getServices = await db.query("SELECT * from services WHERE id = $1 AND status = $2", [iterator.type_id, enums.is_active.yes]);
                if (getServices.rowCount === 0) {
                    continue
                }
                for (const service of getServices.rows) {
                    data.services.push(service);
                }
            }
            if (parseInt(iterator.wishlist_type) === enums.wishlist_type.branch) {
                const getBranches = await db.query("SELECT * from branches WHERE id = $1 AND status = $2", [iterator.type_id, enums.is_active.yes]);
                if (getBranches.rowCount === 0) {
                    continue
                }
                for (const branch of getBranches.rows) {
                    data.branches.push(branch);
                }
            }
        }

        res.json({ success: true, data: data })
    } catch (error) {
        console.log(error)
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
            data: []
        })
    }
})



router.get("/customerprofile", check("user_id").isInt(), async (req, res) => {

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
    }

    try {
        const user_id = 1;

        const getUserDetails = await db.query("SELECT name,email,phone_number from users WHERE id = $1;", [user_id]);

        if (getUserDetails.rowCount === 0) {
            return res.status(404).json({
                success: true,
                message: "No User Found",
                data: []
            })
        }

        res.json({ success: true, data: getUserDetails.rows });
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal Server Error", data: [] })
    }

});

router.post("/customerprofile", check("user_id").isInt(), async (req, res) => {

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
    }

    try {
        const user_id = 1;

        const getUserDetails = await db.query("SELECT name,email,phone_number from users WHERE id = $1;", [user_id]);

        if (getUserDetails.rowCount === 0) {
            return res.status(404).json({
                success: true,
                message: "No User Found",
                data: []
            })
        }

        res.json({ success: true, data: getUserDetails.rows });
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal Server Error", data: [] })
    }

});

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