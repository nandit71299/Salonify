const { User, Cart, CartItems, Saloon, Branch, BranchHour, HolidayHour, Services, ServiceOptions, Appointment, PlatformCoupon, PlatformCouponBranch, BranchCoupon, AppointmentItems, CancellationReason, AppointmentDiscount, Payments, sequelize } = require('../models');
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
                return res.status(404).json({
                    success: false,
                    message: "Appointment not found.",
                    data: []
                })
            }

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
    },

    async getBookingHistory(req, res) {
        const user_id = req.query.user_id;

        try {
            const data = { upcoming: [], today: [], past: [] };

            const appointments = await Appointment.findAll({
                where: { user_id },
                include: [
                    {
                        model: Branch,
                        attributes: ['name', 'address']
                    },
                    {
                        model: AppointmentItems,
                        include: [
                            {
                                model: ServiceOptions,
                                attributes: ['id', 'name']
                            }
                        ]
                    }
                ]
            });

            for (const appointment of appointments) {
                const {
                    id, receipt_number, branch_id, subtotal, total_discount, total_tax, net_amount,
                    total_amount_paid, end_time, seat_number, created_at, is_rescheduled, appointment_date,
                    start_time, status
                } = appointment;

                // Formatting date and time
                const formattedAppointmentDate = moment(appointment_date).format("YYYY-MM-DD");
                const formattedStartTime = moment(start_time, "HH:mm").format("HH:mm");

                const branchDetails = {
                    name: appointment.Branch.name,
                    address: appointment.Branch.address
                };

                const services_options = appointment.AppointmentItems.map(item => ({
                    id: item.ServiceOption.id,
                    name: item.ServiceOption.name
                }));

                // Calculate if appointment is cancellable or reschedulable
                const threeHoursBeforeAppointment = moment(`${formattedAppointmentDate} ${formattedStartTime}`, 'YYYY-MM-DD HH:mm').subtract(3, 'hours');
                const isCancellable = (
                    (status !== enums.appointmentType.Pending_Payment_Confirmation) &&
                    (status === enums.appointmentType.Confirmed || status === enums.appointmentType.NoShow) &&
                    status !== enums.appointmentType.Closed &&
                    status !== enums.appointmentType.Cancelled
                ) || (status === enums.appointmentType.Confirmed && moment().isBefore(threeHoursBeforeAppointment) && is_rescheduled !== 1);

                const isRescheduleable = (
                    (status !== enums.appointmentType.Pending_Payment_Confirmation) &&
                    (status === enums.appointmentType.Confirmed && moment().isBefore(threeHoursBeforeAppointment) && is_rescheduled !== 1) &&
                    status !== enums.appointmentType.Closed &&
                    status !== enums.appointmentType.Cancelled &&
                    status !== enums.appointmentType.NoShow
                );

                // Assign appointment to appropriate category
                const currentDate = moment().format("YYYY-MM-DD");
                if (formattedAppointmentDate > currentDate) {
                    data.upcoming.push(getAppointmentObject(appointment, branchDetails, services_options, isRescheduleable, isCancellable));
                } else if (formattedAppointmentDate === currentDate) {
                    data.today.push(getAppointmentObject(appointment, branchDetails, services_options, isRescheduleable, isCancellable));
                } else {
                    data.past.push(getAppointmentObject(appointment, branchDetails, services_options, isRescheduleable, isCancellable));
                }

                function getAppointmentObject(appointment, branchDetails, services_options, isRescheduleable, isCancellable) {
                    return {
                        user_id: appointment.user_id,
                        id: appointment.id,
                        receipt_number: appointment.receipt_number,
                        branch_id: appointment.branch_id,
                        appointment_date: appointment.appointment_date,
                        subtotal: appointment.subtotal,
                        total_discount: appointment.total_discount,
                        total_tax: appointment.total_tax,
                        net_amount: appointment.net_amount,
                        total_amount_paid: appointment.total_amount_paid,
                        start_time: appointment.start_time,
                        end_time: appointment.end_time,
                        status: appointment.status,
                        seat_number: appointment.seat_number,
                        isRescheduleable: isRescheduleable,
                        isCancellable: isCancellable,
                        created_at: appointment.created_at,
                        branch_details: branchDetails,
                        services_options: services_options
                    };
                }

            }

            res.json({ success: true, data, message: "OK" });
        } catch (error) {
            logger.error('Error fetching appointment history:', error);
            res.status(500).json({ success: false, message: "Internal Server Error", data: [] });
        }
    },

    async getCustomerAppointmentDetails(req, res) {
        try {
            const { appointment_id, branch_id, user_id } = req.query;

            // Fetch appointment details
            const appointment = await Appointment.findOne({
                where: {
                    id: appointment_id,
                    branch_id: branch_id,
                    user_id: user_id
                }
            });

            if (!appointment) {
                return res.status(404).json({ success: false, message: "Appointment not found", data: [] });
            }

            // Fetch Branch Details
            const branchDetails = await Branch.findOne({
                where: { id: appointment.branch_id }
            });

            // Fetch payment details
            const paymentDetails = await Payments.findAll({
                where: { appointment_id: appointment_id }
            });

            const data = {
                appointment_details: appointment,
                branch_details: branchDetails,
                service_details: [],
                payment_details: {
                    successfull_payments: [],
                    failed_payments: [],
                    refunded_payments: [],
                    unknown_payments: []
                }
            };

            // Fetch appointment services
            const appointmentServices = await AppointmentItems.findAll({
                where: { appointment_id: appointment.id }
            });

            for (const item of appointmentServices) {
                const serviceDetails = await ServiceOptions.findOne({
                    where: { id: item.service_option_id }
                });
                if (serviceDetails) {
                    data.service_details.push({ serviceName: serviceDetails.name, servicePrice: item.service_price });
                }
            }

            // Categorize payment details
            paymentDetails.forEach(payment => {
                switch (payment.status) {
                    case enums.payment_status.succesfull:
                        data.payment_details.successfull_payments.push(payment);
                        break;
                    case enums.payment_status.failed:
                        data.payment_details.failed_payments.push(payment);
                        break;
                    case enums.payment_status.refunded:
                        data.payment_details.refunded_payments.push(payment);
                        break;
                    default:
                        data.payment_details.unknown_payments.push(payment);
                        break;
                }
            });

            res.json({ success: true, data: data, message: "OK" });
        } catch (error) {
            logger.error("Error fetching appointment details:", error);
            res.status(500).json({ success: false, message: "Internal server error", data: [] });
        }
    },

    async getCancellationSummary(req, res) {
        try {
            const { appointment_id, branch_id, user_id } = req.query;

            // Initialize data object to store appointment, service, and refund details
            const data = { appointmentDetails: [], serviceDetails: [], cancellation_reasons: [], refundSummary: [] };

            // Retrieve appointment details from the database
            const appointmentData = await Appointment.findOne({ where: { id: appointment_id, branch_id, user_id } });

            // Check if appointment exists
            if (!appointmentData) {
                return res.status(404).json({ success: false, message: 'Appointment not found', data: [] });
            }

            // Retrieve branch details associated with the appointment
            const branchDetails = await Branch.findOne({ where: { id: appointmentData.branch_id } });
            const branchName = branchDetails.name;
            const branchAddress = branchDetails.address;
            const branchContact = branchDetails.contact;
            // Retrieve services associated with the appointment
            const appointmentServices = await AppointmentItems.findAll({ where: { appointment_id: appointment_id } });
            if (!appointmentServices) {
                return res.status(404).json({ success: false, message: 'Error Fetching Appointment Items ', data: [] });
            }
            // Process appointment services and add to data object
            for (const iterator of appointmentServices) {
                const serviceDetails = await ServiceOptions.findOne({ where: { id: iterator.service_option_id } });
                if (serviceDetails) {
                    data.serviceDetails.push({ name: serviceDetails.name, price: iterator.price });
                }
            }

            // Format appointment date and start time
            const appointment_date = moment(appointmentData.appointment_date).format("YYYY-MM-DD");
            const start_time = moment(appointmentData.start_time, "HH:mm").format("HH:mm");

            // Calculate refund amount and cancellation charges based on appointment status
            let refund_amount = 0;
            let cancellation_charges = 0;
            const status = appointmentData.status;
            const paidAmount = appointmentData.total_amount_paid;

            if (status === 2) { // Confirmed
                if (appointmentData.is_rescheduled !== 1) { // Not rescheduled
                    const threeHoursBeforeAppointment = moment(`${appointment_date} ${start_time}`, 'YYYY-MM-DD HH:mm').subtract(3, 'hours');
                    if (moment().isBefore(threeHoursBeforeAppointment)) {
                        refund_amount = paidAmount;
                    }
                }
                cancellation_charges = refund_amount === 0 ? paidAmount : 0;
            } else {
                // For other statuses, cancellation charges are equal to the paid amount
                cancellation_charges = paidAmount;
            }

            // Retrieve cancellation reasons
            const cancellationReasons = await CancellationReason.findAll({
                attributes: ['id', 'reason']
            });

            // Add refund summary and appointment details to data object
            data.appointmentDetails.push({ branchName, branchAddress, branchContact, appointment_reciept_number: appointmentData.receipt_number, appointment_date, start_time });
            data.refundSummary.push({ paidAmount: parseFloat(paidAmount).toFixed(2), refund_amount: parseFloat(refund_amount).toFixed(2), cancellation_charges: parseFloat(cancellation_charges).toFixed(2) });
            data.cancellation_reasons = cancellationReasons;

            // Send the data object as the response
            res.status(200).json({ success: true, data: data, message: "OK" });
        } catch (error) {
            // Handle any errors
            logger.error("Error Fetching Canccellation Details: ", error);
            res.status(500).json({ success: false, message: "Internal server error", data: [] });
        }
    },

    async rescheduleAppointment(req, res) {
        try {
            const { appointment_id, newDate } = req.body;
            let { newStartTime } = req.body;
            if (moment(newDate, "YYYY-MM-DD").isBefore(moment())) {
                return res.status(400).json({
                    success: false,
                    message: "Sorry. We Can't Drive You Back In Past, Common Past Is Past. Just Kidding... New Appointment Date Can Not Be In Past."
                })
            }
            // Get Appointment Details
            const appointmentDetails = await Appointment.findByPk(appointment_id);

            if (!appointmentDetails) {
                return res.status(404).json({ success: false, message: 'Appointment not found', data: [] });
            }

            const { is_rescheduled, appointment_date, start_time, end_time, status, branch_id } = appointmentDetails;

            const prevAppointment_date = moment(appointment_date).format("YYYY-MM-DD");
            const prevStart_time = moment(start_time, "HH:mm").format("HH:mm");
            const threeHoursBeforeAppointment = moment(`${prevAppointment_date} ${prevStart_time}`, 'YYYY-MM-DD HH:mm').subtract(3, 'hours');

            // Checking if the appointment is rescheduleable
            const isRescheduleable = (
                status !== enums.appointmentType.Pending_Payment_Confirmation &&
                status === enums.appointmentType.Confirmed && moment().isBefore(threeHoursBeforeAppointment) && is_rescheduled !== 1 &&
                status !== enums.appointmentType.Closed &&
                status !== enums.appointmentType.Cancelled &&
                status !== enums.appointmentType.NoShow
            );

            if (!isRescheduleable) {
                return res.status(403).json({ success: false, message: "Appointment is not eligible for rescheduling.", data: [] });
            }

            // Calculate new end time
            const previousStartTimeMoment = moment(start_time, 'HH:mm');
            const previousEndTimeMoment = moment(end_time, 'HH:mm');
            const duration = moment.duration(previousEndTimeMoment.diff(previousStartTimeMoment));
            const minutes = duration.asMinutes();
            let newEndTime = moment(newStartTime, "HH:mm").add(minutes, "minutes").subtract(1, "minutes").format("HH:mm");

            // Check if appointment time is outside of store hours
            const appointmentWeekday = moment(newDate).format('dddd').toLowerCase();
            const branchHours = await BranchHour.findOne({ where: { branch_id, day: appointmentWeekday } });

            if (!branchHours) {
                return res.status(403).json({ success: false, message: "Salon is not open on the selected appointment day." });
            }

            const { start_time: storeStartTime, end_time: storeEndTime } = branchHours;
            const momentStoreStartTime = moment(storeStartTime, 'HH:mm');
            const momentStoreEndTime = moment(storeEndTime, 'HH:mm');
            const momentAppointmentStartTime = moment(newStartTime, 'HH:mm');

            if (momentAppointmentStartTime.isBefore(momentStoreStartTime) || momentAppointmentStartTime.isAfter(momentStoreEndTime)) {
                return res.status(403).json({ success: false, message: "Appointment time is outside of store hours." });
            }

            // Check for available seats
            const branchDetails = await Branch.findByPk(branch_id);
            const totalSeats = branchDetails.seats;
            let availableSeat = 0;
            newStartTime = moment(newStartTime, "HH:mm").format("HH:mm");
            newEndTime = moment(newEndTime, "HH:mm").format("HH:mm");

            for (let seatNumber = 1; seatNumber <= totalSeats; seatNumber++) {
                const conflictingAppointments = await Appointment.findAll({
                    where: {
                        branch_id,
                        seat_number: seatNumber,
                        appointment_date: newDate,
                        [Op.or]: [
                            {
                                start_time: { [Op.lte]: newStartTime },
                                end_time: { [Op.gte]: newStartTime }
                            },
                            {
                                start_time: { [Op.lte]: newEndTime },
                                end_time: { [Op.gte]: newEndTime }
                            }
                        ]
                    }
                });

                if (conflictingAppointments.length === 0) {
                    availableSeat = seatNumber;
                    break;
                }
            }

            if (availableSeat === 0) {
                return res.status(409).json({ success: false, message: "No available seats for the given time slot." });
            }

            // Update the appointment
            const updateAppointment = await appointmentDetails.update({
                appointment_date: newDate,
                start_time: newStartTime,
                end_time: newEndTime,
                is_rescheduled: 1,
                seat_number: availableSeat,
                updated_at: moment().format()
            });

            res.json({ success: true, message: "OK", data: updateAppointment });
        } catch (error) {
            logger.error("Error in rescheduling appointment:", error);
            res.status(500).json({ success: false, message: "Internal Server Error." });
        }
    },

    async reserveASeat(req, res) {
        try {
            const { user_id, platform_coupon_id, branch_coupon_id, branch_id, appointment_date, appointment_time } = req.query;

            // Validate date and time
            if (!moment(appointment_date, "YYYY-MM-DD", true).isValid() || !moment(appointment_time, "HH:mm", true).isValid()) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid appointment date or time format.",
                    data: []
                });
            }

            // Check coupon conflict
            if (platform_coupon_id && branch_coupon_id) {
                return res.status(400).json({
                    success: false,
                    message: "Sorry, you cannot combine Salon/Branch coupons and platform coupons.",
                    data: []
                });
            }

            const data = {};

            // Fetch user details
            const userDetails = await User.findOne({
                where: { id: user_id, status: enums.UserType.customer },
                attributes: ['id', 'name', 'phone_number']
            });

            if (!userDetails) {
                return res.status(404).json({
                    success: false,
                    message: "User not found.",
                    data: []
                });
            }

            data.userDetails = userDetails.dataValues;
            data.schedule = {
                appointment_date: moment(appointment_date).format("DD MMM"),
                appointment_time: moment(appointment_time, "HH:mm").format("hh:mm A")
            };

            // Fetch branch details
            const branchDetails = await Branch.findOne({
                where: { id: branch_id },
                attributes: ['id', 'name', 'address', 'city']
            });

            if (!branchDetails) {
                return res.status(404).json({
                    success: false,
                    message: "Salon/Branch not found.",
                    data: []
                });
            }

            data.branchDetails = branchDetails;

            // Fetch offer details
            const offerDetails = [];
            if (platform_coupon_id) {
                const platformCoupon = await PlatformCoupon.findOne({
                    where: { id: platform_coupon_id, status: enums.is_active.yes },
                    attributes: ['id', 'name', 'amount', 'remark', 'max_advance_payment', 'advance_percentage']
                });
                if (platformCoupon) offerDetails.push(platformCoupon);
            }

            if (branch_coupon_id) {
                const branchCoupon = await BranchCoupon.findOne({
                    where: { id: branch_coupon_id, status: enums.is_active.yes },
                    attributes: ['id', 'name', 'amount', 'remark', 'max_advance_amount', 'advance_percentage', 'minimum_subtotal', 'start_date', 'end_date']
                });
                if (branchCoupon) offerDetails.push(branchCoupon);
            }

            data.offerDetails = offerDetails;

            // Fetch user cart
            const userCart = await Cart.findOne({
                where: { user_id },
                include: [{
                    model: CartItems,
                    include: [{
                        model: ServiceOptions,
                        attributes: ['id', 'name', 'price']
                    }]
                }]
            });

            if (!userCart || !userCart.CartItems.length) {
                return res.status(404).json({
                    success: false,
                    message: "No items found in cart.",
                    data: []
                });
            }

            // Calculate amounts
            let baseAmount = 0;
            const services = userCart.CartItems.map(item => {
                const price = parseFloat(item.ServiceOption.price);
                baseAmount += price;
                return {
                    id: item.ServiceOption.id,
                    name: item.ServiceOption.name,
                    price: price.toFixed(2)
                };
            });

            let discountAmount = 0;
            let totalDiscountedAmount = baseAmount;
            let discountedServices = [];

            if (offerDetails.length > 0) {
                discountAmount = offerDetails[0].amount;
                discountedServices = services.map(service => {
                    const discountedPrice = service.price - (service.price * discountAmount / 100);
                    return {
                        ...service,
                        discountedPrice: discountedPrice.toFixed(2)
                    };
                });
                totalDiscountedAmount = discountedServices.reduce((sum, service) => sum + parseFloat(service.discountedPrice), 0);
            }

            const gstRate = 0.18;
            const platformFee = 5;
            const gstAmount = totalDiscountedAmount * gstRate;
            const grandTotal = totalDiscountedAmount + gstAmount + platformFee;

            const bookingFee = (totalDiscountedAmount * (offerDetails[0]?.advance_percentage || 30)) / 100;
            const finalBookingFee = Math.min(bookingFee, offerDetails[0]?.max_advance_payment || 150);

            data.bookingSummary = {
                bookingFee: finalBookingFee.toFixed(2),
                grandTotal: grandTotal.toFixed(2),
                tobepaid: finalBookingFee.toFixed(2)
            };

            data.billingSummary = {
                itemTotal: baseAmount.toFixed(2),
                discount: (baseAmount - totalDiscountedAmount).toFixed(2),
                gst: gstAmount.toFixed(2),
                platform_fee: platformFee.toFixed(2),
                grandTotal: grandTotal.toFixed(2)
            };

            if (offerDetails.length > 0) {
                data.discountedServices = discountedServices;
            } else {
                data.services = services;
            }

            return res.json({ success: true, data: data });
        } catch (error) {
            console.error("Error reserving a seat:", error);
            return res.status(500).json({ success: false, message: "Internal Server Error", data: [] });
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


