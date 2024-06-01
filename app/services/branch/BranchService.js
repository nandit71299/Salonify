'use strict';

const path = require('path');
const logger = require(path.join(path.dirname(require.main.filename), 'config', 'Logger.js'));
const { Branch } = require(path.join(path.dirname(require.main.filename), 'app', 'models', 'Branch.js'));

class BranchService {
    constructor() {
        this.logger = logger;
    }

    async addNew(branchData) {
        return await Branch.create(branchData);
    }
}

module.exports = BranchService;
