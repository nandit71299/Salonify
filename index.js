import express from "express";
import bodyParser from "body-parser";
import salonowners from "./routes/salonowners.js";
import salonifycustomers from "./routes/salonifycustomers.js"
import dotenv from "dotenv";
import db from "./database.js";
import { fileURLToPath } from 'url';
import { updateExpiredAppointmentsStatus } from "./scheduler.js";


dotenv.config();
export const app = express();
const port = process.env.port;



app.use(bodyParser.urlencoded({ extended: true, }));

// Index Route
app.get("/", (req, res) => {
    res.render("index.ejs")
})


// app.use('/api/customer/', customerRoutes);

// app.use('/api/salon', salonRoutes);

// app.use('/api/appointment',appointmentRoutes);

// app.use('/api/payment',paymentRoutes);

// app.use('/api/services',serviceRoutes);


app.use('/api/owners', salonowners);

app.use('/api/customers', salonifycustomers);

app.post("/createCategories", async (req, res) => {
    const name = req.body.name;
    const imagePath = req.body.imagePath;
    try {
        const insertCategory = await db.query("INSERT INTO categories (name,image_path) VALUES ($1,$2) RETURNING id", [name, imagePath]);
        res.json(insertCategory.rows[0].id);
    }
    catch (err) {
        console.log(err);
    }

})







app.listen(port, () =>
    console.log("Server is running on port" + port)
)