const express = require('express');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const cors = require('cors');
const port = process.env.PORT || 5000;

// middleware

app.use(cors())
app.use(express.json())



const uri = `mongodb+srv://${process.env.USER_DB}:${process.env.USER_PASS}@cluster0.euq4zn2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
        // Send a ping to confirm a successful connection

        const menuCollection = client.db("bistroRestaurantCollection").collection("menu")

        const reviewsCollection = client.db("bistroRestaurantCollection").collection("reviews")

        const cartsCollection = client.db("bistroRestaurantCollection").collection("carts")

        app.get("/menu", async (req, res) => {
            const result = await menuCollection.find().toArray()
            res.send(result)
        })

        app.get("/reviews", async (req, res) => {
            const result = await reviewsCollection.find().toArray()
            res.send(result)
        })

        // cart collection

        app.get("/carts", async (req, res) => {
            const email = req.query.email;
            const query = { userEmail: email }
            const result = await cartsCollection.find(query).toArray()
            res.send(result)
        })

        app.post('/carts', async (req, res) => {
            const cartItem = req.body;
            const result = await cartsCollection.insertOne(cartItem);
            res.send(result);
        })

        app.delete("/carts/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cartsCollection.deleteOne(query);
            res.send(result);
        })



        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get("/", (req, res) => {
    res.send("Bistro Boss Is eating")
})

app.listen(port, () => {
    console.log(`Bistro Boss Port is ${port}`);
})