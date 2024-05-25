'use strict';

require('dotenv').config();

const moment = require('moment-timezone');
moment.tz('Asia/Kolkata');
global.moment = moment;

const express = require('express');
const app = express();
const adminRoutes = require('./routes/AdminRoute');

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.use('/api', adminRoutes);

app.listen(3000, () => {});
