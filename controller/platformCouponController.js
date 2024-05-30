const { User, Saloon, Branch, BranchHour, HolidayHour, Services, ServiceOptions, Appointment, PlatformCoupon, PlatformCouponBranch, AppointmentItems, AppointmentDiscount, Payments, sequelize } = require('../models');
const fs = require('fs');
const { Op, fn, col } = require('sequelize');

const path = require('path');
const enums = require('../enums')
const logger = require('../config/logger');
const moment = require('moment')

module.exports = {
    async joinPlatformCoupon(req, res) {
        try {
            const branch_id = req.body.branch_id;
            const platform_coupon_id = req.body.platform_coupon_id;

            await sequelize.transaction(async (transaction) => {

                const checkBranchExistence = await Branch.findOne({ where: { id: branch_id, status: 1 } });
                if (!checkBranchExistence) {
                    return res.status(404).json({
                        success: false,
                        message: "Salon/Branch Not Found.",
                        data: [],
                    })
                }

                const checkPlatformCouponStatus = await PlatformCoupon.findOne({ where: { id: platform_coupon_id, status: 1 } });
                if (!checkPlatformCouponStatus) {
                    return res.status(404).json({
                        success: false,
                        message: "Platform Coupon Not Found.",
                        data: [],
                    })
                }

                const checkParticipation = await PlatformCouponBranch.findOne({ where: { platform_coupon_id: platform_coupon_id, branch_id: branch_id, status: 1 } });
                if (!checkParticipation) {
                    await PlatformCouponBranch.create({ platform_coupon_id: platform_coupon_id, branch_id: branch_id }, { transaction });
                    return res.status(201).json({
                        success: true,
                        message: "Successfully joined the offer.",
                        data: []
                    })
                } else {
                    return res.status(409).json({
                        success: false,
                        message: "Looks like you have already participated.",
                        data: []
                    })
                }
            })

        } catch (error) {
            logger.error("Error Participating In Platform Coupon: ", error);
            res.status(500).json({
                success: false,
                message: "Internal Server Error",
                data: []
            })
        }
    },

    async exitPlatformCoupon(req, res) {
        const transaction = await sequelize.transaction();
        const branch_id = req.body.branch_id;
        const platform_coupon_id = req.body.platform_coupon_id;
        try {
            const [affectedRows, [exitQuery]] = await PlatformCouponBranch.update(
                {
                    status: 0,
                },
                {
                    where:
                    {
                        branch_id: branch_id,
                        platform_coupon_id: platform_coupon_id,
                        status: 1
                    },
                    returning: true,
                },
            );
            console.log(affectedRows)

            if (affectedRows < 1) {
                return res.status(409).json({
                    success: false,
                    message: "Looks like you have already exited from the offer or you did not participate.",
                    data: []
                })
            }

            res.status(201).json({
                success: true,
                message: "Successfully exited from the offer.",
                data: []
            })

        }
        catch (error) {
            await transaction.rollback();
            logger.error("Error Exiting Platform Coupon: ", error);
            res.status(500).json({
                success: false,
                message: "Internal Server Error",
                data: []
            })
        }
    },

    async getPlatformOffers(req, res) {
        try {
            const branch_id = req.query.branch_id;
            const checkBranchExistence = await Branch.findOne({ where: { id: branch_id } });
            if (!checkBranchExistence) {
                return res.status(404).json({
                    success: false,
                    message: "Salon/Branch not found",
                    data: [],
                })
            }

            // Fetch all platform offers
            const getOffers = await PlatformCoupon.findAll();
            if (!getOffers) {
                return res.status(404).json({
                    success: false,
                    data: [],
                    message: "No Platform Offers Available Currently..."
                })

            }
            const data = [];
            for (const offer of getOffers) {
                let isParticipated = false;

                // Check if the branch has participated in this offer
                const checkParticipation = await PlatformCouponBranch.findOne({
                    where: {
                        branch_id: branch_id,
                        platform_coupon_id: offer.id
                    }
                });

                if (checkParticipation) {
                    isParticipated = true;
                }

                data.push({
                    id: offer.id,
                    discount_amount: offer.discount_amount,
                    remark: offer.remark,
                    status: offer.status,
                    max_advance_payment: offer.max_advance_payment,
                    advance_percentage: offer.advance_percentage,
                    isParticipated: isParticipated
                })
            }

            res.status(200).json({
                success: true,
                data: data,
                message: "OK"
            })
        } catch (error) {
            logger.error("Error Fetchign Platform Offers", error);
            res.status(500).json({
                success: false,
                message: "Internal Server Error",
                data: []
            })
        }
    },

    async getPlatformOfferInsights(req, res) {
        try {

            const branchId = req.query.branch_id;
            const platformCouponId = req.query.platform_coupon_id;
            let fromDateRange = req.query.from_date_range;
            let toDateRange = req.query.to_date_range;

            const checkBranchExistence = await Branch.findOne({ where: { id: branchId } });
            if (!checkBranchExistence) {
                return res.status(404).json({
                    success: false,
                    message: "Salon/Branch not found",
                    data: [],
                })
            }
            const checkPlatformCoupon = await PlatformCoupon.findOne({ where: { id: platformCouponId, status: enums.is_active.yes } })
            if (!checkPlatformCoupon) {
                return res.status(404).json({
                    success: false,
                    message: "Invalid Platform Coupon",
                    data: [],
                })
            }

            let dateFilter = {};
            if (fromDateRange && toDateRange) {
                fromDateRange = moment(fromDateRange).startOf('day').toDate();
                toDateRange = moment(toDateRange).endOf('day').toDate();
                dateFilter = { appointment_date: { [Op.between]: [fromDateRange, toDateRange] } };
            }

            const appointments = await Appointment.findAll({
                where: {
                    branch_id: branchId,
                    status: enums.appointmentType.Closed,
                    ...dateFilter
                },
                include: [{
                    model: AppointmentDiscount,
                    where: { coupon_type: enums.coupon_type.platform_coupon.toString(), coupon_id: platformCouponId }
                },
                {
                    model: AppointmentItems,
                }
                ]
            })


            if (appointments.length < 1) {
                return res.status(200).json({
                    success: true,
                    data: [],
                    message: "No appointments found with this offer or in given date range."
                });
            }

            let totalSales = 0;
            let totalDiscountAmount = 0;
            const appointmentIds = [];
            const appointmentsWithOffer = [];

            appointments.forEach(appointment => {
                appointmentIds.push(appointment.id);
                const appointmentDate = moment(appointment.appointment_date).format("YYYY-MM-DD");
                const paidAmount = appointment.total_amount_paid ? parseFloat(appointment.total_amount_paid).toFixed(2) : '0.00';
                appointmentsWithOffer.push({ appointment_date: appointmentDate, paid_amount: paidAmount });
                totalSales += paidAmount;
                totalDiscountAmount += appointment.total_discount ? parseFloat(appointment.total_discount).toFixed(2) : '0.00';
            });


            const mostBookedServicesQuery = `
                SELECT so.service_id, s.name AS service_name, SUM(ai.total_price_paid) AS total_sales 
                FROM "AppointmentItems" ai 
                INNER JOIN "ServiceOptions" so ON ai.service_option_id = so.id
                INNER JOIN "Services" s ON so.service_id = s.id
                WHERE ai.appointment_id IN (:appointmentIds)
                GROUP BY so.service_id, s.name`;

            const mostBookedServices = await sequelize.query(mostBookedServicesQuery, {
                replacements: { appointmentIds },
                type: sequelize.QueryTypes.SELECT
            });

            const topPayingCustomers = await User.findAll({
                include: [
                    {
                        model: Appointment,
                        where: { id: appointmentIds },
                        attributes: [], // Include only the appointment ID
                        include: [
                            {
                                model: AppointmentDiscount,
                                where: { coupon_type: enums.coupon_type.platform_coupon.toString(), coupon_id: platformCouponId },
                                attributes: [] // Exclude attributes from AppointmentDiscount
                            }
                        ]
                    }
                ],
                attributes: [
                    'id',
                    'email',
                    'name',
                    'phone_number',
                    [sequelize.fn('COUNT', sequelize.col('Appointments.id')), 'appointment_count'],
                    [sequelize.fn('SUM', sequelize.col('Appointments.total_amount_paid')), 'total_amount_paid']
                ],
                group: ['User.id'], // Group only by user ID
            });

            res.status(200).json({
                success: true,
                data: {
                    appointments_with_offer: appointmentsWithOffer,
                    total_sales: parseFloat(totalSales).toFixed(2),
                    total_discount_amount: parseFloat(totalDiscountAmount).toFixed(2),
                    most_booked_services: mostBookedServices,
                    top_paying_customers: topPayingCustomers
                },
                message: "OK"
            });
        } catch (error) {
            logger.error("Error fetching platform offer insights:", error);
            res.status(500).json({ success: false, message: "Internal Server Error", data: [] });
        }
    },

    async getSalesOverTimeWithPlatformOffer(req, res) {
        try {
            const branchId = req.query.branch_id;
            const platformCouponId = req.query.platform_coupon_id;
            let fromDateRange = req.query.from_date_range;
            let toDateRange = req.query.to_date_range;

            let dateFilter = {}
            const checkBranchExistence = await Branch.findOne({ where: { id: branchId } });
            if (!checkBranchExistence) {
                return res.status(404).json({
                    success: false,
                    message: "Salon/Branch not found",
                    data: [],
                })
            }
            const checkPlatformCoupon = await PlatformCoupon.findOne({ where: { id: platformCouponId, status: enums.is_active.yes } })
            if (!checkPlatformCoupon) {
                return res.status(404).json({
                    success: false,
                    message: "Invalid Platform Coupon",
                    data: [],
                })
            }


            if (fromDateRange && toDateRange) {
                fromDateRange = moment(fromDateRange, "YYYY-MM-DD").format("YYYY-MM-DD");
                toDateRange = moment(toDateRange, "YYYY-MM-DD").format("YYYY-MM-DD");
                dateFilter = { appointment_date: { [Op.between]: [fromDateRange, toDateRange] } }
            }

            const appointmentsData = await Appointment.findAll({
                where: { branch_id: branchId, status: enums.appointmentType.Closed, ...dateFilter },
                includes: {
                    model: AppointmentDiscount,
                    where: { coupon_id: platformCouponId },
                },
                attributes: [
                    'appointment_date',
                    [fn('COUNT', col('id')), 'total_appointments'],
                    [fn('AVG', col('total_amount_paid')), 'avg_paid_amount'],
                    [fn('SUM', col('total_amount_paid')), 'total_amount_paid'],
                ],
                group: ['Appointment.appointment_date']
            })
            let response = appointmentsData.map(appointment => {

                return {
                    appointment_date: moment(appointment.dataValues.appointment_date, "YYYY-MM-DD").format("YYYY-MM-DD"),
                    total_appointments: appointment.dataValues.total_appointments,
                    avg_paid_amount: appointment.dataValues.avg_paid_amount ? parseFloat(appointment.dataValues.avg_paid_amount).toFixed(2) : '0.00',
                    total_amount_paid: appointment.dataValues.total_amount_paid ? parseFloat(appointment.dataValues.total_amount_paid).toFixed(2) : '0.00'
                }

            });
            if (response.length < 1) {
                return res.status(200).json({
                    success: true, data: [], message: "No appointments found with given date range."
                })
            }
            res.json({ success: true, data: response, message: "OK" });
        } catch (error) {
            logger.error("Error fetching platform offer appointments data:", error);
            res.status(500).json({ success: false, message: "Internal Server Error", data: [] });
        }
    },

    async getSalesByServiceWithPlatformOffer(req, res) {
        const branchId = req.query.branch_id;
        const platformCouponId = req.query.platform_coupon_id;
        let fromDateRange = req.query.from_date_range;
        let toDateRange = req.query.to_date_range;

        const checkBranchExistence = await Branch.findOne({ where: { id: branchId } });
        if (!checkBranchExistence) {
            return res.status(404).json({
                success: false,
                message: "Salon/Branch not found",
                data: [],
            })
        }
        const checkPlatformCoupon = await PlatformCoupon.findOne({ where: { id: platformCouponId, status: enums.is_active.yes } })
        if (!checkPlatformCoupon) {
            return res.status(404).json({
                success: false,
                message: "Invalid Platform Coupon",
                data: [],
            })
        }

        // If date range provided, format them using moment
        let dateFilter = {};
        if (fromDateRange && toDateRange) {
            fromDateRange = moment(fromDateRange).startOf('day').toDate();
            toDateRange = moment(toDateRange).endOf('day').toDate();
            dateFilter = { appointment_date: { [Op.between]: [fromDateRange, toDateRange] } };
        }

        try {
            const appointments = await Appointment.findAll({
                where: {
                    branch_id: branchId,
                    status: enums.appointmentType.Closed,
                    ...dateFilter,
                },
                include: [
                    {
                        model: AppointmentDiscount,
                        where: { coupon_id: platformCouponId, coupon_type: enums.coupon_type.platform_coupon.toString() },
                        attributes: [] // We don't need any attributes from AppointmentDiscount
                    },
                    {
                        model: AppointmentItems,
                        include: [
                            {
                                model: ServiceOptions,
                                include: [
                                    {
                                        model: Services,
                                        attributes: ['name'] // We need the name of the service
                                    }
                                ],
                                attributes: [] // We don't need any attributes from ServiceOption
                            }
                        ],
                        attributes: [] // We don't need any attributes from AppointmentItem
                    }
                ],
                attributes: [
                    'id',
                    [sequelize.fn('COUNT', sequelize.col('Appointment.id')), 'total_appointments'],
                    [sequelize.fn('AVG', sequelize.col('Appointment.net_amount')), 'avg_appointment_value'],
                    [sequelize.fn('SUM', sequelize.col('Appointment.net_amount')), 'total_sales'],
                    [sequelize.col('AppointmentItems->ServiceOption->Service.name'), 'service_name'] // Alias for the service name
                ],
                group: [
                    'Appointment.id',
                    'AppointmentItems->ServiceOption->Service.id',
                    'AppointmentItems->ServiceOption->Service.name' // Group by service name
                ],
                order: [[sequelize.literal('service_name'), 'ASC']] // Ensure correct ordering syntax
            });

            if (appointments.length < 1) {
                return res.status(200).json({
                    success: true,
                    data: [],
                    message: "No appointments found with this offer or in given date range."
                });
            }

            // return console.log(appointments)
            // Formatting the result
            const data = appointments.map(appointment => ({
                service_name: appointment.dataValues.service_name,
                total_appointments: appointment.dataValues.total_appointments,
                avg_appointment_value: parseFloat(appointment.dataValues.avg_appointment_value).toFixed(2),
                total_sales: parseFloat(appointment.dataValues.total_sales).toFixed(2),
            }));

            res.json({ success: true, data: data, message: "OK" });

        } catch (error) {
            logger.error("Error fetching sales by service:", error);
            res.status(500).json({ success: false, message: "Internal Server Error", data: [] });
        }
    },

    async getTopPayingCustomersWithPlatformOffer(req, res) {
        try {
            const branchId = req.query.branch_id;
            const platformCouponId = req.query.platform_coupon_id;

            let dateFilter = {};

            const checkBranchExistence = await Branch.findOne({ where: { id: branchId } });
            if (!checkBranchExistence) {
                return res.status(404).json({
                    success: false,
                    message: "Salon/Branch not found",
                    data: [],
                })
            }
            const checkPlatformCoupon = await PlatformCoupon.findOne({ where: { id: platformCouponId, status: enums.is_active.yes } })
            if (!checkPlatformCoupon) {
                return res.status(404).json({
                    success: false,
                    message: "Invalid Platform Coupon",
                    data: [],
                })
            }

            if (req.query.from_date_range && req.query.to_date_range) {
                const fromDateRange = moment(req.query.from_date_range).startOf('day').toDate();
                const toDateRange = moment(req.query.to_date_range).endOf('day').toDate();
                dateFilter = { appointment_date: { [Op.between]: [fromDateRange, toDateRange] } };
            }

            const topPayingCustomers = await User.findAll({
                where: {
                    user_type: enums.UserType.customer
                },
                include: [
                    {
                        model: Appointment,
                        where: {
                            branch_id: branchId,
                            status: enums.appointmentType.Closed,
                            ...dateFilter,
                        },
                        include: [
                            {
                                model: AppointmentDiscount,
                                where: { coupon_id: platformCouponId, coupon_type: (enums.coupon_type.platform_coupon).toString() },
                                attributes: [] // We don't need any attributes from AppointmentDiscount
                            }
                        ],
                        attributes: [] // We don't need any attributes from Appointment
                    }
                ],
                attributes: [
                    'id',
                    'name',
                    [fn('SUM', col('Appointments.total_amount_paid')), 'total_paid_amount'],
                    [fn('COUNT', col('Appointments.id')), 'total_appointment']
                ],
                group: ['User.id'],
                order: [[fn('SUM', col('Appointments.total_amount_paid')), 'ASC']]
            });

            if (topPayingCustomers.length < 1) {
                return res.status(200).json({
                    success: true,
                    data: [],
                    message: "No appointments found with this offer or in given date range."
                });
            }

            const formattedCustomers = topPayingCustomers.map((customer, index) => ({
                serial_number: index + 1,
                user_id: customer.id,
                name: customer.name,
                total_paid_amount: parseFloat(customer.get('total_paid_amount')).toFixed(2),
                total_appointment: customer.get('total_appointment')
            }));

            res.json({ success: true, data: formattedCustomers, message: "OK" });

        } catch (error) {
            logger.error("Error Fetching Top Paying Customers With Platform Offer: ", error);
            res.status(500).json({
                success: false,
                message: "Internal Server Error",
                data: []
            });
        }
    }

}
