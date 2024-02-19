import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import axios from "axios";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import authMiddleware from '.././middleware/authMiddleware.js';
import { check, body, validationResult } from 'express-validator';
import nodemailer from "nodemailer";
import moment from "moment";
import dotenv from "dotenv";

dotenv.config();

const SecretKey = process.env.SecretKey;
export const app = express();
const saltRounds = process.env.saltrounds;

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

const transpoter = nodemailer.createTransport({
    host:"smtp.gmail.com",
    port:465,
    secure:true,
    auth:{
        user:"nanditsareria@gmail.com",
        pass:"yefq hjde ubld xafq"
    }
})

router.post("/register",
check("fName").not().isEmpty().isString(),
check("lName").not().isEmpty().isString(),
check("email").isEmail(),
check("password").isLength({min:6}),
check("mobile").isMobilePhone(),
check("dob").isDate(),
async (req,res)=>{
    const errors = validationResult(req)
    if(!errors.isEmpty()){
        res.send(errors);
    }else{

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
                            id:result.rows[0].customer_id
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
})

router.post("/login",
check("email").isEmail(),
check("password").not().isEmpty(),async (req,res)=>{

const errors = validationResult(req);
if(!errors.isEmpty()){
    res.send(errors);
}else{
    
    try {
        const email = req.body.email;
        const password = req.body.password;
        var isSuccess=false;
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
                    const token = jwt.sign({ user }, SecretKey , { expiresIn: '1h' });
                    res.send({
                        isSuccess:isSuccess,
                        data:result.rows[0],
                        token
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
}
})
    
router.get("/getcustomerwithid",
check("id").isNumeric(),authMiddleware,
async (req,res)=>{
    const errors = validationResult(req)
    if(!errors.isEmpty()){
        res.send(errors);
    }else{
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
    }}
})

router.post("/forgetPassword",
check("email").isEmail(),
async(req,res)=>{

    // IF VALIDATION ERRORS RETURN ERRORS
    const errors = validationResult(req);
    if(!errors.isEmpty()){
        res.send(errors);
    }
    else{
        // ELSE TRY FINDING CUSTOMER WITH THE PROVIDED EMAIL
       try {
        const email = req.body.email;
        const findCustomer = await db.query(`SELECT * FROM "customer" where "email" = $1`,[email]);
        // IF CONDITION TO CHECK IF CUSTOMER WITH GIVEN MAIL IS FOUND
        if(findCustomer.rowCount>0){
            const OTP = Math.floor(Math.random().toPrecision()*100000);
            const customer_id = findCustomer.rows[0].customer_id;
            try{
            // IF FOUND UPDATE OTP,VALIDITY AND TIMESTAMP IN THE DATABASE
            const result = await db.query("UPDATE customer SET reset_OTP=$1, reset_otp_validity=20, reset_password_timestamp = now() WHERE customer_id =$2 RETURNING *",[OTP,customer_id])
            //SEND OTP MAIL TO THE CUSTOMER
            const info = await transpoter.sendMail({
                from: "Salonify", // sender address
                to: email, // reciever address
                subject: "Salonify: OTP to Reset your password", // Subject
                // text: "Hello world?", // plain text body
                html: "Hello, " + email + "<br>" + "Please use below mentioned OTP to reset your password. <br> <h1>"+OTP+"</h1>", // html body
            });
            res.send("OTP Sent to Registered mail address")}
            catch(error){
                res.send(error);
            }
        }else{
            res.send("OTP sent to Registered mail address.")
        }
       } catch (error) {
        res.send(errors);
       }
    }
})

router.post("/verifyOTP",
check("email").isEmail(),check("otp").isNumeric(),
async (req,res)=>{
    //CHECK FOR VALIDATION ERRORS
    const errors = validationResult(req);
    //IF VALIDATION ERRORS FOUND, RETURN ERROR
    if(!errors.isEmpty()){
        res.send(errors);
    }
    //ELSE TRY FINDING THE CUSTOMER WITH THE PROVIDED EMAIL
    else{
        try{
            const email = req.body.email;
            const otp = parseInt(req.body.otp);
            const result = await db.query("SELECT reset_otp,reset_otp_validity,reset_password_timestamp FROM customer WHERE email = $1",[email])
            // IF CUSTOMER WITH THE PROVIDED EMAIL IS FOUND DO FOLLOWING,
            const otp_timeout = moment(result.rows[0].reset_password_timestamp).add(20,'m').toDate();
            let current_time = moment().toISOString();
            current_time = moment(current_time).toDate();
            if(result.rowCount>0){
                // TRY FINDING IF OTP IS EXPIRED OR NOT
            if(otp_timeout>current_time){
                // IF NOT EXPIRED, CHECK IF OTP ENTERED MATCHES WITH OTP SENT
                if(otp === parseInt(result.rows[0].reset_otp)){
                    res.send("Succesfully Verified")
                }
                //ELSE SEND WRONG OTP ERROR
                else{
                    res.send("Invalid OTP")
                }
            // IF CURRENT TIME IS BIGGER THAN OTP TIMEOUT
            }else{
                res.send("OTP EXPIRED" )
            }
            //ELSE SEND ERROR
            }else{
                res.send("Opps. Error verifying OTP");
            }

        }
        catch(error){
            res.send(error)
        }
    }
    

})

export default router;