const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const port = process.env.PORT || 5000;


app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('server is running');
})


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mi7otul.mongodb.net/?retryWrites=true&w=majority`;


const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {

    await client.connect();

    const classCollection = client.db("summerSchool").collection("class");
    const mySelectedClass = client.db("summerSchool").collection("myClass");

    app.get('/class', async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    })

    app.get('/mySelectedClass', async (req, res) => {
      const email = req.query.email;
      if (!email) {
          res.send([]);
      };

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
          return res.status(403).send({ error: true, message: 'forbidden access' })
      };

      const query = { email: email };

      const result = await mySelectedClass.find(query).toArray();
      res.send(result)
  });

    app.post('/mySelectedClass', async(req, res) => {
      const SelectedClass = req.body;
      const result = await mySelectedClass.insertOne(SelectedClass);
      res.send(result)
    })



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.listen(port, () => {
  console.log(`server is running port ${port}`)
})