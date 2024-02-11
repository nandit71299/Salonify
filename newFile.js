import { app, db } from ".";

app.get("/salon/:salon_id/customers", async (req, res) => {

    const salon_id = req.params.salon_id;

    try {
        const result = await db.query("SELECT DISTINCT c.customer_id, c.email, c.phone_number FROM customer c JOIN appointment b ON c.customer_id = b.customer_id JOIN salon s ON b.salon_id = s.salon_id WHERE s.salon_id = $1;", [salon_id]);
        if (result.rowCount > 0) {
            res.send(result.rows);
        } else {
            res.send({ message: "No customers yet..." });
        }
    } catch (error) {
        console.log(error);
    }
});
