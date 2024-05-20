const bcrypt = require('bcrypt');
const { User, Saloon, Branch, sequelize } = require('../models');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const logger = require('../config/logger');
const multer = require('multer');
const moment = require('moment')
moment.tz("Asia/Kolkata");

module.exports = {
    async login(req, res) {
        try {
            const { email, password } = req.body;

            const user = await User.findOne({ where: { email: email } });
            if (!user) {
                return res.status(404).json({ success: false, message: "Invalid Credentials", data: [], error: "Invalid Credentials" });
            }

            const passwordMatch = await bcrypt.compare(password, user.password);
            if (!passwordMatch) {
                return res.status(401).json({ success: false, message: "Invalid Credentials", data: [], error: "Invalid Credentials" });
            }

            const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

            res.status(200).json({ message: 'Login Successfull', user, token });
        } catch (error) {
            logger.error("Error occurred during registration:", error);
            res.status(500).json({ success: false, message: "Internal Server Error", error: 'error', data: [] });
        }
    },

    async register(request, response) {
        const {
            email,
            password,
            personalName,
            phoneNumber,
            dob,
            salon_name,
            contact_number,
            salonDescription,
            location,
            address,
            type,
            seats,
            image,
            city,
            latitude,
            longitude
        } = request.body;

        const imageFile = request.file;

        if (!imageFile) {
            return response.status(400).json({ success: false, message: "Image is required", data: [] });
        }

        const checkEmailExistence = await User.findOne({ where: { email: email } });
        if (checkEmailExistence) {
            return response.status(409).json({ success: false, message: "A user is already registered with this email address or phone number.", data: [] });
        }

        const checkPhoneNumberExistence = await User.findOne({ where: { phone_number: phoneNumber } });
        if (checkPhoneNumberExistence) {
            return response.status(409).json({ success: false, message: "A user is already registered with this email address or phone number.", data: [] });
        }

        const hashedPassword = await bcrypt.hash(password, parseInt(process.env.SALTROUNDS));

        sequelize.transaction(async (transaction) => {
            try {

                const filePath = path.join(__dirname, '..', 'public', 'salon_images', imageFile.originalname);
                await fs.promises.writeFile(filePath, imageFile.buffer);

                const user = await User.create({
                    name: personalName, phone_number: phoneNumber, email: email, password: hashedPassword, dob: new Date().toLocaleDateString(),
                    user_type: 1, status: 1, designation: 'test', hired_date: new Date().toLocaleDateString()
                }, { transaction, returning: true });
                const saloon = await Saloon.create({ name: salon_name, description: salonDescription, status: 1 }, { transaction, returning: true });

                const branch = await Branch.create({ saloon_id: saloon.id, user_id: user.id, name: personalName, city: city, address: address, type: type, contact: contact_number, latitude: latitude, longitude: longitude, seats: seats, status: 1, isParent: true, image: filePath }, { transaction, returning: true });
                response.status(201).json({ success: true, message: "Registration successful.", data: [] });
            } catch (error) {
                logger.error("Error occurred during registration:", error);
                response.status(500).json({ error });
            }
        });

    },

    async updatePassword(req, res) {
        const { otp, password, email } = req.body;

        const checkUser = await User.findOne({ where: { email: email, otp: otp }, attributes: ['id', 'email', 'otp', 'otp_validity'] });
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
    }


};
