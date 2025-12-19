require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const port = process.env.PORT || 5000;

const app = express();

app.use(cors());
app.use(express.json());


const admin = require("firebase-admin");
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf8')
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const verifyFBToken= async(req,res,next)=>{

  const token= req.headers.authorization;

  if(!token){
    return res.status(401).send({message:"unauthorized access"})
  }

  try{
    const idToken= token.split(' ')[1]
    const decoded= await admin.auth().verifyIdToken(idToken)
    console.log("Decoded info", decoded);
    req.decoded_email= decoded.email;
    next();
  }
  catch(error){
     return res.status(401).send({message:"unauthorized access"})
  }
}




const uri = `mongodb+srv://${process.env.db_username}:${process.env.db_password}@cluster0.4guptnm.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.get("/", (req, res) => {
  res.send("My server is running on port 3000");
});

async function run(params) {
  try {
    const db = client.db("blood_user");
    const userCollection = db.collection("user");
    const requestsCollection = db.collection("requests");

    // post data to database
    app.post("/users", async (req, res) => {
      const user = req.body;

      user.role = "donor";

      const result = await userCollection.insertOne(user);
      res.send({
        success: true,
        result,
      });
    });

    // get data from database
    app.get("/users/role/:email", async (req, res) => {
      const { email } = req.params;

      const result = await userCollection.findOne({ email });
      res.send(result);
    });

    // create requests
    app.post("/requests",verifyFBToken,async (req, res) => {
      const data = req.body;

      data.donation_status = "pending";

      const result = await requestsCollection.insertOne(data);
      res.send({
        success: true,
        result,
      });
    });

    // 

    









    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`my server is running on PORT: ${port}`);
});
