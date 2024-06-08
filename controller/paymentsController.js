const bcrypt = require('bcrypt');
const { User, Saloon, Branch, Appointment, sequelize } = require('../models');
const logger = require('../config/logger');
const { createTransport } = require('../config/mailer');
const enums = require('../enums');
const moment = require('moment')
moment.tz("Asia/Kolkata");


module.exports = {

    async confirmAppointment(req, res) {
        // its just a mock api
        const { receipt } = req.body;

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
                status: 2
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

    }
}
