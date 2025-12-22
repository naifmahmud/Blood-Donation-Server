require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.STRIPE_KEY);
const crypto = require("crypto");

const app = express();

app.use(cors());
app.use(express.json());

const admin = require("firebase-admin");
const { url } = require("inspector");
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString(
  "utf8"
);
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const verifyFBToken = async (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  try {
    const idToken = token.split(" ")[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    console.log("Decoded info", decoded);
    req.decoded_email = decoded.email;
    next();
  } catch (error) {
    return res.status(401).send({ message: "unauthorized access" });
  }
};

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
    const fundCollection =db.collection("funding")

    // post data to database
    app.post("/users", async (req, res) => {
      const user = req.body;

      user.role = "donor";
      user.user_status = "active";

      const result = await userCollection.insertOne(user);
      res.send({
        success: true,
        result,
      });
    });

    // All users
    app.get("/users", verifyFBToken, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // get data from database
    app.get("/users/role/:email", async (req, res) => {
      const { email } = req.params;

      const result = await userCollection.findOne({ email });
      res.send(result);
    });

    // Update user
    app.patch("/update/user/profile",async(req,res)=>{
      const {email, ...editData}=req.body;
      const filter= {email};

      console.log(editData)
      

      const result= await userCollection.updateOne(filter,{$set:editData});
      res.send({
        success:true,
        result
      })
    })

    app.patch("/update/user/status", verifyFBToken, async (req, res) => {
      const { email, status } = req.query;
      const query = { email: email };

      const updateStatus = {
        $set: {
          user_status: status,
        },
      };
      const result = await userCollection.updateOne(query, updateStatus);
      res.send(result);
    });

    // create requests
    app.post("/requests", verifyFBToken, async (req, res) => {
      const data = req.body;

      data.donation_status = "pending";

      const result = await requestsCollection.insertOne(data);
      res.send({
        success: true,
        result,
      });
    });

    // get all blood requests
    app.get('/allRequests',async(req,res)=>{
      const result= await requestsCollection.find({donation_status
:'pending'}).toArray();
      res.send(result);
    })

    // Find on blood request by id
    app.get('/allRequests/:id',async(req,res)=>{
      const id= req.params.id;
      const query= {'_id':new ObjectId(id)};
      const result=await requestsCollection.findOne(query);
      res.send({
        success:true,
        result
      })
    })

    // update donation status
    app.patch('/allRequests/:id/donation',async(req,res)=>{
      const id= req.params.id;
      const {requester_email,requester_name}=req.body;
      const query={'_id':new ObjectId(id)}
      const update={
        $set:{
            donation_status:"inprogress",
            requester_email,
            requester_name
          }
      }

      const result= await requestsCollection.updateOne(query,update)

      res.send({
        success:true,
        result
      })
    })

    // my requests
    app.get("/myRequests", verifyFBToken, async (req, res) => {
      const email = req.decoded_email;
      const size = Number(req.query.size);
      const page = Number(req.query.page);

      const query = { requester_email: email };
      const result = await requestsCollection
        .find(query)
        .limit(size)
        .skip(size * page)
        .toArray();

      const totalRequest = await requestsCollection.countDocuments(query);

      res.send({ request: result, totalRequest });
    });

    // payments
    app.post("/create-payment-checkout", async (req, res) => {
      const info = req.body;
      const amount = parseInt(info.donateAmout) * 100;

      const session = await stripe.checkout.sessions.create({
        
        line_items: [
          {
            price_data:{
              currency:'usd',
              unit_amount: amount,
              product_data: {
                name: 'Please Donate'
              }
            },
            quantity:1,
          },
        ],
        mode: "payment",
        metadata:{
          donorName: info?.donorName
        },
        customer_email:info?.donorEmail,

        success_url:`${process.env.SITE_DOMAIN}/payment_success?session_id={CHECKOUT_SESSION_ID}`,

        cancel_url: `${process.env.SITE_DOMAIN}/payment_canceled`,
      });

      res.send({url: session.url})
    });


    app.get('/search',async(req,res)=>{
      const {bloodGroup,district,upazila}=req.query;
      
      const query={};

      if(!query) {
        return
      }
      if(bloodGroup){
        query.bloodgroup= bloodGroup;
      }
      if(district){
        query.
recipient_district=district;
      }
      if(upazila){
        query.recipient_upazila=upazila;
      }
      
      // console.log(query);
      const result= await requestsCollection.find(query).toArray();
      res.send(result);
      
      
    })



    // payment success
    app.post('/success-payment',async(req,res)=>{
      const {session_id}= req.query;
      const session = await stripe.checkout.sessions.retrieve(session_id);

      console.log(session);

      const transectionId= session.payment_intent;

      const isPaymentExist= await fundCollection.findOne({transectionId})

      if(isPaymentExist){
        return
      }


      if(session.payment_status == 'paid'){
        const paymentInfo={
          amount:session.amount_total/100,
          currency:session.currency,
          donorEmail:session.customer_email,
          transectionId,
          payment_status: session.payment_status,
          paidAt: new Date() 

        }
        const result= await fundCollection.insertOne(paymentInfo);
        return res.send(result);
      }
      

    })

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
