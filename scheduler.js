import moment from 'moment';
import db from './database.js';
import * as enums from "./enums.js"


async function updateExpiredAppointmentsStatus() {
    try {
        const currentTime = moment();
        const sixHoursAgo = moment().subtract(6, 'hours');

        // Query appointments from the database where appointment date and start time
        // is less than six hours ago and status is not already 5 (assuming 5 is the status for expired appointments)
        const expiredAppointments = await db.query("SELECT * FROM appointment WHERE appointment_date < $1 AND status <> $2 AND status = $3", [sixHoursAgo.format('YYYY-MM-DD HH:mm'), enums.appointmentType.NoShow, enums.appointmentType.Confirmed]);

        // Update status of expired appointments
        for (const appointment of expiredAppointments.rows) {
            // Update the status of the appointment to 5 (or whatever status you use for expired appointments)
            await db.query("UPDATE appointment SET status = $1 WHERE id = $2", [enums.appointmentType.NoShow, appointment.id]);
        }

        console.log("Expired appointments updated successfully.");
    } catch (error) {
        console.error("Error updating expired appointments:", error);
    }
}

// Call the function periodically or as needed
setInterval(updateExpiredAppointmentsStatus, 9000); // Runs every 15 minutes (900000 milliseconds)

export { updateExpiredAppointmentsStatus };