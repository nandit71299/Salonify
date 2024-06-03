const { User, Saloon, Branch, BranchHour, HolidayHour, Services, ServiceOptions, Appointment, PlatformCoupon, PlatformCouponBranch, BranchCoupon, AppointmentItems, AppointmentDiscount, Payments, sequelize } = require('../models');
const moment = require('moment')
const { Op, fn, col } = require('sequelize');
const enums = require('../enums')
const logger = require('../config/logger')
moment.tz("Asia/Kolkata");



module.exports = {
    async branchvacancy(req, res) {
        const { branch_id, appointment_date, services } = req.body;

        if (!branch_id || !appointment_date || !Array.isArray(services) || services.length === 0) {
            return res.status(400).json({ success: false, message: "Missing required parameters." });
        }

        const formatedAppointmentDate = moment(appointment_date, 'YYYY-MM-DD').format("YYYY-MM-DD");
        const weekdayName = moment(formatedAppointmentDate).format('dddd').toLowerCase();

        try {
            const branch = await Branch.findOne({ where: { id: branch_id, status: enums.is_active.yes } });
            if (!branch) {
                return res.status(404).json({ success: false, message: "Salon/Branch not found", data: [] });
            }

            const branchHours = await BranchHour.findOne({ where: { branch_id: branch_id, day: weekdayName, status: enums.is_active.yes } });
            if (!branchHours) {
                return res.status(409).json({ success: false, message: "Branch is closed on the selected day.", data: [] });
            }

            const appointmentDate = moment(formatedAppointmentDate);

            let branchStartTime = appointmentDate.clone().set({
                'hour': moment(branchHours.start_time, 'HH:mm').hours(),
                'minute': moment(branchHours.start_time, 'HH:mm').minutes(),
                'second': 0,
                'millisecond': 0
            }).add(15, 'minutes');

            let branchEndTime = appointmentDate.clone().set({
                'hour': moment(branchHours.end_time, 'HH:mm').hours(),
                'minute': moment(branchHours.end_time, 'HH:mm').minutes(),
                'second': 0,
                'millisecond': 0
            });

            if (moment(formatedAppointmentDate).isSame(moment().startOf('day'))) {
                branchStartTime = moment().startOf('minute').add(30, 'minutes');
                if (branchStartTime.isAfter(branchEndTime)) {
                    return res.status(409).json({ success: false, message: "Branch is already closed for the day.", data: [] });
                }
            }

            const holidayHours = await HolidayHour.findAll({
                where: {
                    branch_id: branch_id,
                    status: enums.is_active.yes,
                    from_date: {
                        [Op.lte]: moment(formatedAppointmentDate).endOf('day').toDate()
                    },
                    to_date: {
                        [Op.gte]: moment(formatedAppointmentDate).startOf('day').toDate()
                    }
                }
            });

            const serviceDurationResult = await getTotalServiceDuration(services, branch_id);
            if (!serviceDurationResult.success) {
                return res.status(404).json(serviceDurationResult);
            }

            const serviceDuration = serviceDurationResult.data; // Total service duration in minutes
            const slotInterval = serviceDuration + 15; // Slot interval in minutes

            const { availableSlots, unavailableSlots } = await generateSlots(branchStartTime, branchEndTime, serviceDuration, slotInterval, holidayHours, branch_id, formatedAppointmentDate);

            return res.json({
                success: true,
                message: "Appointment slots generated successfully.",
                data: [{
                    available_slots: availableSlots,
                    unavailable_slots: unavailableSlots
                }]
            });

        } catch (error) {
            logger.error("Error Generating Slots: ", error);
            return res.status(500).json({ success: false, message: "Internal Server Error.", data: [] });
        }
    },

    async bookAppointment(req, res) {
        const {
            user_id,
            branch_id,
            services,
            platform_coupon_id = 0,
            branch_coupon_id = 0,
            appointment_date,
        } = req.body;
        let start_time = moment(req.body.start_time, "HH:mm").format("HH:mm");
        const formattedAppointmentDate = moment(appointment_date, 'YYYY-MM-DD').format('YYYY-MM-DD');
        const appointmentWeekday = moment(formattedAppointmentDate).format('dddd').toLowerCase();
        const transaction = await sequelize.transaction();

        try {
            // Ensure the branch exists and is active
            const checkBranchExistence = await Branch.findOne({
                where: { id: branch_id, status: enums.is_active.yes }, transaction
            });

            if (!checkBranchExistence) {
                await transaction.rollback();
                return res.status(404).json({
                    success: false,
                    message: "Salon/Branch not found",
                    data: [],
                });
            }

            // Check if services belong to the same branch and services exist
            for (const service of services) {
                const service_id = service;
                const query = await ServiceOptions.findAll({
                    attributes: { include: ['duration', 'id', 'service_id', 'status'] },
                    include: [{
                        model: Services,
                        attributes: ['branch_id'],
                        where: { branch_id: branch_id },
                        required: false
                    }],
                    where: { id: service_id, status: enums.is_active.yes }, transaction
                });

                if (query.length < 1) {
                    await transaction.rollback();
                    return res.status(404).json({
                        success: false,
                        message: `Apologies. It seems like the branch is no longer accepting appointments for one of your services. Please explore other services from this branch or other nearby branches.`,
                        data: []
                    });
                }
            }

            // Check branch hours
            const branchHoursQuery = await BranchHour.findOne({
                attributes: ['start_time', 'end_time', 'status'],
                where: { branch_id: branch_id, day: appointmentWeekday, status: enums.is_active.yes }, transaction
            });

            if (!branchHoursQuery) {
                await transaction.rollback();
                return res.status(409).json({
                    success: false,
                    message: "Salon is not open on the selected appointment day.",
                    data: []
                });
            }

            const storeStartTime = branchHoursQuery.start_time;
            const storeEndTime = branchHoursQuery.end_time;

            const momentStoreStartTime = moment(storeStartTime, 'HH:mm');
            const momentStoreEndTime = moment(storeEndTime, 'HH:mm');

            let endTime = moment(start_time, 'HH:mm');
            for (const serviceId of services) {
                const serviceOptionQuery = await ServiceOptions.findOne({
                    where: { id: serviceId, status: enums.is_active.yes },
                    attributes: ['id', 'duration'],
                    include: [{
                        model: Services,
                        attributes: ['branch_id'],
                        where: { branch_id: branch_id }
                    }], transaction
                });

                if (!serviceOptionQuery) {
                    await transaction.rollback();
                    return res.status(404).json({
                        success: false,
                        message: "Apologies, it seems one of your selected services is currently unavailable. Please explore other services at this branch or similar ones at nearby branches. Thank you for your understanding!",
                        data: []
                    });
                }

                const serviceDuration = serviceOptionQuery.duration;
                endTime.add(serviceDuration, 'minutes');
            }

            endTime = moment(endTime, "HH:mm").subtract(1, "minutes").format('HH:mm');
            const momentAppointmentStartTime = moment(start_time, 'HH:mm');
            const momentAppointmentEndTime = moment(endTime, 'HH:mm');

            if (momentAppointmentStartTime.isBefore(momentStoreStartTime) || momentAppointmentEndTime.isAfter(momentStoreEndTime)) {
                await transaction.rollback();
                return res.status(409).json({
                    success: false,
                    message: "Appointment time is outside of store hours.",
                    data: []
                });
            }

            // Check holiday hours
            const appointmentDateTime = moment(`${appointment_date} ${start_time}`, 'YYYY/MM/DD HH:mm');
            const checkHolidayQuery = await HolidayHour.findAll({
                attributes: ['id', 'from_date', 'to_date'],
                where: {
                    branch_id: branch_id,
                    status: enums.is_active.yes,
                    [Op.or]: [
                        { from_date: { [Op.lte]: appointmentDateTime }, to_date: { [Op.gte]: appointmentDateTime } },
                        { from_date: { [Op.lte]: moment(`${appointment_date} ${endTime}`, 'YYYY/MM/DD HH:mm') }, to_date: { [Op.gte]: moment(`${appointment_date} ${endTime}`, 'YYYY/MM/DD HH:mm') } },
                        {
                            [Op.and]: [
                                { from_date: { [Op.lte]: appointmentDateTime } },
                                { to_date: { [Op.gte]: moment(`${appointment_date} ${endTime}`, 'YYYY/MM/DD HH:mm') } }
                            ]
                        }
                    ]
                }, transaction
            });

            if (checkHolidayQuery.length > 0) {
                await transaction.rollback();
                return res.status(409).json({ success: false, message: "The salon is closed for holiday during the selected appointment date/time." });
            }

            const checkSeatsQuery = await Branch.findOne({ attributes: ['seats'], where: { id: branch_id, status: enums.is_active.yes }, transaction });
            if (!checkSeatsQuery) {
                await transaction.rollback();
                return res.status(404).json({
                    success: false,
                    message: "Apologies, it seems the branch is not accepting appointments right now.",
                    data: []
                });
            }
            const totalSeats = checkSeatsQuery.seats;

            let availableSeat = 0;
            for (let seatNumber = 1; seatNumber <= totalSeats; seatNumber++) {
                const checkAppointmentsQuery = await Appointment.findAll({
                    where: {
                        branch_id: branch_id,
                        seat_number: seatNumber,
                        appointment_date: formattedAppointmentDate,
                        [Op.or]: [
                            { [Op.and]: [{ start_time: { [Op.lte]: start_time } }, { end_time: { [Op.gte]: start_time } }] },
                            { [Op.and]: [{ start_time: { [Op.lte]: endTime } }, { end_time: { [Op.gte]: endTime } }] }
                        ]
                    },
                    attributes: ['id']
                });
                if (checkAppointmentsQuery.length === 0) {
                    availableSeat = seatNumber;
                    break;
                }
            }

            if (availableSeat === 0) {
                await transaction.rollback();
                return res.status(409).json({
                    success: false,
                    message: "No available seats for the given time slot.",
                });
            }

            if (!isNaN(platform_coupon_id) && parseInt(platform_coupon_id) !== 0 && !isNaN(branch_coupon_id) && parseInt(branch_coupon_id) !== 0) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: "Both platform and branch coupons cannot be applied at the same time.",
                    data: []
                });
            }

            let discount_amount = 0;
            let max_advance_amount = 0;
            let advance_percentage = 0;
            let minimum_subtotal = 0;

            // Handle platform coupon discount
            if (!isNaN(platform_coupon_id) && parseInt(platform_coupon_id) !== 0) {
                const checkBranchCoupon = await PlatformCouponBranch.findOne({
                    where: { branch_id: branch_id, platform_coupon_id: platform_coupon_id, status: enums.is_active.yes }, transaction
                });
                if (!checkBranchCoupon) {
                    await transaction.rollback();
                    return res.status(404).json({
                        success: false,
                        message: "Oops! It looks like the coupon is not valid or has expired.",
                        data: [],
                    });
                }

                const checkCoupon = await PlatformCoupon.findOne({
                    attributes: ['amount', 'advance_percentage', 'max_advance_payment'],
                    where: { id: platform_coupon_id, status: enums.is_active.yes }, transaction
                });

                discount_amount = checkCoupon.amount;
                advance_percentage = checkCoupon.advance_percentage;
                max_advance_amount = checkCoupon.max_advance_payment;
            }

            if (!isNaN(branch_coupon_id) && parseInt(branch_coupon_id) !== 0) {
                const couponData = await BranchCoupon.findOne({
                    where: { branch_id: branch_id, id: branch_coupon_id, status: enums.is_active.yes },
                    attributes: ['id', 'max_advance_amount', 'advance_percentage', 'minimum_subtotal', 'start_date', 'end_date', 'amount'], transaction
                });

                if (!couponData) {
                    await transaction.rollback();
                    return res.status(404).json({
                        success: false,
                        message: "Oops! It looks like the coupon is not valid or has expired.",
                        data: [],
                    });
                }
                if (!moment(formattedAppointmentDate).isBetween(moment(couponData.start_date), moment(couponData.end_date), null, '[]')) {
                    await transaction.rollback();
                    return res.status(400).json({
                        success: false,
                        message: "Appointment date is not within the valid period for this coupon.",
                        data: []
                    });
                }

                discount_amount = couponData.amount;
                max_advance_amount = couponData.max_advance_amount;
                advance_percentage = couponData.advance_percentage;
                minimum_subtotal = couponData.minimum_subtotal;
            }


            let finalTotalDiscount = 0;
            let finalTotalTax = 0;
            let finalSubtotal = 0;

            start_time = moment(start_time, 'HH:mm').add(1, 'minutes').format('HH:mm');

            // generateReceiptNumber
            const receipt_number = await generateReceiptNumber();
            const createAppointment = await Appointment.create(
                {
                    user_id: user_id,
                    receipt_number: receipt_number,
                    branch_id: branch_id,
                    appointment_date: appointment_date,
                    subtotal: 0,
                    total_discount: 0,
                    total_tax: 0,
                    net_amount: 0,
                    total_amount_paid: 0,
                    status: enums.appointmentType.Pending_Payment_Confirmation,
                    start_time: start_time,
                    end_time: endTime,
                    seat_number: availableSeat
                },
                { returning: true, transaction },
            );
            const appointment_id = createAppointment.id;
            if (!appointment_id) {
                await transaction.rollback();
                throw new Error("Error Creating Appointment")
            }
            for (const service of services) {
                const getServicePrice = await ServiceOptions.findOne({ attributes: ['price'], where: { id: service } });
                const servicePrice = parseFloat(getServicePrice.price);
                const total_item_discount = discount_amount !== 0 ? parseFloat(servicePrice * (discount_amount / 100)) : 0;
                const total_tax = typeof taxAmount !== 'undefined' && taxAmount !== 0 ? parseFloat(servicePrice * (taxAmount / 100)) : 0;
                const total_price_paid = 0;

                await AppointmentItems.create({
                    appointment_id: appointment_id, service_option_id: service, service_price: servicePrice, total_item_discount, total_tax, total_price_paid
                }, { transaction });

                finalSubtotal += servicePrice;
                finalTotalDiscount += total_item_discount;
                finalTotalTax += total_tax;
            }

            const finalNetAmount = finalSubtotal - finalTotalDiscount + finalTotalTax;
            const [affectedRows, [updateAppointment]] = await Appointment.update(
                {
                    subtotal: finalSubtotal,
                    total_discount: finalTotalDiscount,
                    total_tax: finalTotalTax,
                    net_amount: finalNetAmount,
                },
                {
                    where: { id: appointment_id },
                    returning: true,
                    transaction
                },
            );

            if (affectedRows === 0) {
                throw new Error("Error Updating Appointment");
            }

            if (finalTotalDiscount > 0) {
                await AppointmentDiscount.create({
                    appointment_id: appointment_id,
                    coupon_type: enums.coupon_type.platform_coupon,
                    coupon_id: platform_coupon_id,
                    amount: finalTotalDiscount
                }, { transaction });
            }

            let advance_amount = 0;
            if (branch_coupon_id) {
                if (finalSubtotal < minimum_subtotal) {
                    await transaction.rollback();
                    return res.status(400).json({
                        success: false,
                        message: `Appointment subtotal does not meet the minimum required subtotal for this coupon.`,
                        data: []
                    });
                }

                advance_amount = finalNetAmount * advance_percentage / 100;
                advance_amount = advance_amount > max_advance_amount ? max_advance_amount : advance_amount;
            }
            if (platform_coupon_id) {
                advance_amount = finalNetAmount * advance_percentage / 100;
                advance_amount = advance_amount > max_advance_amount ? max_advance_amount : advance_amount;
            }

            res.json({
                success: true,
                message: "Appointment booked successfully.",
                data: [{
                    appointment: updateAppointment.dataValues,
                    advance_amount: parseFloat(advance_amount).toFixed(2)
                }]
            });

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            logger.error("Error making request:", error);
            res.status(500).json({
                success: false,
                message: "Error making request.",
                data: []
            });
        }
    },

    async getAllAppointments(req, res) {
        const branch_id = req.query.branch_id;
        const whereConditions = {
            branch_id: branch_id,
        };

        // Check for appointment status filter
        if (req.query.appointment_status) {
            whereConditions.status = req.query.appointment_status;
        }

        // Check for payment status filter
        if (req.query.payment_status) {
            if (req.query.payment_status === 'paid') {
                whereConditions.total_amount_paid = {
                    [Op.gte]: sequelize.col('net_amount'),
                };
            } else if (req.query.payment_status === 'unpaid') {
                whereConditions.total_amount_paid = 0;
            } else if (req.query.payment_status === 'partially_paid') {
                whereConditions.total_amount_paid = {
                    [Op.gt]: 0,
                    [Op.lt]: sequelize.col('net_amount'),
                };
            }
        }

        // Check for booking start time filter
        const order = [];
        if (req.query.sort_by === 'earliest_first') {
            order.push(['appointment_date', 'ASC']);
        } else if (req.query.sort_by === 'earliest_last') {
            order.push(['appointment_date', 'DESC']);
        }
        try {
            const appointments = await Appointment.findAll({
                where: whereConditions,
                order: order,
            });

            if (appointments.length === 0) {
                return res.status(404).json({
                    success: true,
                    message: "No Appointments Found",
                    data: []
                });
            }

            // Process and format appointments
            const formattedAppointments = appointments.map(appointment => {
                const {
                    id, user_id, receipt_number, appointment_date, subtotal, total_discount,
                    total_tax, is_rescheduled, start_time, end_time, seat_number, status,
                    total_amount_paid, net_amount
                } = appointment;

                // Determine payment status based on net_amount and total_amount_paid
                let payment_status = "Unpaid";
                if (total_amount_paid >= net_amount) {
                    paymentStatus = "Paid";
                } else if (total_amount_paid > 0) {
                    paymentStatus = "Partially Paid";
                }

                // Map appointment status
                let appointment_status = "No Show";
                switch (status) {
                    case 1:
                        appointment_status = "Pending Payment Confirmation";
                        break;
                    case 2:
                        appointment_status = "Confirmed";
                        break;
                    case 3:
                        appointment_status = "Closed";
                        break;
                    case 4:
                        appointment_status = "Cancelled";
                        break;
                }

                return {
                    id,
                    user_id,
                    receipt_number,
                    appointment_date,
                    subtotal,
                    total_discount,
                    total_tax,
                    net_amount,
                    total_amount_paid,
                    is_rescheduled,
                    start_time,
                    end_time,
                    seat_number,
                    payment_status,
                    appointment_status
                };
            });

            res.json({ success: true, total_appointments: appointments.length, data: { appointments: formattedAppointments }, message: "OK" });
        } catch (error) {
            logger.error("Error fetching appointments:", error);
            res.status(500).json({
                success: false,
                message: "Internal Server Error Occurred",
                data: []
            });
        }
    },

    async getAppointmentDetails(req, res) {
        try {
            // Extract appointment_id and branch_id from request query
            const { appointment_id, branch_id } = req.query;

            // Get appointment details from the database
            const appointment = await Appointment.findOne({
                where: { id: appointment_id, branch_id: branch_id }
            });
            if (!appointment) {
                // If appointment not found, return 404 response
                return res.status(404).json({
                    success: false,
                    message: "Appointment not found.",
                    data: []
                });
            }

            // Get user details associated with the appointment
            const user = await User.findByPk(appointment.user_id);

            // Get service options associated with the appointment
            const appointmentItems = await AppointmentItems.findAll({
                where: { appointment_id: appointment.id },
                include: {
                    model: ServiceOptions,
                    include: {
                        model: Services
                    }
                }
            });

            const services = [];
            let salon_services_amount = 0;
            let platform_fee = 5;
            let discount = 0;
            let gst = 0;
            let total_amount_paid = 0;

            // Iterate through each service option and calculate relevant amounts
            for (const item of appointmentItems) {
                const { service_price, total_item_discount, total_tax, total_price_paid, ServiceOption } = item;
                const { service_id, name } = ServiceOption;
                const serviceName = ServiceOption.Service.name;

                // Calculate amounts for payments info
                salon_services_amount += parseFloat(service_price);
                discount += parseFloat(total_item_discount);
                gst += parseFloat(total_tax);
                total_amount_paid += parseFloat(total_price_paid);

                // Push service details into services array
                services.push({
                    service_id: service_id,
                    service_name: serviceName,
                    service_option_details: [{
                        service_option_id: ServiceOptions.id,
                        service_option_name: name,
                        service_price: service_price,
                    }]
                });
            }

            // Get payments associated with the appointment
            const payments = await Payments.findAll({
                where: { appointment_id: appointment_id }
            });

            const transaction_info = payments.map(payment => ({
                id: payment.id,
                user_id: payment.user_id,
                payment_gateway_transaction_id: payment.payment_gateway_transaction_id,
                payment_method: payment.payment_method,
                payment_date: payment.payment_date,
                amount: payment.amount,
                status: payment.status == 1 ? "Success" : "Failed",
                remarks: payment.remarks
            }));

            // Payments Info
            const payment_info = {
                salon_services_amount: salon_services_amount.toFixed(2),
                platform_fee: platform_fee.toFixed(2), // Hardcoded platform fee for now
                total_item_discount: discount.toFixed(2),
                gst: gst.toFixed(2),
                total_price_paid: total_amount_paid.toFixed(2),
                net_total: (salon_services_amount + platform_fee - discount + gst).toFixed(2),
                total_remaining: ((salon_services_amount + platform_fee - discount + gst) - total_amount_paid).toFixed(2)
            };

            // Send response with appointment, user, services, and payment information
            res.status(200).json({
                success: true,
                data: {
                    appointment_details: appointment,
                    user_details: {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        phone_number: user.phone_number,
                    },
                    services_details: services,
                    payment_info: payment_info,
                    transaction_info: transaction_info,
                },
                message: "OK"
            });
        } catch (error) {
            // Handle unexpected errors
            logger.error("Error fetching appointment details:", error);
            res.status(500).json({
                success: false,
                message: "Internal Server Error Occurred",
                data: []
            });
        }
    }
}


