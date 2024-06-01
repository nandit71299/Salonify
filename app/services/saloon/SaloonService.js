'use strict';

const path = require('path');
const logger = require(path.join(path.dirname(require.main.filename), 'config', 'Logger.js'));
const { Saloon } = require(path.join(path.dirname(require.main.filename), 'app', 'models', 'Saloon.js'));

class SaloonService {
    constructor() {
        this.logger = logger;
    }

    async addNew(saloonData) {
        return await Saloon.create(saloonData);
    }
}

module.exports = SaloonService;
