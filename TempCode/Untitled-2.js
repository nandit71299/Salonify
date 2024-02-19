//     const { customer_id, service_id , appointmentDate, appointmentTime, paymentMethod , salon_id, status} = req.body;
//   try {
//     // Validate appointment details and selected services
//     const appointmentDateTime = new Date(`${appointmentDate} ${appointmentTime}`);
//     console.log(appointmentDateTime)
//     const currentDateTime = new Date();

//     if (appointmentDateTime <= currentDateTime) {
//          res.status(400).json({ error: 'Appointment date and time must be in the future' });
//     }

//     // Insert appointment details into the database
//     if (paymentMethod === "CASH") {
        
//         const result = await db.query('INSERT INTO appointment (customer_id,salon_id, appointment_date, appointment_time, payment_method,status) VALUES ($1, $2, $3, $4,$5,$6) RETURNING appointment_id',[customer_id,salon_id,appointmentDate,appointmentTime,paymentMethod,status]);
    
//         const appointmentId = result.rows[0].appointment_id;
    
//         // Insert selected services into the appointment_services table
//         service_id.forEach(async (element) => {
//             const insertServiceQuery = 'INSERT INTO appointment_services (appointment_id, service_id) VALUES ($1, $2)';
//             await db.query(insertServiceQuery, [appointmentId, element])});
        
    
//         // // Process payment based on payment method
//         // if (paymentMethod === 'cash') {
//         //   // If payment method is cash, mark the appointment as paid
//         //   await markappointmentAsPaid(appointmentId);
//         // } else if (paymentMethod === 'online') {
//         //   // If payment method is online, initiate online payment process (e.g., integrate with a payment gateway)
//         //   // Once payment is successful, mark the appointment as paid
//         // }
    
//         // Respond with success message or appointment ID
//         res.status(201).json({ message: 'Appointment booked successfully', appointmentId });
//     } else {
//         res.status(200).json({ message: 'We are not taking online payments currently...' });
//     }
//   } catch (error) {
//     console.error('Error appointment appointment:', error);
//     res.status(500).json({ error: 'An error occurred while appointment appointment' });
//   }
