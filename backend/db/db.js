import mongoose from 'mongoose';

function connect() {
    mongoose.connect(process.env.DATABASE_URL)
        .then(() => {
            console.log("Connected to MongoDB");
        })
        .catch(err => {
            console.log(err);
        })
}

export default connect;
