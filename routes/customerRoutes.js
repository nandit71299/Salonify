import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import axios from "axios";
import bcrypt from "bcrypt";
// import customerRoutes from "./routes/customerRoutes.js"


export const app = express();
const port = 3000;
const saltRounds = 10;

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

router.post("/register",async (req,res)=>{
    try {
        // DATA TO BE CAPTURED FROM THE REQUEST
        const fName = req.body.fName;
        const lName = req.body.lName;
        const email = req.body.email;
        const password = req.body.password;
        const mobile = req.body.mobile;
        const dob = req.body.dob;
        const ip = req.socket.remoteAddress;
        var isSuccess = false;


        //CHECK EXISTENCE OF MOBILE AND EMAIL IN DATABASE, IF EXISTS RETURN ERROR MESSAGE
        const checkEmailExistence = await db.query("SELECT * FROM customer WHERE email = $1 AND is_active = true",[email]);
        const checkMobileExistence = await db.query("SELECT * FROM customer WHERE phone_number = $1 AND is_active = true",[mobile]);
            
        if(checkEmailExistence.rows.length>0){
            const user = checkEmailExistence.rows[0];
            if(user.email == email){
                res.send(
                    {isSuccess:isSuccess,
                    message:"User with this email is already registered, please login..."});
            }
        }
        else if(checkMobileExistence.rows.length>0){
            const user = checkMobileExistence.rows[0];
            if(user.phone_number == mobile){
                res.send({
                    isSuccess:isSuccess,
                    message:"User with this phone number is already registered, please login..."});
            } 
        }

        // ELSE INSERT NEW CUSTOMER AND RETURN CUSTOMER ID
        else{
            bcrypt.hash(password,saltRounds,async (err,hash)=>{
            if(err){
                    console.log("Error hashing password",err);
                    res.send("Error in making request, contact administrator");
            }else{
                    try {
                        const result = await db.query("INSERT INTO customer (first_name,last_name,email,password,phone_number,date_of_birth,last_login_ip) VALUES ($1,$2,$3,$4,$5,$6,$7) returning *",[fName,lName,email,hash,mobile,dob,ip]);
                        if(result.rows.length>0){
                            isSuccess = true;
                        }
                        else{
                            isSuccess=false;
                        }
                        res.status(200).send({
                            isSuccess:isSuccess,
                            data:result.rows[0].customer_id
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
})


router.post("/login",async (req,res)=>{
    const email = req.body.email;
    const password = req.body.password;
    var isSuccess=false;

    try {
        // CHECK IF USER EMAIL EXISTS IN THE DATABASE
        const result = await db.query(`SELECT * FROM "customer" where "email" = $1`,[email]);
        
        // IF EXISTS COMPARE PASSWORD
        if(result.rowCount>0){
            const user = result.rows[0];
        try {
            bcrypt.compare(password,user.password,async (err,result)=>{
                if(err){
                    res.send(err)
                }else{
                    // IF PASSWORD MATCHES RETURN CUSTOMER DATA AND UPDATE LAST LOGIN TIMESTAMP AND IP ADDRESS
                    if(result){
                    isSuccess=true;
                    const result = await db.query("UPDATE customer SET last_login_ip = $1,  last_login_timestamp = now()  WHERE customer_id = $2 returning *",[req.socket.remoteAddress,user.customer_id])
                    res.send({
                        isSuccess:isSuccess,
                        data:result.rows[0] 
                    })}else{
                        res.send({
                        isSuccess:isSuccess,})
                    }
                }
            })
        } catch (error) {
            res.send({
                message:error,
                error:"Error in making request"})
        }}
        // IF USER NOT FOUND RETURN ERROR
        else{
            res.send({
                isSuccess:isSuccess,
                message:"No user found with the given email address."
            })
        }
      } catch (error) {
        res.send({
            message:error,
            error:"Error in making request"})
      }
})

router.get("/getcustomerwithid",async (req,res)=>{
    var id = parseInt(req.query.id);
    try {
        const result = await db.query("SELECT * from customer where customer_id=$1",[id]);
        if(result.rowCount > 0){
            const data = {
                first_name:result.rows[0].first_name,
                last_name:result.rows[0].last_name,
                phone_number:result.rows[0].phone_number,
                description:result.rows[0].description,
                is_active:result.rows[0].is_active,
                email:result.rows[0].email,
                customer_id:result.rows[0].customer_id,
            }
            res.send(data);
        }else{
            res.send({message:"No customer found with given ID"});
        }
    } catch (error) {
    console.log(error)    
    }
})




export default router;