require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express= require("express");
const cors= require("cors");
const port= process.env.PORT || 3000;


const app=express();

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.db_username}:${process.env.db_password}@cluster0.4guptnm.mongodb.net/?appName=Cluster0`;


const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});



app.get('/',(req,res)=>{
    res.send("My server is running on port 3000")
})


async function run(params) {
   try{
    const db= client.db("blood_user");
   

     await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
   } 
   finally{

   }
}
run().catch(console.dir);


app.listen(port,()=>{
    console.log(`my server is running on PORT: ${port}`);
    
})