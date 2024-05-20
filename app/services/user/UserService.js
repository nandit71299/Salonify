'use strict';


const path = require('path');
const logger = require(path.join(path.dirname(require.main.filename), 'config', 'Logger.js'));
const { User } = require(path.join(path.dirname(require.main.filename), 'app', 'models', 'User.js'));

class UserService {
    constructor() {
        this.logger = logger;
    }

    async getUserByEmailAndPhoneNumber(phoneNumber, email) {
        return await User.findOne({ where: { email, phone_number: phoneNumber } });
    }

    async checkTheOtpDoesExist(otp) {
        return await User.findOne({ where: { otp }});
    }

    async createUser(userData) {
        return await User.create(userData, {returning: true});
    }

    async checkValidUserIdOtp(userId, otp) {
        return await User.findOne({ where: { otp, id: userId }, attributes: ['id', 'otp', 'otp_validity'] });
    }

    async getUserById(userId) {
        return await User.findOne({
            where: {
                id: userId
            },
            attributes: [
                'id',
                'name',
                'phone_number',
                'email',
                'date_of_birth',
                'user_type',
                'status',
                'otp',
                'otp_validity',
                'is_verified'
            ]
        });
    }

    async verifyUser(userId) {
        const user =  await User.findOne({ where: { id: userId }, attributes: ['id', 'is_verified'] });

        await user.update(
            {
                is_verified: 1,
            }
        )
    }

    async updatePassword(user, userData) {
        await user.update(userData)
    }

    async updateOtpAndOtpValidity(user, userData) {
        await user.update(userData)
    }
}

module.exports = UserService;
