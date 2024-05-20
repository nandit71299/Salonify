'use strict';

const path = require('path');
const bcrypt = require('bcrypt');
const process = require('process');
const logger = require(path.join(path.dirname(require.main.filename), 'config', 'Logger.js'));
const { createTransport } = require(path.join(path.dirname(require.main.filename), 'config', 'Mailer.js'));
const RegisteredUser = require(path.join(path.dirname(require.main.filename), 'app', 'resource', 'user', 'RegisteredUser.js'))

class UserController {
    constructor(UserService) {
        this.UserService = UserService;
    }

    async store(request, response) {
        try {
            const emailAndPhoneNumberExistence =  await this.UserService.getUserByEmailAndPhoneNumber(request.body.phone_number, request.body.email);


            if (emailAndPhoneNumberExistence) {
                throw new Error('A user is already registered with this email address and phone number.');
            }

            const otp = await this.generateRandomFiveDigitNumber();
            const currentTime = new Date();
            currentTime.setMinutes(currentTime.getMinutes() + 10);
            const otpValidity = currentTime.toISOString().slice(0, 19).replace('T', ' ');

            const userData = {...request.body, otp, otp_validity: otpValidity};

            const user = await this.UserService.createUser(userData);

            const mailOptions = {
                from: process.env.FROM_EMAIL_USER,
                to: request.body.email,
                subject: 'Verify your email address',
                text: ''
            };

            createTransport().sendMail(mailOptions, (error) => {
                if (error) {
                    logger.error('Error sending verification email:', error);
                    throw new Error('Error sending verification email');
                }
            });

            return response.status(201).json({
                success: true,
                message: 'User registered successfully. Please check your email for verification.',
                data: new RegisteredUser(user).toArray(),
            });
        } catch (error) {
            logger.error('Error occurred during registration:', error);
            response.status(500).json({ error: error.message });
        }
    }

    async verify(request, response) {
        try {
            const body = request.body;
            const checkOTP = await this.UserService.checkValidUserIdOtp(body.user_id, body.otp);

            if (!checkOTP) {
                throw new Error('Invalid OTP provided. Please provide a valid OTP.');
            }

            const currentTime = new Date();
            const otpValidityTime = new Date(checkOTP.otp_validity);

            if (currentTime.getTime() > otpValidityTime.getTime()) {
                throw new Error('Invalid OTP provided. Please provide a valid OTP.');
            }

            this.UserService.verifyUser(body.user_id);

            response.status(200).json({
                success: true,
                message: 'OTP verified successfully.'
            });
        } catch (error) {
            logger.error('Error occurred during OTP verification:', error);
            response.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async resendOtp(request, response) {
        try {
            const body = request.body;

            const user = await this.UserService.getUserById(body.user_id);

            const otp = await this.generateRandomFiveDigitNumber();
            const currentTime = new Date();
            currentTime.setMinutes(currentTime.getMinutes() + 10);
            const otpValidity = currentTime.toISOString().slice(0, 19).replace('T', ' ');

            const userData = {
                id: body.user_id,
                otp: otp,
                otp_validity: otpValidity,
            }

            this.UserService.updateOtpAndOtpValidity(user, userData);

            const mailOptions = {
                from: process.env.FROM_EMAIL_USER,
                to: user.email,
                subject: 'Verify your email address',
                text: ''
            };

            createTransport().sendMail(mailOptions, (error) => {
                if (error) {
                    logger.error('Error sending verification email:', error);
                    throw new Error('Error sending verification email');
                }
            });

            response.status(200).json({
                success: true,
                message: 'OTP Resend is Successfully.'
            });
        } catch (error) {
            logger.error('Error occurred during OTP verification:', error);
            response.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async updatePassword(request, response) {
        try {
            const body = request.body;

            const user = await this.UserService.getUserById(body.user_id);

            if (!user.is_verified) {
                throw new Error('User Is Not Verified. Please Try Again.');
            }

            const hashedPassword = await bcrypt.hash(body.password, 12);

            this.UserService.updatePassword(user, {password: hashedPassword});

            response.status(200).json({
                success: true,
                message: 'Password Update Successfully.'
            });
        } catch (error) {
            logger.error('Error occurred during OTP verification:', error);
            response.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async generateRandomFiveDigitNumber() {
        let randomNum;
        let attempts = 0;
        const maxAttempts = 1000;

        while (attempts < maxAttempts) {
            randomNum = Math.floor(Math.random() * 90000) + 10000; // Generates a number between 10000 and 99999
            const doesExist = await this.UserService.checkTheOtpDoesExist(randomNum.toString());

            if (!doesExist) {
                return randomNum.toString();
            }

            attempts++;
        }

        throw new Error('Unable to generate a unique OTP after maximum attempts.');
    }
}

module.exports = UserController;
