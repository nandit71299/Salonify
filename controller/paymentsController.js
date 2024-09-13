const bcrypt = require('bcrypt');
const { User, Saloon, Branch, Appointment, sequelize, Payments } = require('../models');
const logger = require('../config/logger');
const { Op, fn, col } = require('sequelize');
const { createTransport } = require('../config/mailer');
const enums = require('../enums');
const moment = require('moment')
moment.tz("Asia/Kolkata");


module.exports = {

    async confirmAppointment(req, res) {
        // its just a mock api
        const { receipt_number } = req.body;

        try {
            const findAppointment = await Appointment.findOne({ where: { receipt_number: receipt } });
            if (!findAppointment) {
                return res.status(404).json({
                    success: false,
                    message: "Appointment not found.",
                    data: []
                })
            }
            const updateAppointment = await findAppointment.update({
                status: enums.appointmentType.Confirmed
            }, { returning: true })

            res.status(200).json({
                success: true,
                message: "Payment Succesfull, Appointment Confirmed",
                data: updateAppointment
            })

        } catch (error) {
            logger.error("Error confirming Appointment: ", error)
            res.status(500).json({ success: false, message: "Internal Server Error", data: [] });
        }

    },

    async getAllPayments(req, res) {

        const { branch_id, from_date, to_date } = req.query;

        try {
            const getAllPayments = await Payments.findAll({
                include: {
                    model: Appointment,
                    where: { branch_id: branch_id }
                },
                where: { payment_date: { [Op.between]: [from_date, to_date] } }
            })

            if (!getAllPayments.length > 0) {
                return res.status(404).json({
                    success: true,
                    message: "No Payments Yet",
                    data: []
                })
            }
            const data = getAllPayments.map(payment => {
                return ({
                    id: payment.id,
                    user_id: payment.user_id,
                    appointment_id: payment.appointment_id,
                    payment_method: payment.payment_method,
                    payment_date: moment(payment.payment_date).format("DD-MM-YYYY HH:mm"),
                    amount: parseFloat(payment.amount).toFixed(2),
                    status: payment.status === enums.payment_status.succesfull ? "Succesfull" : payment.payment_status === enums.payment_status.failed ? "Failed" : payment.payment_status === enums.payment_status.refunded ? "Refunded" : "Unknown",
                    transaction_id: payment.payment_gateway_transaction_id
                })
            });

            res.status(200).json({
                success: true, message: "OK", data: data
            })
        } catch (error) {
            logger.error("Error fetching payments: ", error)
            res.status(500).json({
                success: false, message: "Internal Server Error", data: []
            })
        }

    }
}
