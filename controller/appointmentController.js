const { User, Saloon, Branch, BranchHour, sequelize } = require('../models');

module.exports = {
    async branchvacancy(req, res) {
        try {
            const branch_id = req.body.branch_id;
            const formatedAppointmentDate = moment(req.body.appointment_date, 'YYYY/MM/DD').format("YYYY-MM-DD");
            const weekdayName = moment(formatedAppointmentDate).format('dddd').toLowerCase();

            const getBranchHours = await BranchHour.findOne({ where: { branch_id: branch_id, day: weekdayName } });
            return console.log(getBranchHours);

            // const getBranchHours = await db.query("SELECT start_time, end_time FROM branch_hours WHERE branch_id = $1 AND day =$2 ", [branch_id, weekdayName]);
            if (getBranchHours.rows.length === 0) {
                return res.status(409).json({
                    success: false,
                    message: "Branch is closed on the selected day.",
                    data: []
                });
            }

            let branchStartTime = moment(getBranchHours.rows[0].start_time, 'HH:mm').add(30, 'minutes').format('HH.mm');
            let branchEndTime = moment(getBranchHours.rows[0].end_time, 'HH:mm').subtract(30, 'minutes').format('HH:mm');

            const getHolidayHours = await db.query("SELECT * FROM holiday_hours WHERE branch_id = $1 AND $2 >= from_date AND $2 <= to_date AND status = 1", [branch_id, formatedAppointmentDate]);
            let isHoliday = false;
            let holidayEndTime = null;
            if (getHolidayHours.rows.length > 0) {
                const holidayHours = getHolidayHours.rows;
                for (const holiday of holidayHours) {
                    const fromDateTime = moment(holiday.from_date);
                    const toDateTime = moment(holiday.to_date);
                    if (moment(formatedAppointmentDate).isBetween(fromDateTime, toDateTime, null, '[]')) {
                        isHoliday = true;
                        holidayEndTime = toDateTime.format('HH:mm');
                        break;
                    }
                }
            }

            if (isHoliday) {
                // Set branch start time to holiday end time
                branchStartTime = holidayEndTime;
            }

            let getServiceTotalDuration = 0;

            for (const element of req.body.services) {
                const service_id = element.service_id;
                const getServiceDuration = await db.query("select duration,services_options.id as id,services.branch_id from services_options join services on services_options.service_id = services.id WHERE branch_id = $1 AND services.status = $2 AND services_options.id = $3", [branch_id, enums.is_active.yes, service_id]);
                if (getServiceDuration.rowCount === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "Could'nt find one or more services.",
                        data: []
                    })
                    break;
                }
                const serviceDuration = parseInt(getServiceDuration.rows[0].duration);
                getServiceTotalDuration += serviceDuration;
            }

            // Define slot interval (e.g., duration of the longest service)
            const slotInterval = getServiceTotalDuration + 15; // You can adjust this according to your requirements

            // Initialize array to store slots
            const slots = [];

            // Generate slots until the adjusted branch end time
            let currentSlotStartTime = moment(branchStartTime, 'HH:mm'); // Start from the adjusted start time
            while (currentSlotStartTime.isSameOrBefore(moment(branchEndTime, 'HH:mm'))) {
                const slotEndTime = currentSlotStartTime.clone().add(slotInterval, 'minutes');
                slots.push({
                    start_time: currentSlotStartTime.format('HH:mm'),
                    end_time: slotEndTime.format('HH:mm')
                });
                currentSlotStartTime.add(slotInterval, 'minutes');
            }

            const getSalonSeats = await db.query("SELECT seats FROM branches where id=$1", [branch_id]);
            const seats = getSalonSeats.rows[0].seats;

            // Initialize a set to store unique slot timings
            let availableSlots = new Set();
            let unavailableSlots = new Set();
            for (let i = 1; i <= seats; i++) {
                const seatNo = i;
                const appointments = await db.query("SELECT start_time, end_time FROM appointment WHERE branch_id = $1 AND seat_number = $2 AND appointment_date = $3", [branch_id, seatNo, formatedAppointmentDate]);

                // Check each slot against existing appointments
                for (const slot of slots) {
                    let isAvailable = true;
                    for (const appointment of appointments.rows) {
                        // Check if slot overlaps with any existing appointment
                        if (
                            (moment(slot.start_time, 'HH:mm').isSameOrAfter(moment(appointment.start_time, 'HH:mm')) && moment(slot.start_time, 'HH:mm').isSameOrBefore(moment(appointment.end_time, 'HH:mm'))) ||
                            (moment(slot.end_time, 'HH:mm').isSameOrAfter(moment(appointment.start_time, 'HH:mm')) && moment(slot.end_time, 'HH:mm').isSameOrBefore(moment(appointment.end_time, 'HH:mm'))) ||
                            (moment(slot.start_time, 'HH:mm').isSameOrBefore(moment(appointment.start_time, 'HH:mm')) && moment(slot.end_time, 'HH:mm').isSameOrAfter(moment(appointment.end_time, 'HH:mm')))
                        ) {
                            isAvailable = false;
                            break;
                        }
                    }
                    if (isAvailable) {
                        // Add the slot to the set if it's available
                        availableSlots.add(JSON.stringify(slot));
                    } else {
                        unavailableSlots.add(JSON.stringify(slot));
                    }
                }
            }

            // Convert unique slots back to array format
            availableSlots = Array.from(availableSlots).map(slot => JSON.parse(slot));
            unavailableSlots = Array.from(unavailableSlots).map(slot => JSON.parse(slot));

            // Return available and unavailable slots
            return res.json({
                success: true,
                message: "Appointment slots generated successfully.",
                data: [{
                    available_slots: availableSlots,
                    unavailable_slots: unavailableSlots
                }]
            });
        } catch (error) {
            console.error("Error generating appointment slots:", error);
            return res.status(500).json({
                success: false,
                message: "Internal Server Error",
                data: []
            });
        }
    }
}
