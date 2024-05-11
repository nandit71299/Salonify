const nodemailer = require('nodemailer');

function createTransport() {
    return nodemailer.createTransport({
        host: process.env.HOST,
        port: process.env.PORT,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        }
    });
}

module.exports = {
    createTransport
};