async function generateReceiptNumber() {
    // Generate a random receipt number
    const receiptNumber = Math.floor(Math.random() * 100000000);

    // Check if the generated receipt number already exists in the database
    const query = await Appointment.findOne({ where: { receipt_number: receiptNumber.toString() } });

    // If a match is found (simulating the receipt number already exists)
    if (query) {
        return generateReceiptNumber();  // Corrected recursive call
    }

    // Return the unique receipt number as a string
    return receiptNumber.toString();
}

async function generateSlots(branchStartTime, branchEndTime, serviceDuration, slotInterval, holidayHours, branch_id, formatedAppointmentDate) {
    let slots = [];
    let currentSlotStartTime = branchStartTime.clone();

    while (currentSlotStartTime.isBefore(branchEndTime)) {
        const slotEndTime = currentSlotStartTime.clone().add(serviceDuration, 'minutes');
        if (slotEndTime.isAfter(branchEndTime)) break;

        let isHoliday = false;
        for (const holiday of holidayHours) {
            const holidayStart = moment(holiday.from_date);
            const holidayEnd = moment(holiday.to_date);

            if (
                (currentSlotStartTime.isSameOrAfter(holidayStart) && currentSlotStartTime.isBefore(holidayEnd)) ||
                (slotEndTime.isAfter(holidayStart) && slotEndTime.isSameOrBefore(holidayEnd)) ||
                (currentSlotStartTime.isBefore(holidayStart) && slotEndTime.isAfter(holidayEnd))
            ) {
                isHoliday = true;
                currentSlotStartTime = holidayEnd.clone().add(15, 'minutes'); // Move to the end of the holiday period and add a 15-minute buffer
                break;
            }
        }

        if (!isHoliday) {
            slots.push({
                start_time: currentSlotStartTime.format('HH:mm'),
                end_time: slotEndTime.format('HH:mm')
            });
            currentSlotStartTime.add(slotInterval, 'minutes');
        } else {
            if (currentSlotStartTime.isAfter(branchEndTime)) break;
        }
    }

    try {
        const seats = await getSalonSeats(branch_id);
        if (seats === null || seats === 0) {
            throw new Error("Could Not Find Salon Seats.")
        }
        let availableSlots = new Set();
        let unavailableSlots = new Set();

        for (let i = 1; i <= seats; i++) {
            const seatNo = i;
            const appointments = await getAppointmentsForSeat(branch_id, seatNo, formatedAppointmentDate);

            for (const slot of slots) {
                let isAvailable = true;
                for (const appointment of appointments) {
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
                    availableSlots.add(JSON.stringify(slot));
                } else {
                    unavailableSlots.add(JSON.stringify(slot));
                }
            }
        }

        availableSlots = Array.from(availableSlots).map(slot => JSON.parse(slot));
        unavailableSlots = Array.from(unavailableSlots).map(slot => JSON.parse(slot));

        return { availableSlots, unavailableSlots };

    } catch (error) {
        logger.error("Error in generateSlots function: ", error);
        throw new Error(`Error generating slots: ${error}`);
    }
}

