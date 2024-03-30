import express from "express";
import bodyParser from "body-parser";
import db from "../db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import authMiddleware from '../middleware/authMiddleware.js';
import { check, body, validationResult } from 'express-validator';
import nodemailer from "nodemailer";
import moment from "moment";
import dotenv from "dotenv";
import * as enums from "../enums.js"
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';

const router = express.Router();
const saltRounds = Number(process.env.saltrounds);

router.get("/testsalonownerroute",(req,res)=>{
    res.send("Test Succesfull");
})

router.post("/registersalon",
    check("email").trim().isEmail(),
    check("password").trim().isLength({min:6}),
    check("personalName").trim().isString(),
    check("personalPhone").trim().isMobilePhone(),
    check("dob").trim().isDate(),
    check("salon_name").trim().isAlphanumeric(),
    check("contact_number").trim().isNumeric(),
    check("salonDescription").trim().isString(),
    check("location").trim().isAlphanumeric(),
    check("address").trim().isString(),
    check("type").trim().isNumeric(),
    check("seats").trim().isNumeric(),
    async (req,res)=>{

        const errors = validationResult(req);
        if(!errors.isEmpty()){
            res.send(errors);
        }
        else{
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
        try {
            const checkEmailExistence = await db.query("SELECT email FROM users WHERE email = $1",[email]);
            const checkPhoneExistence = await db.query("SELECT phone_number FROM users WHERE phone_number = $1",[personalPhone]);
            if (checkPhoneExistence.rowCount>0) {
                res.send({success:false,message:"A user is already registered with this phone number"});
            } else {
                if(checkEmailExistence.rowCount>0){
                    res.send({success:false,message:"A user is already registered with this email address."});
                }
            else{
                bcrypt.hash(password, saltRounds, async (err, hash) => {
                    if (err) {
                        console.log("Error hashing password", err);
                        res.send({success:false,message:"Error in making request, contact administrator"});
                    }else{
             
                    try {
                        await db.query("BEGIN");
                        const registerUser = await db.query("INSERT INTO users (email,password,name,phone_number,dob,user_type) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id;",[email,hash,personalName,personalPhone,dob,enums.UserType.salon_admin]);
                        const registerSalon = await db.query("INSERT INTO saloon (user_id,saloon_name,contact_number,description) VALUES ($1,$2,$3,$4) RETURNING id;",[registerUser.rows[0].id,salon_name,contact_number,salonDescription]);
                        const registerBranch = await db.query("INSERT INTO branches (saloon_id,name,city_id,address,type,latitude,seats,longitude) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",[registerSalon.rows[0].id,name,city_id,address,salon_type,latitude,seats,longitude]);
                        await db.query("COMMIT");
                        res.send({
                            success:true,
                            message:"Salon registered succesfully."
                        });
                    } catch (error) {
                        await db.query("ROLLBACK");
                        res.send({error:error,message:"Could not complete the request." })
                    };
                }
                });


            }
            }
        } catch (error) {
            
        }
    }

    

});


//TODO modify login route with new database schema

router.post("/login",async (req,res)=>{
    const email = req.body.email;
    const password = req.body.password;
    var isSuccess=false;

    // CHECK EXISTENCE OF THE SALON IN DATABASE WITH EMAIL
    try {
        const result = await db.query(`SELECT * FROM "salon" where "email" = $1`,[email]);
        
        if(result.rowCount>0){
            const user = result.rows[0];
            try {
            bcrypt.compare(password,user.password,async (err,result)=>{
                if(err){
                    res.send(err)
                }else{
                    if(result){
                    isSuccess=true;
                    const result = await db.query("UPDATE salon SET last_login_ip = $1,  last_login_timestamp = now()  WHERE salon_id = $2 returning *",[req.socket.remoteAddress,user.salon_id])
                    const token = jwt.sign({ user }, SecretKey , { expiresIn: '1h' });
                    
                    res.send({
                        isSuccess:isSuccess,
                        data:result.rows[0],
                        token:token
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
        }
    }else{
        res.send({message:"No such email addreess found."})
    }
      } catch (error) {
        res.send({
            message:error,
            error:"Error in making request"})
      }
})


router.get("/initializepayment",authMiddleware,async (req,res)=>{
    res.send("You are in")
    })

    
export default router;


