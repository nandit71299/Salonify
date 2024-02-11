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

router.post("/createappointment",async (req,res)=>{


    function addMinutes(date, minutes) {
        date.setMinutes(date.getMinutes() + minutes);
      
        return date;
      }

      function getSecondsDouble(dt) {
        const seconds = dt.getSeconds();
        // Convert the seconds to a string.
        const secondsString = seconds.toString();
        // Add a leading zero if the seconds are less than 10.
        const paddedSecondsString = secondsString.padStart(2, '0');
        // Return the padded seconds string.
        return paddedSecondsString;
      }
      // Request Body
      const {service_id,time,appointment_date,employee_id} = req.body;

      // GetService Duration From Database
      const getServiceDuration = await db.query("select duration from service where service_id = $1", [service_id]);
      const serviceDuration = getServiceDuration.rows[0].duration;

      const appointmentStartTime = new Date(appointment_date + " " + time);
      console.log(appointmentStartTime,"appointmentStartTime");
      
      const appointmentEndTime = addMinutes(appointmentStartTime,serviceDuration);
      console.log(appointmentEndTime,"appointmentEndTime");

      // Get Booked Appointments From Database
      const getAllAppointments = await db.query("SELECT start_time,end_time FROM appointment WHERE employee_id = $1",[employee_id])
      const appointments = getAllAppointments.rows
      
      const newStartTime = time;
      const newEndTime = appointmentEndTime.getHours() + ":" + appointmentEndTime.getMinutes()+  ":" + getSecondsDouble(appointmentEndTime);
      console.log(newEndTime);
      const appointmentDate = appointment_date;
    
      
      // Check if appointment time is available or not, if available return false, if not return true.      
      const isOverlapping = appointments.some(appt => {
        const apptStart = new Date(appointmentDate + " " + appt.start_time);
        const apptEnd = new Date(appointmentDate + " " + appt.end_time);
      
        const newStart = new Date(appointmentDate + " "+ newStartTime);
        const newEnd = new Date(appointmentDate + " "+ newEndTime);
      
        return (
          (newStart >= apptStart && newStart < apptEnd) ||
          (newEnd > apptStart && newEnd <= apptEnd) ||
          (newStart <= apptStart && newEnd >= apptEnd)
        );
      });
      
      console.log(isOverlapping); // true or false
      
      res.send(isOverlapping)


});

router.get("/getallappointments",async (req,res)=>{
    try {
        const result = await db.query("SELECT * from appointment");
        res.send(result.rows);
    } catch (error) {
    console.log(error)    
    }
});

router.get("/getappointmentwithid",async (req,res)=>{
    var id = parseInt(req.query.id);
    try {
        const result = await db.query("SELECT * from apppointment where id=$1",[id]);
        res.send(result.rows);
    } catch (error) {
    console.log(error)    
    }
})

export default router;