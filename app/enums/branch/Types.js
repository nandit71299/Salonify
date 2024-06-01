'use strict';

const BRANCH_TYPES = {
    UNISEX: 1,
    LADDIES: 2,
    GENTS: 3
};

function getBranchTypes() {
    return Object.values(BRANCH_TYPES);
}

function getKeyBranchTypes() {
    return Object.keys(BRANCH_TYPES);
}


function getBranchTypeByValue(typeId) {
    for (const [key, value] of Object.entries(BRANCH_TYPES)) {
        if (value === typeId) {
            return key;
        }
    }

    return null;
}

module.exports = { BRANCH_TYPES, getBranchTypes, getBranchTypeByValue, getKeyBranchTypes };
