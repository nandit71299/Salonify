const { User, sequelize } = require('../models');
const logger = require('../config/logger');
const jwt = require('jsonwebtoken');
const { createTransport } = require('../config/mailer');
const moment = require('moment')
const bcrypt = require('bcrypt');

moment.tz("Asia/Kolkata")

module.exports = {
    async store(request, response) {
        const {
            email,
            password,
            fname,
            lname,
            phone_number,
        } = request.body;

        let dob = request.body.dob;
        dob = moment(dob, "DD-MM-YYYY").format("YYYY-MM-DD")

        const emailExistence = await User.findOne({ where: { email: email } });
        if (emailExistence) {
            return response.status(409).json({ success: false, message: "A user is already registered with this email address", data: [] });
        }
        const phoneExistence = await User.findOne({ where: { phone_number: phone_number } });
        if (phoneExistence) {
            return response.status(409).json({ success: false, message: "A user is already registered with this phone number", data: [] });
        }

        try {
            await sequelize.transaction(async (transaction) => {
                //generate otp
                const otp = await generateRandomFiveDigitNumber();
                //generate otp validity time
                const otpValidity = moment().add(20, "minutes").format();


                const encryptedPassword = await bcrypt.hash(password, parseInt(process.env.saltRounds));


                const user = await User.create({ name: fname + " " + lname, email: email, phone_number: phone_number, email: email, password: encryptedPassword, otp: otp, otp_validity: otpValidity, user_type: 1, status: 1, created_at: moment().format(), date_of_birth: dob, }, { transaction });

                const mailOptions = {
                    from: process.env.FROM_EMAIL_USER,
                    to: user.email,
                    subject: 'Verify your email address',
                    html: `Hello ${email} please use below OTP to verify your email address. <br>
                    <b style="font-size:42px">${otp}</b>`
                };

                createTransport().sendMail(mailOptions, (error, info) => {
                    if (error) {
                        logger.error("Error sending verification email:", error);
                        response.status(500).json({ success: false, message: 'Error sending verification email', data: [], error: error });
                    } else {
                        response.status(201).json({ success: true, message: `Please enter OTP we sent to ${user.email}`, data: [user.dataValues] });
                    }
                })
            })
        } catch (error) {
            logger.error("Error occurred during registration:", error);
            response.status(500).json({ success: false, message: "Error occured during registration", data: [], error: error });
        }
    },

    async verify(request, response) {
        const { email, otp } = request.body;

        const checkOTP = await User.findOne({ where: { email: email, otp: otp }, attributes: ['id', 'otp', 'otp_validity'] });
        if (!checkOTP) {
            return response.status(409).json({ success: false, message: "Invalid OTP.", data: [] });
        }

        try {
            const data = checkOTP.dataValues;
            if (data) {
                const otp_validity = moment(checkOTP.dataValues.otp_validity).format();
                const currentTime = moment().format();
                if (currentTime <= otp_validity) {
                    return response.status(200).json({ success: true, message: "Succesfully Verified", data: [{ id: data.id, otp: data.otp, otp_validity: moment(data.otp_validity).format() }] });
                }
                else {
                    return response.status(400).json({
                        success: false,
                        message: "OTP Expired",
                        data: []
                    })
                }
            }
        } catch (error) {
            logger.error("Error Verifying User:", error);
            response.status(500).json({
                success: false,
                message: "Internal Server Error",
                error: error,
                data: []
            })
        }
    },

    async sendOtp(request, response) {
        const { email } = request.body;

        const findUser = await User.findOne({ where: { email: email }, attributes: ['id', 'email'] });

        if (!findUser) {
            return response.status(404).json({
                success: false,
                data: [],
                message: "User not found"
            })
        }

        try {
            await sequelize.transaction(async (transaction) => {
                const otp = await generateRandomFiveDigitNumber();
                const otp_validity = moment().add(20, "minutes").format();
                const updateUser = await User.update(
                    { otp: otp, otp_validity: otp_validity },
                    {
                        where: {
                            email: email,
                        },
                    }, { transaction }
                );

                const mailOptions = {
                    from: process.env.FROM_EMAIL_USER,
                    to: findUser.email,
                    subject: 'Verify your email address',
                    html: `Hello ${findUser.email} please use below verification OTP < br >
                <b style="font-size:42px">${otp}</b>`
                };

                createTransport().sendMail(mailOptions, (error, info) => {
                    if (error) {
                        logger.error("Error sending verification email:", error);
                        response.status(500).json({ success: false, message: 'Error sending verification email', data: [], error: error });
                    } else {
                        response.status(201).json({
                            success: true, message: `Please enter OTP we sent to ${findUser.email
                                }`, data: [findUser.dataValues]
                        });
                    }
                })
            })
        }
        catch (error) {
            logger.error("Error Sending OTP:", error);
            response.status(500).json({
                success: false,
                message: "Internal Server Error",
                error: error,
                data: []
            })
        }


    }

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
