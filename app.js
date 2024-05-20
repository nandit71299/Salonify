'use strict';

require('dotenv').config();

const express = require('express');
const app = express();
const adminRoutes = require('./routes/AdminRoute');

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.use('/api', adminRoutes);

app.listen(3000, () => {});
