'use strict'

class RegisteredUser {
    constructor(user) {
        this.user = user;
    }

    toArray() {
        return {
            id: this.user.id,
            name: this.user.name,
            email: this.user.email,
            phone_number: this.user.phone_number,
        };
    }
}

module.exports = RegisteredUser;
