const bcrypt = require('bcrypt');
const { User, Saloon, Branch, sequelize } = require('../models');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const logger = require('../config/logger');
const { createTransport } = require('../config/mailer');

const moment = require('moment')
moment.tz("Asia/Kolkata");
const enums = require('../enums');


module.exports = {
    async customerLogin(req, res) {
        try {
            const { email, password } = req.body;

            const user = await User.findOne({ where: { email: email, user_type: enums.UserType.customer }, attributes: ['id', 'name', 'email', 'password', 'status'] });
            if (!user) {
                return res.status(404).json({ success: false, message: "Invalid Credentials", data: [] });
            }
            const passwordMatch = await bcrypt.compare(password, user.password);
            if (!passwordMatch) {
                return res.status(401).json({ success: false, message: "Invalid Credentials", data: [] });
            }

            if (user.status === enums.is_active.unverified) {
                const otp = await generateRandomFiveDigitNumber();

                const otpValidity = moment().add(20, "minutes").format();
                await User.update(
                    {
                        otp: otp,
                        otp_validity: otpValidity
                    },
                    {
                        where: {
                            email: email,
                            user_type: enums.UserType.customer,
                            status: enums.is_active.unverified
                        }
                    }
                );
                const mailOptions = {
                    from: process.env.FROM_EMAIL_USER,
                    to: email,
                    subject: 'Verify your email address',
                    html: `Hello ${email} please use below verification OTP < br >
                <b style="font-size:42px">${otp}</b>`
                };

                createTransport().sendMail(mailOptions, (error, info) => {
                    if (error) {
                        logger.error("Error sending verification email:", error);
                        response.status(500).json({ success: false, message: 'Internal Server Error', data: [] });
                    } else {
                        response.status(201).json({
                            success: true, message: `Please enter OTP we sent to ${findUser.email
                                }`, data: [findUser.dataValues], isVerfied: false,
                        });
                    }
                })
                return res.status(200).json({ success: true, message: 'Please Complete Email Verification. OTP for Email verification is sent to your email address', data: user });

            }

            const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

            res.status(200).json({ success: true, message: 'Login Successfull', data: user, token });
        } catch (error) {
            logger.error("Error occurred during registration:", error);
            res.status(500).json({ success: false, message: "Internal Server Error", error: 'error', data: [] });
        }
    },

    async registerSalon(req, res) {

        const {
            //Persoal details
            personalName,
            email,
            phoneNumber,
            //Salon Details
            salon_name,
            contact_number,
            salon_description,
            type,
            seats,
            address,
            location,
            city,
            latitude,
            longitude,
            password,
        } = req.body;

        //Get Image File
        const imageFile = req.file;
        // If no Image file provided. Send Error
        if (!imageFile) {
            return res.status(400).json({ success: false, message: "Image is required", data: [] });
        }
        // If no Invalid file provided. Send Error
        if (imageFile.mimetype !== 'image/jpeg' && imageFile.mimetype !== 'image/png' && imageFile.mimetype !== 'image/jpg') {
            return res.status(400).json({ success: false, message: "Invalid image type. Only JPEG and PNG are allowed.", data: [] });
        }

        // Check if the user email belongs to unverified users?
        const unverifiedUser = await User.findOne({ where: { email, status: enums.is_active.unverified, user_type: enums.UserType.salon_admin } });
        //IF yes ,send error and ask to login
        if (unverifiedUser) {
            return res.status(409).json({
                success: false,
                message: "User already exists, Please login and verify your email address.",
                isVerified: false,
                data: []
            });
        }
        // check if user entered email alreadys exists?
        const checkEmailExistence = await User.findOne({ where: { email } });
        // if yes return with error
        if (checkEmailExistence) {
            return res.status(409).json({ success: false, message: "A user is already registered with this email address.", data: [] });
        }
        // check if user entered phone number already exists?
        const checkPhoneNumberExistence = await User.findOne({ where: { phone_number: phoneNumber } });
        // if yes return with error
        if (checkPhoneNumberExistence) {
            return res.status(409).json({ success: false, message: "A user is already registered with this phone number.", data: [] });
        }


        // hash the password
        const hashedPassword = await bcrypt.hash(password, parseInt(process.env.SALTROUNDS, 10));

        try {
            await sequelize.transaction(async (transaction) => {
                // save the file
                const filePath = path.join(__dirname, '..', 'public', 'salon_images', imageFile.originalname);
                await fs.promises.writeFile(filePath, imageFile.buffer);
                // generate otp
                const otp = await generateRandomFiveDigitNumber();
                // set otp validity
                const otpValidity = moment().add(20, "minutes").format();
                // create user
                const user = await User.create({
                    name: personalName,
                    phone_number: phoneNumber,
                    email,
                    password: hashedPassword,
                    user_type: enums.UserType.salon_admin,
                    status: enums.is_active.unverified,
                    otp: otp,
                    otp_validity: otpValidity,
                }, { transaction }, { returning: true });

                // create entry in salon table
                const salon = await Saloon.create({
                    name: salon_name,
                    user_id: user.id,
                    description: salon_description,
                    status: 1
                }, { transaction });

                // create entry in branch table
                await Branch.create({
                    saloon_id: salon.id,
                    user_id: user.id,
                    name: salon_name,
                    city,
                    address,
                    type,
                    contact: contact_number,
                    latitude,
                    longitude,
                    seats,
                    status: enums.is_active.yes,
                    image: filePath
                }, { transaction });

                // send mail with otp for email verification
                const mailOptions = {
                    from: process.env.FROM_EMAIL_USER,
                    to: email,
                    subject: 'Verify your email address',
                    html: `Hello ${email} please use below verification OTP < br >
                <b style="font-size:42px">${otp}</b>`
                };


                createTransport().sendMail(mailOptions, (error, info) => {
                    if (error) {
                        logger.error("Error sending verification email:", error);
                        response.status(500).json({ success: false, message: 'Internal Server Error', data: [] });
                    } else {
                        response.status(201).json({
                            success: true, message: `Please enter OTP we sent to ${user.email
                                }`, data: [user.dataValues], isVerfied: false,
                        });
                    }
                })

            });
            // if all operations succeeds return with success message
            res.status(201).json({ success: true, message: `Registration successful. Please enter OTP we sent to ${email}.`, data: [] });
        } catch (error) {
            logger.error("Error occurred during registration:", error);
            res.status(500).json({ success: false, message: "Registration failed.", error });
        }
    },

    async updatePassword(req, res) {
        const { otp, password, email } = req.body;

        const checkUser = await User.findOne({ where: { email: email, otp: otp, status: enums.is_active.yes }, attributes: ['id', 'email', 'otp', 'otp_validity'] });
        if (!checkUser) {
            return res.status(404).json({
                success: false,
                message: "400 Bad Request",
                data: []
            })
        }
        else {

            try {
                const otp_validity = moment(checkUser.dataValues.otp_validity).format();
                const currentTime = moment().format();
                if (!(currentTime <= otp_validity)) {
                    return res.status(400).json({
                        success: false,
                        message: "OTP Expired",
                        data: []
                    })
                }
                const encryptedPassword = await bcrypt.hash(password, parseInt(process.env.SALTROUNDS));
                const [affectedRows, [updatedUser]] = await User.update(
                    { password: encryptedPassword },
                    {
                        where: { email: checkUser.dataValues.email },
                        returning: true,
                        attributes: ['id', 'email']
                    }
                );
                if (affectedRows === 0) {
                    return res.status(404).json({
                        success: false,
                        data: [],
                        message: "User not found or OTP has expired"
                    });
                }

                return res.status(200).json({
                    success: true,
                    message: "Password updated successfully",
                    data: updatedUser.dataValues
                });

            } catch (error) {
                logger.error("Error Occured While Updating Password: ", error);
                res.status(500).json({
                    success: false,
                    message: "Internal Server Error",
                    data: [],
                    error: error
                })
            }
        }
    },

    async customerRegistration(request, response) {
        const { email, password, fname, lname, phone_number, dob } = request.body;

        // Validate and format the date of birth
        let formattedDob;
        try {
            formattedDob = moment(dob, "DD-MM-YYYY").format("YYYY-MM-DD");
        } catch (err) {
            return response.status(400).json({ success: false, message: "Invalid date of birth format", data: [] });
        }

        try {
            // Check for existing email
            const emailExistence = await User.findOne({ where: { email, status: enums.is_active.yes } });
            if (emailExistence) {
                return response.status(409).json({ success: false, message: "A user is already registered with this email address", data: [] });
            }

            // Check for existing phone number
            const phoneExistence = await User.findOne({ where: { phone_number, status: enums.is_active.yes } });
            if (phoneExistence) {
                return response.status(409).json({ success: false, message: "A user is already registered with this phone number", data: [] });
            }

            // Check for unverified users
            const unverifiedUser = await User.findOne({ where: { email, status: enums.is_active.unverified, user_type: enums.UserType.customer } });
            if (unverifiedUser) {
                return response.status(409).json({
                    success: false,
                    message: "User already exists, Please login and verify your email address.",
                    isVerified: false,
                    data: []
                });
            }

            // Start a transaction
            await sequelize.transaction(async (transaction) => {
                // Generate OTP and its validity time
                const otp = await generateRandomFiveDigitNumber();
                const otpValidity = moment().add(20, "minutes").toISOString();

                // Encrypt the password
                const encryptedPassword = await bcrypt.hash(password, parseInt(process.env.SALT_ROUNDS, 10));

                // Create the user
                const user = await User.create({
                    name: fname + ' ' + lname,
                    phone_number,
                    email,
                    password: encryptedPassword,
                    dob: formattedDob,
                    otp,
                    otp_validity: otpValidity,
                    user_type: enums.UserType.customer,
                    status: enums.is_active.unverified,
                }, { transaction });

                // Prepare email options
                const mailOptions = {
                    from: process.env.FROM_EMAIL_USER,
                    to: user.email,
                    subject: 'Verify your email address',
                    html: `Hello ${user.name}, please use the OTP below to verify your email address.<br>
                           <b style="font-size:42px">${otp}</b>`
                };


                // Send the email
                createTransport().sendMail(mailOptions, (error, info) => {
                    if (error) {
                        logger.error("Error sending verification email:", error);
                        return response.status(500).json({ success: false, message: 'Error sending verification email', data: [], error });
                    } else {
                        return response.status(201).json({ success: true, message: `Please enter the OTP we sent to ${user.email}`, data: [user.dataValues] });
                    }
                });
            });

        } catch (error) {
            logger.error("Error occurred during registration:", error);
            return response.status(500).json({ success: false, message: "Error occurred during registration", data: [], error });
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
                    User.update({ status: enums.is_active.yes }, { where: { email: email, otp: otp } })
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
            });
        }
        let sendMail = true;
        try {
            await sequelize.transaction(async (transaction) => {
                const otp = await generateRandomFiveDigitNumber();
                const otp_validity = moment().add(20, "minutes").format();

                await User.update(
                    { otp: otp, otp_validity: otp_validity },
                    {
                        where: { email: email },
                        transaction // Add the transaction object here
                    }
                );

                const mailOptions = {
                    from: process.env.FROM_EMAIL_USER,
                    to: findUser.email,
                    subject: 'Verify your email address',
                    html: `Hello ${findUser.email}, please use the below verification OTP <br>
                           <b style="font-size:42px">${otp}</b>`
                };
                sendMail = await new Promise((resolve, reject) => {
                    createTransport().sendMail(mailOptions, (error, info) => {
                        if (error) {
                            logger.error("Error sending verification email:", error);
                            resolve(false);
                        } else {
                            resolve(true);
                        }
                    });
                });
            })
            if (sendMail) {
                response.status(201).json({
                    success: true,
                    message: `Please enter OTP we sent to ${findUser.email}`,
                    data: [findUser.dataValues]
                });
            } else {
                console.log(sendMail)
                response.status(500).json({ success: false, message: 'Error sending verification email', data: [] });
            }
        } catch (error) {
            logger.error("Error Sending OTP:", error);
            return response.status(500).json({
                success: false,
                message: "Internal Server Error",
                data: []
            });
        }
    },



    async salonLogin(req, res) {
        try {
            const { email, password } = req.body;

            const user = await User.findOne({ where: { email: email, user_type: enums.UserType.salon_admin }, attributes: ['id', 'name', 'email', 'password', 'status'] });
            if (!user) {
                return res.status(404).json({ success: false, message: "Invalid Credentials", data: [] });
            }
            const passwordMatch = await bcrypt.compare(password, user.password);
            if (!passwordMatch) {
                return res.status(401).json({ success: false, message: "Invalid Credentials", data: [] });
            }

            if (user.status === enums.is_active.unverified) {
                const otp = await generateRandomFiveDigitNumber();

                const otpValidity = moment().add(20, "minutes").format();
                await User.update(
                    {
                        otp: otp,
                        otp_validity: otpValidity
                    },
                    {
                        where: {
                            email: email,
                            user_type: enums.UserType.salon_admin,
                            status: enums.is_active.unverified
                        }
                    }
                );
                const mailOptions = {
                    from: process.env.FROM_EMAIL_USER,
                    to: user.email,
                    subject: 'Verify your email address',
                    html: `Hello ${user.name}, please use below verification OTP <br>
                    <b style="font-size:42px">${otp}</b>`
                };

                createTransport().sendMail(mailOptions, (error, info) => {
                    if (error) {
                        logger.error("Error sending verification email:", error);
                        return res.status(500).json({ success: false, message: 'Internal Server Error', data: [] });
                    } else {
                        return res.status(200).json({
                            success: true,
                            message: 'Please Complete Email Verification. OTP for Email verification is sent to your email address',
                            data: user
                        });
                    }
                });
                return;
            }
            const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

            res.status(200).json({ success: true, message: 'Login Successfull', data: user, token });
        }
        catch (error) {
            logger.error("Error occurred during registration:", error);
            return response.status(500).json({ success: false, message: "Error occurred during registration", data: [], error });
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
