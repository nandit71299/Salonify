const { User, Saloon, Branch, BranchHour, HolidayHour, Services, ServiceOptions, Appointment, PlatformCoupon, PlatformCouponBranch, AppointmentItems, AppointmentDiscount, sequelize } = require('../models');
const moment = require('moment')
const { Op, fn, col, literal } = require('sequelize');
const enums = require('../enums');
const logger = require('../config/logger');


module.exports = {
    async getAppointmentAnalyticsWithDateRange(req, res) {

        try {
            let from_date_range = moment().format("YYYY-MM-DD");
            let to_date_range = moment().format("YYYY-MM-DD");

            if (req.query.from_date_range && req.query.to_date_range) {
                from_date_range = moment(req.query.from_date_range).format("YYYY-MM-DD");
                to_date_range = moment(req.query.to_date_range).format("YYYY-MM-DD");
            }

            const branch_id = req.query.branch_id;
            // const fromDate = moment(from_date_range).startOf('day').toDate();
            // const toDate = moment(to_date_range).endOf('day').toDate();

            const appointments = await Appointment.findAll({
                where: {
                    branch_id: branch_id,
                    appointment_date: {
                        [Op.between]: [from_date_range, to_date_range]
                    },
                    status: {
                        [Op.notIn]: [enums.appointmentType.Pending_Payment_Confirmation]
                    }
                }
            });

            const total_appointments = appointments.length;

            let completedAppointments = 0;
            let cancelledAppointments = 0;

            for (const appointment of appointments) {
                if (appointment.status === enums.appointmentType.Closed) {
                    completedAppointments++;
                }
                if (appointment.status === enums.appointmentType.Cancelled) {
                    cancelledAppointments++;
                }
            }

            const expectedSales = await Appointment.sum('net_amount', {
                where: {
                    status: {
                        [Op.in]: [
                            enums.appointmentType.Confirmed,
                            enums.appointmentType.Closed,
                            enums.appointmentType.NoShow
                        ]
                    },
                    branch_id: branch_id,
                    appointment_date: {
                        [Op.between]: [from_date_range, to_date_range]
                    }
                }
            });

            res.json({
                success: true,
                data: {
                    total_appointments: total_appointments,
                    completed: completedAppointments,
                    cancelled: cancelledAppointments,
                    expectedSales: expectedSales || 0
                },
                message: "OK"
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, message: "Internal Server Error", data: [] });
        }

    },

    async getPaymentsWithDateRange(req, res) {
        try {
            let from_date_range = moment().format("YYYY-MM-DD");
            let to_date_range = moment().format("YYYY-MM-DD");

            if (req.query.from_date_range && req.query.to_date_range) {
                from_date_range = moment(req.query.from_date_range).format("YYYY-MM-DD");
                to_date_range = moment(req.query.to_date_range).format("YYYY-MM-DD");
            }

            const branch_id = req.query.branch_id;

            const netSalesResult = await Appointment.findAll({
                attributes: [
                    [Appointment.sequelize.fn('SUM', Appointment.sequelize.col('total_amount_paid')), 'total_amount_paid']
                ],
                where: {
                    status: enums.appointmentType.Closed,
                    appointment_date: {
                        [Op.between]: [from_date_range, to_date_range]
                    },
                    branch_id: branch_id
                }
            });

            const closedAppointmentsResult = await Appointment.count({
                where: {
                    status: enums.appointmentType.Closed,
                    appointment_date: {
                        [Op.between]: [from_date_range, to_date_range]
                    },
                    branch_id: branch_id
                }
            });

            const netSales = netSalesResult[0].dataValues.total_amount_paid || 0;
            const closedAppointments = closedAppointmentsResult;
            res.json({
                success: true,
                data: {
                    netSales: netSales,
                    closed_appointments: `${closedAppointments} Closed Appointments`
                },
                message: "OK"
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({
                success: false,
                message: "Internal Server Error Occurred",
                data: []
            });
        }
    },

    async getServiceAnalyticsWithDateRange(req, res) {
        try {
            const branch_id = req.query.branch_id;

            let from_date_range = moment().format("YYYY-MM-DD");
            let to_date_range = moment().format("YYYY-MM-DD");
            if (req.query.from_date_range && req.query.to_date_range) {
                from_date_range = moment(req.query.from_date_range, "YYYY-MM-DD").format("YYYY-MM-DD");
                to_date_range = moment(req.query.to_date_range, "YYYY-MM-DD").format("YYYY-MM-DD");
            }

            let limit = req.query.limit ? parseInt(req.query.limit) : 10;

            const results = await sequelize.query(
                `WITH service_options AS (
                    SELECT so.id AS service_option_id
                    FROM "Services" s
                    JOIN "ServiceOptions" so ON s.id = so.service_id
                    WHERE s.branch_id = :branch_id
                      AND s.status = 1
                      AND so.status = 1
                ),
                appointment_ids AS (
                    SELECT ai.appointment_id
                    FROM "AppointmentItems" ai
                    JOIN "ServiceOptions" so ON ai.service_option_id = so.id
                ),
                appointments_with_sales AS (
                    SELECT a.id AS appointment_id,
                           a.net_amount
                    FROM "Appointments" a
                    JOIN appointment_ids ai ON a.id = ai.appointment_id
                    WHERE a.status = 3
                    AND a.appointment_date >= :appointmentdate1
                    AND a.appointment_date <= :appointmentdate2 
                )
                SELECT s.id AS service_id,
                       s.name AS service_name,
                       COUNT(a.appointment_id) AS total_bookings,
                       SUM(a.net_amount) AS total_sales
                FROM "Services" s
                JOIN "ServiceOptions" so ON s.id = so.service_id
                JOIN "AppointmentItems" ai ON so.id = ai.service_option_id
                JOIN appointments_with_sales a ON ai.appointment_id = a.appointment_id
                WHERE s.status = 1
                  AND so.status = 1
                GROUP BY s.id, s.name
                ORDER BY total_sales DESC
                LIMIT :limit;    
                `, { type: sequelize.QueryTypes.SELECT, replacements: { branch_id: branch_id, appointmentdate1: from_date_range, appointmentdate2: to_date_range, limit } });

            const response = results.map(result => ({
                service_id: result.service_id,
                service_name: result.service_name,
                total_bookings: result.total_bookings,
                total_sales: result.total_sales
            }));


            res.json({ success: true, data: response, message: "OK" });
        } catch (error) {
            logger.error('\n Error Fetching Analytics Data: ', error);
            res.status(500).json({
                success: false,
                message: "Internal Server Error Occured.", data: []
            });
        }
    },

    async getTopPayingCustomers(req, res) {
        try {
            const branch_id = req.query.branch_id;

            let from_date_range = moment().format("YYYY-MM-DD");
            let to_date_range = moment().format("YYYY-MM-DD");
            if (req.query.from_date_range && req.query.to_date_range) {
                from_date_range = moment(req.query.from_date_range, "YYYY-MM-DD").format("YYYY-MM-DD");
                to_date_range = moment(req.query.to_date_range, "YYYY-MM-DD").format("YYYY-MM-DD");
            }
            const limit = req.query.limit ? req.query.limit : 10

            const query = `
                WITH appointments_with_sales AS (
                    SELECT a.user_id,
                           SUM(a.total_amount_paid) AS total_amount_paid
                    FROM "Appointments" a
                    WHERE a.branch_id = :branch_id
                      AND a.status = :status_closed
                      AND a.appointment_date >= :from_date
                      AND a.appointment_date <= :to_date
                    GROUP BY a.user_id
                )
                SELECT u.id AS user_id,
                       u.name AS user_name,
                       u.email AS user_email,
                       aws.total_amount_paid
                FROM appointments_with_sales aws
                JOIN "Users" u ON aws.user_id = u.id
                WHERE u.status = :status_active
                ORDER BY aws.total_amount_paid DESC
                LIMIT :limit;
            `;

            const queryVariables = {
                branch_id: branch_id,
                status_closed: enums.appointmentType.Closed,
                from_date: from_date_range,
                to_date: to_date_range,
                status_active: enums.is_active.yes,
                limit
            };

            const queryTopPayingCustomers = await sequelize.query(query, {
                replacements: queryVariables,
                type: sequelize.QueryTypes.SELECT
            });

            res.status(200).json({
                success: true,
                data: queryTopPayingCustomers,
                message: "OK"
            });

        } catch (error) {
            logger.error("Error Fetching Top Paying Customers", error);
            res.status(500).json({ success: false, message: "Internal Server Error", data: [] });
        }
    },

    async getDetailedAppointmetAnalytics(req, res) {
        const branch_id = req.query.branch_id;
        let from_date_range = moment().format("YYYY-MM-DD");
        let to_date_range = moment().format("YYYY-MM-DD");

        // If date range provided, use it
        if (req.query.from_date_range && req.query.to_date_range) {
            from_date_range = moment(req.query.from_date_range).format("YYYY-MM-DD");
            to_date_range = moment(req.query.to_date_range).format("YYYY-MM-DD");
        }

        try {
            const querySalesOverTime = `
                SELECT 
                    A.appointment_date,
                    SUM(A.total_amount_paid) AS "sales"
                FROM "Appointments" A
                WHERE 
                    A.appointment_date BETWEEN :from_date_range AND :to_date_range 
                    AND A.status = :closed_status 
                    AND A.branch_id = :branch_id 
                GROUP BY A.appointment_date
                ORDER BY A.appointment_date ASC;
            `;

            const queryFigures = `
                SELECT 
                    SUM(A.net_amount) AS "expected_sales",
                    AVG(A.net_amount) AS "avg_appointment_value",
                    COUNT(*) AS "total_appointments"
                FROM "Appointments" A
                WHERE 
                    A.appointment_date BETWEEN :from_date_range AND :to_date_range 
                    AND A.branch_id = :branch_id;
            `;

            const replacements = {
                from_date_range: from_date_range,
                to_date_range: to_date_range,
                closed_status: enums.appointmentType.Closed,
                branch_id: branch_id
            };

            const getSalesOverTime = await sequelize.query(querySalesOverTime, {
                replacements: replacements,
                type: sequelize.QueryTypes.SELECT
            });

            const getFigures = await sequelize.query(queryFigures, {
                replacements: replacements,
                type: sequelize.QueryTypes.SELECT
            });

            const figuresResponse = getFigures.map((figure) => {
                return {
                    expected_sales: parseFloat(figure.expected_sales).toFixed(2),
                    avg_appointment_value: parseFloat(figure.avg_appointment_value).toFixed(2),
                    total_appointments: figure.total_appointments
                }
            })

            const salesResponse = getSalesOverTime.map((sale) => {
                return {
                    appointment_date: sale.appointment_date,
                    sales: parseFloat(sale.sales).toFixed(2)
                }
            })

            res.status(200).json({
                success: true,
                data: {
                    figures: figuresResponse,
                    sales: salesResponse,
                },
                message: "OK"
            });

        } catch (error) {
            logger.error("Error Fetchig Appointment Data: ", error);
            res.status(500).json({
                success: false,
                message: "Internal Server Error Occurred.",
                data: []
            });
        }
    },

    async getSalesOverTimeReport(req, res) {
        const branch_id = req.query.branch_id;
        let from_date_range = moment().format("YYYY-MM-DD");
        let to_date_range = moment().format("YYYY-MM-DD");

        // If date range is provided, use it
        if (req.query.from_date_range && req.query.to_date_range) {
            from_date_range = moment(req.query.from_date_range, "YYYY-MM-DD").format("YYYY-MM-DD");
            to_date_range = moment(req.query.to_date_range, "YYYY-MM-DD").format("YYYY-MM-DD");
        }

        try {
            const query = await Appointment.findAll({
                attributes: [
                    'appointment_date',
                    [sequelize.fn('SUM', sequelize.col('net_amount')), 'total_sales'],
                    [sequelize.fn('AVG', sequelize.col('net_amount')), 'avg_appointment_value'],
                    [sequelize.fn('COUNT', sequelize.col('id')), 'total_appointments']
                ],
                where: {
                    branch_id: branch_id,
                    status: enums.appointmentType.Closed,
                    appointment_date: {
                        [Op.between]: [from_date_range, to_date_range]
                    }
                },
                group: ['appointment_date'],
                order: [['appointment_date', 'ASC']]
            });

            // Map and format the query results
            const result = query.map(row => ({
                appointment_date: row.appointment_date,
                total_sales: parseFloat(row.get('total_sales')).toFixed(2),
                avg_appointment_value: parseFloat(row.get('avg_appointment_value')).toFixed(2),
                total_appointments: row.get('total_appointments')
            }));

            res.json({ success: true, data: result, message: "OK" });
        } catch (error) {
            logger.error("Error Fetching Sales Report Data: ", error);
            res.status(500).json({
                success: false,
                message: "Internal Server Error Occurred",
                data: []
            });
        }

    },

    async getSalesByServiceReport(req, res) {
        const branch_id = req.query.branch_id;
        const from_date_range = req.query.from_date_range || moment().format('YYYY-MM-DD');
        const to_date_range = req.query.to_date_range || moment().format('YYYY-MM-DD');

        try {
            const queryResult = await sequelize.query(`
            SELECT 
            S.name AS service_name,
            COUNT(*) AS total_appointments,
            AVG(A.net_amount) AS avg_appointment_value,
            SUM(A.net_amount) AS total_sales
        FROM 
            "Appointments" A
            INNER JOIN "AppointmentItems" AI ON A.id = AI.appointment_id 
            INNER JOIN "ServiceOptions" SO ON AI.service_option_id = SO.id
            INNER JOIN "Services" S ON SO.service_id = S.id
        WHERE 
            A.status = :status 
            AND A.branch_id = :branch_id 
            AND A.appointment_date BETWEEN :from_date_range AND :to_date_range
        GROUP BY 
            S.name
        ORDER BY 
            S.name ASC;
        
            `, {
                replacements: {
                    status: enums.appointmentType.Closed,
                    branch_id: branch_id,
                    from_date_range: from_date_range,
                    to_date_range: to_date_range
                },
                type: sequelize.QueryTypes.SELECT
            });

            const response = queryResult.map((data) => {
                return {
                    name: data.service_name,
                    total_appointments: data.total_appointments,
                    avg_appointment_value: parseFloat(data.avg_appointment_value).toFixed(2),
                    total_sales: parseFloat(data.total_sales).toFixed(2),
                }
            })

            res.status(200).json({ success: true, data: response, message: 'OK' });
        } catch (error) {
            logger.error("Error Fetchig Sales By Service Report Data :", error);
            res.status(500).json({ success: false, message: 'Internal Server Error', data: [] });
        }
    },

    async getTopPayingCustomersReport(req, res) {
        const branch_id = req.query.branch_id;
        let from_date_range = moment().format("YYYY-MM-DD");
        let to_date_range = moment().format("YYYY-MM-DD");
        // If no date range provided, use current date
        if (req.query.from_date_range && req.query.to_date_range) {
            from_date_range = moment(req.query.from_date_range).format("YYYY-MM-DD");
            to_date_range = moment(req.query.to_date_range).format("YYYY-MM-DD");
        }

        try {
            const result = await sequelize.query(
                `
        WITH RankedCustomers AS (
            SELECT 
                C.id AS user_id,
                C.name AS customer_name,
                COUNT(*) AS total_appointments,
                AVG(A.net_amount) AS avg_appointment_value,
                SUM(A.net_amount) AS total_sales
            FROM "Appointments" A
            INNER JOIN "AppointmentItems" AI ON A.id = AI.appointment_id
            INNER JOIN "Users" C ON A.user_id = C.id
            WHERE A.status = :status AND A.branch_id = :branch_id AND A.appointment_date BETWEEN :from_date_range AND :to_date_range
            GROUP BY C.id, C.name
            ORDER BY total_sales DESC
        )
        SELECT 
            ROW_NUMBER() OVER (ORDER BY total_sales DESC) AS serial_no,
            user_id,
            customer_name,
            total_appointments,
            avg_appointment_value,
            total_sales
        FROM RankedCustomers;
        `,
                {
                    replacements: {
                        status: enums.appointmentType.Closed,
                        branch_id: branch_id,
                        from_date_range: from_date_range,
                        to_date_range: to_date_range
                    },
                    type: sequelize.QueryTypes.SELECT
                }
            );

            const response = result.map((data) => {
                return {
                    serial_no: data.serial_no,
                    user_id: data.user_id,
                    customer_name: data.customer_name,
                    total_appointments: data.total_appointments,
                    avg_appointment_value: parseFloat(data.avg_appointment_value).toFixed(2),
                    total_sales: parseFloat(data.total_sales).toFixed(2),

                }
            })

            res.status(200).json({
                success: true,
                data: response,
                message: "OK"
            });
        } catch (error) {
            logger.error("Error Fetching Top Paying Customers Report: ", error);
            res.status(500).json({
                success: false,
                message: "Internal Server Error Occurred",
                data: []
            });
        }
    }


}