const bcrypt = require('bcrypt');
const { User, Saloon, Branch, sequelize } = require('../models');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const logger = require('../config/logger');


module.exports = {
    async login(req, res) {
        try {
            const { email, password } = req.body;

            const user = await User.findOne({ where: { email: email } });
            if (!user) {
                return res.status(404).json({ error: 'Invalid Credentials.' });
            }

            const passwordMatch = await bcrypt.compare(password, user.password);
            if (!passwordMatch) {
                return res.status(401).json({ error: 'Invalid credentials.' });
            }

            const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

            res.status(200).json({ message: 'Login successfully', user, token });
        } catch (error) {
            logger.error("Error occurred during registration:", error);
            res.status(500).json({ error: 'Something Went Wrong.' });
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
            return res.status(400).json({ success: false, message: "Image is required", data: [] });
        }

        const emailAndPhoneNumberExistence = await User.findOne({ where: { email, phone_number: phoneNumber } });

        if (emailAndPhoneNumberExistence) {
            return response.status(409).json({ success: false, message: "A user is already registered with this email address and phone number.", data: [] });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        sequelize.transaction(async (transaction) => {
            try {
                const filePath = path.join(__dirname, '..', 'public', 'salon_images', imageFile.originalname);
                await fs.promises.writeFile(filePath, imageFile.buffer);

                const user = await User.create({
                    name: personalName, phone_number: phoneNumber, email: email, password: hashedPassword, dob: new Date().toLocaleDateString(),
                    user_type: 1, status: 1, designation: 'test', hired_date: new Date().toLocaleDateString()
                }, { transaction, returning: true });
                const saloon = await Saloon.create({ name: salon_name, description: salonDescription, status: 1 }, { transaction, returning: true });
                await Branch.create({ saloon_id: saloon.id, user_id: user.id, name: personalName, city: city, address, type, contact: contact_number, latitude, longitude, seats, isParent: true }, { transaction });

                response.status(201).json({ success: true, message: "Registration successful.", data: [] });
            } catch (error) {
                logger.error("Error occurred during registration:", error);
                response.status(500).json({ error });
            }
        });

    },
};
