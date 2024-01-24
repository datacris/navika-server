const mongoose = require("mongoose")
require('dotenv').config({path: '.env'});

const conectarDB = async () => {
    try{
        await mongoose.connect(process.env.DB_MONGO, {
           useNewUrlParser: true,
           useUnifiedTopology: true
        });
        console.log('Mongo DB Connected')
        console.log('******************************************')
    }
    catch(error){
        console.log('DB Errror connection: ', error)
    }
}
module.exports = conectarDB;
