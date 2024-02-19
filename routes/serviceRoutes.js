import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import axios from "axios";
import bcrypt from "bcrypt";
import { check, body, validationResult } from 'express-validator';
import dotenv from "dotenv";
import authMiddleware from '.././middleware/authMiddleware.js';


dotenv.config();

export const app = express();
const port = process.env.port;

app.use(bodyParser.urlencoded({extended: true,}));


export const db =  new pg.Client({
    database : "salon",
    user : "postgres",
    password:"root",
    host:"localhost",
    port:5432
  })
  
  db.connect();
  


const router = express.Router();

router.get("/checking",(req,res)=>{
    console.log("helloWorld")
})

// Define API endpoint to get services offered by a salon
router.get('/getSalonServices',authMiddleware,check("salonId").isNumeric(), async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        // If there are validation errors, render the form again with errors
        res.send({ errors: errors.array() });
      }else{
    try {
        const { salonId } = req.query;
        // Query to fetch services offered by the specified salon
        const result = await db.query(`
            SELECT s.service_id, s.service_name,s.price,s.duration,s.is_active, v.variant_id, v.name AS variant_name, v.price AS variant_price
            FROM public.service s
            LEFT JOIN public.service_variant v ON s.service_id = v.service_id
            WHERE s.salon_id = $1
            ORDER BY s.service_id, v.variant_id;
        `,[salonId]);

        const rows =result.rows;
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
                    service_price:row.price,
                    service_duration:row.duration,
                    is_active:row.is_active,
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
    }}
});

export default router;
