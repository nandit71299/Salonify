const { User, sequelize } = require('../models');
const logger = require('../config/logger');
const jwt = require('jsonwebtoken');
const { createTransport } = require('../config/mailer');
const moment = require('moment')

module.exports = {
    async store(request, response) {
        const {
            phone_number,
            email,
        } = request.body;

        const emailAndPhoneNumberExistence = await User.findOne({ where: { email: email, phone_number: phone_number } });
        if (emailAndPhoneNumberExistence) {
            return response.status(409).json({ success: false, message: "A user is already registered with this email address and phone number.", data: [] });
        }

        try {
            await sequelize.transaction(async (transaction) => {
                const otp = await generateRandomFiveDigitNumber();

                const currentTime = new Date();
                currentTime.setMinutes(currentTime.getMinutes() + 10);
                const otpValidity = currentTime.toISOString().slice(0, 19).replace('T', ' ');

                const user = await User.create({ ...request.body, otp: otp, otp_validity: otpValidity }, { transaction });
                const mailOptions = {
                    from: process.env.FROM_EMAIL_USER,
                    to: user.email,
                    subject: 'Verify your email address',
                    html: `Hello ${email} please use below OTP to verify your email address <br>
                    <b style="font-size:42px">${otp}</b>`
                };

                createTransport().sendMail(mailOptions, (error, info) => {
                    if (error) {
                        logger.error("Error sending verification email:", error);
                        response.status(500).json({ success: false, message: 'Error sending verification email' });
                    } else {
                        response.status(201).json({ success: true, message: 'User registered successfully. Please check your email for verification.' });
                    }
                })
            })
        } catch (error) {
            logger.error("Error occurred during registration:", error);
            response.status(500).json({ error });
        }
    },

    async verify(request, response) {
        const { email, otp } = request.body;

        const checkOTP = await User.findOne({ where: { email: email, otp: otp }, attributes: ['id', 'otp', 'otp_validity'] });
        if (!checkOTP) {
            return response.status(409).json({ success: false, message: "Invalid OTP.", data: [] });
        }

        if (checkOTP) {
            const otp_validity = moment(checkOTP.dataValues.otp_validity).format("HH:mm");
            const currentTime = moment().format("HH:mm");
            if (currentTime <= otp_validity) {
                return response.status(200).json({ success: true, message: "Succesfully Verified", data: [checkOTP.dataValues] });
            }
            else {
                return response.status(400).json({
                    success: false,
                    message: "OTP Expired",
                    data: []
                })
            }
        }

    },
};

const generateRandomFiveDigitNumber = async () => {
    const min = 10000;
    const max = 99999;

    const randomNum = Math.floor(Math.random() * (max - min + 1)) + min;

    const user = await User.findOne({ where: { otp: randomNum.toString() } });

    if (user) {
        generateRandomFiveDigitNumber();
    }

    return randomNum.toString();
};
