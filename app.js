require('dotenv').config();

const express = require('express');
const app = express();
const routes = require('./routes/apis');

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);

app.listen(3000, () => { });


