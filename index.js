const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);
require('dotenv').config();
const port = process.env.PORT || 5000;

console.log(process.env.PAYMENT_SECRET_KEY)


app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('server is running');
})

const verifyJwt = (req, res, next) => {
  console.log(req.headers.authorization)
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' })
  }
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' });
    }

    req.decoded = decoded;
    next();
  })
}

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
    const paymentCollection = client.db("summerSchool").collection("payment");
    const userCollection = client.db("summerSchool").collection("user");

    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res.send({ token })

    })

    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== 'instructor') {
        return res.status(403).send({ error: true, message: 'forbidden message' })
      }
      next();
    }

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message' })
      }
      next();
    }

    app.get('/class', async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    })

    app.get('/mySelectedClass', verifyJwt, async (req, res) => {
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

    app.get('/myAddClass', verifyJwt, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      };

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: 'forbidden access' })
      };

      const query = { email: email };

      const result = await classCollection.find(query).toArray();
      res.send(result)
    });

    app.get('/user',verifyJwt, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    })

    app.post('/mySelectedClass', async (req, res) => {
      const SelectedClass = req.body;
      const result = await mySelectedClass.insertOne(SelectedClass);
      res.send(result)
    })

    app.post('/create-payment-intent', verifyJwt, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })

    app.post('/payments', verifyJwt, async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentCollection.insertOne(payment);

      const query = {
        $in: payment.cartItems.map(id => new ObjectId(id))
      }

      const deleteResult = await mySelectedClass.deleteMany(query);
      res.send({ insertResult, deleteResult });
    })


    app.post('/addClass', verifyJwt, async (req, res) => {
      const classItem = req.body;
      const result = await classCollection.insertOne(classItem);
      res.send(result);
    });

    app.post('/user', async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'already exists', error: true })
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    })

    app.patch('/updateClassStatus/admin/:id', verifyJwt, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateStatus = req.body;
      // console.log(updateStatus.status)
      const updateDoc = {
        $set: {
          status: updateStatus.status
        },
      };

      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    })
    app.patch('/updateRole/admin/:id', verifyJwt, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateRole = req.body;
      const updateDoc = {
        $set: {
          role: updateRole.role
        },
      };

      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    })



    app.delete('/mySelectedClass/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) };
      const result = await mySelectedClass.deleteOne(query);
      res.send(result);
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