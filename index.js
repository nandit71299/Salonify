import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import axios from "axios";
import bcrypt from "bcrypt";
import customerRoutes from "./routes/customerRoutes.js"
import salonRoutes from "./routes/salonRoutes.js"
import paymentRoutes from "./routes/paymentRoutes.js"
import appointmentRoutes from "./routes/appointmentRoutes.js";
import serviceRoutes from "./routes/serviceRoutes.js";
import jwt from "jsonwebtoken";
import authMiddleware from './middleware/authMiddleware.js';
import dotenv from "dotenv";


dotenv.config();
export const app = express();
const port = process.env.port;



app.use(bodyParser.urlencoded({extended: true,}));

// DATABASE CONNECTION
export const db =  new pg.Client({
  database : process.env.database,
  user : process.env.dbuser,
  password:process.env.dbpassword,
  host:process.env.dbhost,
  port:process.env.dbport,
})


db.connect();

// Index Route
app.get("/",(req,res)=>{
res.render("index.ejs")
})
app.get("/api/getalllocations",authMiddleware,async (req,res)=>{
    try {
        const result = await db.query("SELECT * from all_cities");
        res.send(result.rows);
    } catch (error) {
        res.send(error)
    }
})

app.use('/api/customer', customerRoutes);

app.use('/api/salons', salonRoutes);

app.use('/api/appointment',appointmentRoutes);

app.use('/api/payment',paymentRoutes);

app.use('/api/services',serviceRoutes);










// app.get("/getallratings",(req,res)=>{
//     var id = parseInt(req.query.id)-1;
//     res.send(payments[id])    
// })

app.listen(port,()=>
    console.log("Server is running on port" + port )
)