import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import axios from "axios";
import bcrypt from "bcrypt";


export const app = express();
const router = express.Router();

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


router.post("/register",async (req,res)=>{
    try {
        // GET SALON DATA FROM REQUEST
        const salon_name = req.body.salon_name;
        const email = req.body.email;
        const password = req.body.password;
        const contact_number = req.body.contact_number;
        var isSuccess=false;
        

        // CHECK EMAIL AND MOBILE NUMBER EXISTENCE
        const checkEmailExistence = await db.query("SELECT * FROM salon WHERE email = $1",[email]);
        const checkMobileExistence = await db.query("SELECT * FROM salon WHERE contact_number = $1",[contact_number]);
            
        // IF EXISTS RETURN ERROR WITH MESSAGE
        if(checkEmailExistence.rows.length>0){
            const user = checkEmailExistence.rows[0];
            if(user.email == email){
                res.send({
                    isSuccess:isSuccess,
                    message:"Salon with this email is already registered, please login..."});
            }
        }
        else if(checkMobileExistence.rows.length>0){
            const user = checkMobileExistence.rows[0];
            if(user.contact_number == contact_number){
                res.send({
                    isSuccess:isSuccess,
                    message:"Salon with this phone number is already registered, please login..."});
            } 
        }

        // ELSE HASH PASSWORD AND INSERT INTO THE DATABASE
        else{
            bcrypt.hash(password,saltRounds,async (err,hash)=>{
            var isSuccess = false;
            if(err){
                    console.log("Error hashing password",err);
                    res.send({
                        message:err,
                        error:"Error in making request"})
            }else{
                    try {
                        const result = await db.query("INSERT INTO salon (salon_name,email,password,contact_number) VALUES ($1,$2,$3,$4) returning *",[salon_name,email,hash,contact_number]);
                        if(result.rows.length>0){
                            isSuccess = true;
                        }
                        else{
                            isSuccess=false;
                        }
                        res.send({
                            isSuccess:isSuccess,
                            data:result.rows[0]
                        });
                    } catch (error) {
                        res.send({
                            message:error,
                            error:"Error in making request"})
                    }
                    
                }
            })
        }
    } catch (error) {
        res.send({
            message:error,
            error:"Error in making request"})
    }
})

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

router.get("/getallsalonsatlocation",async (req,res)=>{
    const locationId = parseInt(req.query.locationId);
    try {
        const result = await db.query("SELECT * from salon where location=$1",[locationId]);
        if(result.rowCount > 0){
            res.send(result.rows);
        }else{
            res.send({message:"No salon found at selected location"});
        }
    } catch (error) {
    console.log(error)    
    }
})

router.get("/getsalonwithid",async (req,res)=>{
    var id = parseInt(req.query.salonId);
    try {
        const result = await db.query("SELECT * from salon where salon_id=$1",[id]);
        if(result.rowCount > 0){
            const data = {
                salon_name:result.rows[0].salon_name,
                location:result.rows[0].location,
                contact_number:result.rows[0].contact_number,
                description:result.rows[0].description,
                is_active:result.rows[0].is_active,
                email:result.rows[0].email,
                salon_id:result.rows[0].salon_id,
            }
            res.send(data);
        }else{
            res.send({message:"No Salon Found"});
        }
    } catch (error) {
    console.log(error)    
    }
});

router.get("/getemployeewithid",(req,res)=>{
    var id = parseInt(req.query.id)-1;
    res.send(employees[id]);
})



router.get("/getsalonemployees",(req,res)=>{
    try {
        const salon_id = req.body.salon_id;

            try {
                const result = db.query("SELECT * from salon_employee WHERE salon_id = $1 ", [salon_id]);
                if(result.rowCount>0){
                    const employees = result.rows;
                    res.send(employees);
                }
                else{
                    res.send({message:"No employees found !"})
                }

            } catch (error) {
                res.send({message:error})
            }

    } catch (error) {
        res.send({message:error})
    }
})

export default router;