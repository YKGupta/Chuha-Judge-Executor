import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.DB_URI);
let db;

const connectToDB = async () => {
    try
    {
        await client.connect();
        db = client.db();
        console.log(`Connected to Database(${process.env.DB_URI})`);
    }
    catch(e)
    {
        console.log(`Encountered error while connecting to database: ${JSON.stringify(err)}`);
    }
};

export { connectToDB, db };