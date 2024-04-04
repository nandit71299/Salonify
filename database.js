import pg from "pg";
import dotenv from "dotenv";


dotenv.config();

export const db =  new pg.Client({
    database : process.env.database,
    user : process.env.dbuser,
    password:process.env.dbpassword,
    host:process.env.dbhost,
    port:process.env.dbport,
  })

db.connect();

export default db;