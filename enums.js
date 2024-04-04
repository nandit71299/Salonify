const EmployeeType = {
    owner: 1,
    employee: 2,
    hairstylist: 3
}

const UserType = {
    customer: 1,
    salon_admin: 2,
}

const is_active = {
    yes: 1,
    no: 0,
}

const appointmentType = {
    Pending_Payment_Confirmation: 1,
    Confirmed: 2,
    Partially_Paid: 3,
    Closed: 4,

}

const advance_payment_type = {
    regular: 1,
    offer: 2
}

const advance_payment_amount_type = {
    percentage: 1,
    fixed: 2
}

const salon_type = {
    unisex: 1,
    mens: 2,
    womens: 3
}
export { EmployeeType, UserType, is_active, appointmentType, salon_type };