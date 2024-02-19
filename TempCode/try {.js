try {
      function isDateValid(dateStr) {
        return !isNaN(new Date(dateStr));
      }
      
      const {appointmentDate,employeeId} = req.body;
      console.log(typeof(parseInt(employeeId)))
      if(isDateValid(appointmentDate)   && typeof(employeeId)=="number"){
      const formatedDate = new Date(appointmentDate);
      const month   = formatedDate.getUTCMonth() + 1; // months from 1-12
      const day     = formatedDate.getUTCDate();
      const year    = formatedDate.getUTCFullYear();

      const newAppointmentDate = year + "/" + month + "/" + day;
      const result = await db.query("SELECT * from appointment WHERE employee_id=$1 AND appointment_date =$2",[employeeId,newAppointmentDate]);
      res.send({
        data:result.rows
      })
    }
    else{
      res.send("Enter proper details")
    }
    } catch (error) {
    console.log(error)    
    }