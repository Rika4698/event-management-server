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
            req.userId = decoded.id;
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


  // get all events by filter
  app.get('/events', async(req,res) =>{
    const{search, date, range} = req.query;
    const query = {};
    
    if(search){
        query.title = {$regex:search, $options:'i'};

    }

    const formatDate = (d) => d.toISOString().slice(0, 10);

  const now = new Date();

  // Calculate start/end dates without mutating the same object repeatedly
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const startOfLastWeek = new Date(startOfWeek);
  startOfLastWeek.setDate(startOfWeek.getDate() - 7);
  const endOfLastWeek = new Date(startOfWeek);
  endOfLastWeek.setDate(startOfWeek.getDate() - 1);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  // Convert to strings YYYY-MM-DD because your events store date separately
  const todayStr = formatDate(now);
  const startOfWeekStr = formatDate(startOfWeek);
  const endOfWeekStr = formatDate(endOfWeek);
  const startOfLastWeekStr = formatDate(startOfLastWeek);
  const endOfLastWeekStr = formatDate(endOfLastWeek);
  const startOfMonthStr = formatDate(startOfMonth);
  const endOfMonthStr = formatDate(endOfMonth);
  const startOfLastMonthStr = formatDate(startOfLastMonth);
  const endOfLastMonthStr = formatDate(endOfLastMonth);

  if (range === 'today') {
    query.date = todayStr; // exact match on date string
  } else if (range === 'current-week') {
    query.date = { $gte: startOfWeekStr, $lte: endOfWeekStr };
  } else if (range === 'last-week') {
    query.date = { $gte: startOfLastWeekStr, $lte: endOfLastWeekStr };
  } else if (range === 'current-month') {
    query.date = { $gte: startOfMonthStr, $lte: endOfMonthStr };
  } else if (range === 'last-month') {
    query.date = { $gte: startOfLastMonthStr, $lte: endOfLastMonthStr };
  }

     if (date) {
  query.date = date;
}

      const events = await eventCollection
        .find(query)
        .sort({ date:-1, time: -1 })
        .toArray();

    res.send(events);

  })

  app.get("/events-limited", async (req, res) => {
  try {
    const events = await eventCollection
      .find({})
      .sort({ date: -1 }) // latest first
      .limit(4)
      .toArray();
    res.send(events);
  } catch (error) {
    res.status(500).send({ message: "Error fetching events", error });
  }
});

//join event
  app.post('/join/:id', verifyToken, async(req,res) => {
    const id = req.params.id;
    const userId = req.userId;

    const event = await eventCollection.findOne({_id:new ObjectId(id)});

    if(!event){
      const result = res.status(404).json({message:"Event not found"});
      return result;
    }

    if(event.joinedUsers.includes(userId)){
      return res.status(400).json({message: "Already joined"});
    }

    const result = await eventCollection.updateOne(
      {_id:new ObjectId(id)},
      {

        $inc:{attendeeCount:1},
        $push:{joinedUsers:userId},
      }
    );
    res.send(result);
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
   });

   //even id
   app.get("/event/:id", verifyToken, async (req, res) => {
  try {
    const id = req.params.id;
   
    const event = await eventCollection.findOne({ _id: new ObjectId(id) });

    if (!event) {
      return res.status(404).json({ message: "Not Found" });
    }
    res.json(event);
  } catch (err) {
    res.status(500).json({ message: "Error", err });
  }
});

//my event
   app.get('/my-events/:userId', verifyToken, async (req, res) => {
  const userId = req.params.userId;

  try {
    const myEvents = await eventCollection
      .find({ createdBy:new ObjectId(req.userId) }) 
      .sort({ date: -1, time: -1 })
      .toArray();

    res.send(myEvents);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});


//update
app.put('/event/:id',verifyToken, async(req,res)=>{
  const id = req.params.id;
  const updated = req.body;

  const result = await eventCollection.updateOne(
    {_id: new ObjectId(id)},
    {
      $set:{
        title:updated.title,
        description:updated.description,
        name:updated.name,
        image:updated.image,
        location:updated.location,
        date:updated.date,
        time:updated.time,


      },
    }
  );
  res.send(result);
});


app.delete('/event/:id',verifyToken, async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const result = await eventCollection.deleteOne(filter);
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