async function getSalonSeats(branch_id) {
    try {
        const branch = await Branch.findOne({ where: { id: branch_id, status: enums.is_active.yes }, attributes: ['seats'] });
        if (!branch) {
            throw new Error("Branch not found or inactive.");
        }
        return branch.seats;
    } catch (error) {
        logger.error("Error in getSalonSeats function: ", error);
        throw new Error(`Error fetching salon seats: ${error.message}`);
    }
}

async function getAppointmentsForSeat(branch_id, seatNo, appointment_date) {
    try {
        return await Appointment.findAll({
            attributes: ['start_time', 'end_time'],
            where: {
                branch_id: branch_id,
                seat_number: seatNo,
                appointment_date: appointment_date
            }
        });
    } catch (error) {
        logger.error("Error in getAppointmentForSeat function: ", error);
        throw new Error(`Error fetching appointments for seat: ${error.message}`);
    }
}

async function getTotalServiceDuration(services, branch_id) {
    try {
        let totalDuration = 0;

        for (const element of services) {
            const service_id = element.service_id;
            const getServiceDuration = await ServiceOptions.findAll({
                attributes: ['duration', 'id'],
                include: [{
                    model: Services,
                    attributes: ['branch_id'],
                    where: {
                        branch_id: branch_id,
                        status: enums.is_active.yes,
                    }
                }],
                where: {
                    id: service_id
                }
            });

            if (getServiceDuration.length < 1) {
                return {
                    success: false,
                    message: "Couldn't find one or more services.",
                    data: []
                };
            }

            for (const service of getServiceDuration) {
                const serviceDuration = parseInt(service.duration);
                if (isNaN(serviceDuration) || typeof (serviceDuration) === undefined) {
                    throw new Error(`Invalid duration for service ID ${service_id}`);
                }
                totalDuration += serviceDuration;
            }
        }

        return {
            success: true,
            data: totalDuration
        };

    } catch (error) {
        logger.error("Error in getTotalServiceDuration function: ", error);
        return {
            success: false,
            message: `Error calculating total service duration: ${error.message}`,
            data: []
        };
    }
}


