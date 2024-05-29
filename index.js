const express = require('express');
const app = express();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const cors = require('cors');
const port = process.env.PORT || 5000;

// middleware

app.use(cors({
    origin: [
        'http://localhost:5173',
        'https://api.imgbb.com/1/upload',
    ]
}));
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

        const userCollection = client.db("bistroRestaurantCollection").collection("users")

        const paymentCollection = client.db("bistroRestaurantCollection").collection("payments")


        // JWT related api

        app.post("/jwt", async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "1hr" })
            res.send({ token: token });
        })

        // user collection

        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: "User Already Exists", insertId: null })
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        })

        // middlewares

        const verifyToken = (req, res, next) => {
            console.log("inside token: ", req.headers.authorization);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: "forbidden access" })
            }
            const token = req.headers.authorization.split(" ")[1]
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: "forbidden access" })
                    // return res.redirect("/")
                }
                req.decoded = decoded;
                next();
            })
        }


        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: "forbidden access" })
            }
            next();
        }


        // for users

        app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
            const result = await userCollection.find().toArray()
            res.send(result)
        })

        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (!email == req.decoded.email) {
                return res.status(403).send({ message: "unauthorized access" })
            }
            const query = { email: email };
            const user = await userCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user.role === 'admin'
            }
            res.send({ admin });
        })

        app.patch("/users/admin/:id", async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        app.delete("/users/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await userCollection.deleteOne(query);
            res.send(result);
        })




        // menu collection

        app.get("/menu", async (req, res) => {
            const result = await menuCollection.find().toArray()
            res.send(result);
        })

        app.get("/menu/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await menuCollection.findOne(query);
            res.send(result);
        })

        app.post('/menu', verifyToken, verifyAdmin, async (req, res) => {
            const menuItem = req.body;
            const result = await menuCollection.insertOne(menuItem);
            res.send(result);
        })

        app.delete("/menu/:id", verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await menuCollection.deleteOne(query);
            res.send(result);
        })

        app.get("/reviews", async (req, res) => {
            const result = await reviewsCollection.find().toArray()
            res.send(result)
        })

        // cart collection

        app.get("/carts", async (req, res) => {
            const email = req.query.email;
            console.log({ email });
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

        // PAYMENT INTENT

        app.post('/create-checkout-session', async (req, res) => {

            const { price } = req.body;
            // console.log("price" , price);
            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            })

            res.send({
                clientSecret: paymentIntent.client_secret
            })
        });

        app.post('/payments', async (req, res) => {
            const payment = req.body;
            payment.cartIds = payment.cartIds.map(id => new ObjectId(id))
            payment.menuItemIds = payment.menuItemIds.map(id => new ObjectId(id))
            const paymentResult = await paymentCollection.insertOne(payment);
            const query = {
                _id: {
                    $in: payment.cartIds.map(id => new ObjectId(id))
                }
            }
            const deleteResult = await cartsCollection.deleteMany(query)

            res.send({ paymentResult, deleteResult });
        })

        app.get("/payments/:email", verifyToken, async (req, res) => {
            const query = { email: req.params.email }
            if (req.params.email !== req.decoded.email) {
                return res.status(403).send({ message: "forbidden access" })
            }
            const result = await paymentCollection.find(query).toArray()
            res.send(result)
        })

        // stats or analytics 

        app.get("/admin-stats", verifyToken, verifyAdmin, async (req, res) => {
            const users = await userCollection.estimatedDocumentCount();
            const menuItems = await menuCollection.estimatedDocumentCount();
            const orders = await paymentCollection.estimatedDocumentCount();

            const result = await paymentCollection.aggregate([
                {
                    $group: {
                        _id: null,
                        totalRevenue: {
                            $sum: '$price'
                        }
                    }
                }
            ]).toArray()

            const revenue = result.length > 0 ? result[0].totalRevenue : 0;

            res.send({
                users,
                menuItems,
                orders,
                revenue
            })
        })

        // ------------

        app.get("/order-stats", async (req, res) => {
            const result = await paymentCollection.aggregate([
                {
                    $unwind: '$menuItemIds'
                },
                {
                    $lookup: {
                        from: 'menu',
                        localField: 'menuItemIds',
                        foreignField: '_id',
                        as: 'menuItems'
                    }
                },
                {
                    $unwind: '$menuItems'
                },
                {
                    $group: {
                        _id: '$menuItems.category',
                        quantity: { $sum: 1 },
                        revenue: { $sum: '$menuItems.price' }
                    }
                }
            ]).toArray()

            res.send(result)
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