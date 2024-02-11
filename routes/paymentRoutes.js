import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import axios from "axios";
import bcrypt from "bcrypt";

const router = express.Router();
const saltRounds = 10;
export const app = express();
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


router.get("/initializepayment",async (req,res)=>{

})


router.get("/getallpayments",async (req,res)=>{
    try {
        const result = await db.query("SELECT * from payments");
        res.send(result.rows);
    } catch (error) {
    console.log(error)    
    }
})

router.get("/getpaymentwithid",async (req,res)=>{
    var id = parseInt(req.query.id);
    try {
        const result = await db.query("SELECT * from payments where id=$1",[id]);
        res.send(result.rows);
    } catch (error) {
    console.log(error)    
    }
})

export default router;