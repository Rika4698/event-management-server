const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require ('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const port = process.env.PORT||5000;

//middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.i5g3jew.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
     const userCollection = client.db("userDb").collection("users");
     const eventCollection = client.db("eventDb").collection('events');


     //JWT
     

     const verifyToken = (req,res,next) =>{
        const token = req.headers.authorization?.split(' ')[1];
        if(!token)
        {
            const error = res.status(401).json({msg:'Unauthorized'});
            return error;
        }
        try{
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            res.userId = decoded.id;
            next();

        } catch {
            const result = res.status(401).json({msg:'Invalid token'});
            return result;

        }
     };


//Register
   app.post('/api/auth/register', async(req, res) => {
    const {name, photo, email, password} = req.body;
    const existing = await userCollection.findOne({email});
    if(existing){
        const register = res.status(400).json({msg:'Email already registered'});
        return register;
       
    } 
     const hash = await bcrypt.hash(password, 10);
        await userCollection.insertOne({name,photo,email,password:hash});
        res.status(201).json({msg:'User registered'});
   });


   app.post('/api/auth/login', async (req, res) =>{
    const {email, password} = req.body;
    const user = await userCollection.findOne({email});
    if(!user){
        const result = res.status(400).json({msg:'Invalid password'});
        return result;

    }
    const match = await bcrypt.compare(password, user.password);
    if(!match){
        const result = res.status(400).json({msg:'Invalid password'});
        return result;

    }
    const token = jwt.sign({id:user._id}, process.env.JWT_SECRET);
    
    res.json({token, user: {...user, password: undefined}});
   });


 
   //create event
   app.post('/events', verifyToken, async(req, res) =>{
    const{title, description, location, date, time, name,image } = req.body;
     
    const event = {
        title,
        image,
        description,
        location,
        name,
        date,
        time,
        attendeeCount:0,
        createdBy:new ObjectId(req.userId),
        joinedUsers:[],
    };
   const result= await eventCollection.insertOne(event);
    res.send(result);
   })


    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/',(req,res)=>{
    res.send('Event Management Application ')
})

app.listen(port,()=>{

    console.log(`Event Management Application on port ${port}`);
})