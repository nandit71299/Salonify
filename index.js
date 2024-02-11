import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import axios from "axios";
import bcrypt from "bcrypt";
import customerRoutes from "./routes/customerRoutes.js"
import salonRoutes from "./routes/salonRoutes.js"
import appointmentRoutes from "./routes/appointmentRoutes.js";

export const app = express();
const port = 3000;
const saltRounds = 10;

app.use(bodyParser.urlencoded({extended: true,}));

// DATABASE CONNECTION
export const db =  new pg.Client({
  database : "salon",
  user : "postgres",
  password:"root",
  host:"localhost",
  port:5432
})

db.connect();

// Index Route
app.get('/', (req, res) => {
    res.render('index.ejs');
});

app.get("/api/getalllocations",async (req,res)=>{
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










// app.get("/getallratings",(req,res)=>{
//     var id = parseInt(req.query.id)-1;
//     res.send(payments[id])    
// })

app.listen(port,()=>
    console.log("Server is running on port" + port )
)