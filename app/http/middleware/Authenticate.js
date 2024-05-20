'use strict';

const jwt = require('jsonwebtoken');
const User = require('../../models/user');
const process = require('process');

module.exports = async (req, res, next) => {
	try {
		// Check if token is provided in headers
		const token = req.headers.authorization.split(' ')[1];
		if (!token) {
			return res.status(401).json({ error: 'Authorization header missing' });
		}

		// Verify token and extract user id
		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		const userId = decoded.userId;

		// Check if user exists
		const user = await User.findByPk(userId);
		if (!user) {
			return res.status(401).json({ error: 'User not found' });
		}

		// Attach user object to request for future use
		req.user = user;

		// Call next middleware or route handler
		next();
	} catch (error) {
		console.error(error);
		res.status(401).json({ error: 'Invalid or expired token' });
	}
};
