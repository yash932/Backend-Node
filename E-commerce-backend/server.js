const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const app = express();
const User = require('./models/User.js');
const Product = require('./models/Product.js');
const Order = require('./models/Order.js');
const Category = require('./models/Category.js');
const Cart = require('./models/Cart.js');
require('./models/associations');

const Port = 3900;

dotenv.config(); 
app.use(express.json());
app.use(bodyParser.json());

app.get('/', (req, res) => {
    res.send('Hello');
});


//middleware for Admin authentication
const authenticateAdmin = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) {
      return res.status(403).send('No token provided.');
  }
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
          console.error('Token verification error:', err);
          return res.status(500).send('Failed to authenticate token.');
      }
      console.log('Decoded token:', decoded); // Log the decoded token
      if (decoded.role.toLowerCase() !== 'admin') {
          return res.status(403).send('Access denied. Admins only.');
      }
      req.userId = decoded.id;
      next();
  });
};


//middleware for User authentication
const authenticateUser = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) {
      return res.status(403).send('No token provided.');
  }
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
          return res.status(500).send('Failed to authenticate token.');
      }
      req.userId = decoded.id;
      req.isAdmin = decoded.role === 'admin';
      next();
  });
};

//signup from here
app.post('/signup', async (req, res) => {
    const { name, email, password, role } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }
    if (!password) {
        return res.status(400).json({ error: 'Password is required' });
    }
    try {
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'Email is already registered' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await User.create({ name, email, password: hashedPassword, role });
        res.status(201).json({ message: 'User added successfully', id: newUser.id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred' });
    }
});


// login from here
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }
    try {
        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(404).json({ error: 'Invalid Email' });
        }
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid password' });
        }
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1hr' });
        res.json({ message: 'Login successful', token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred during login' });
    }
});

//add products by admin
app.post('/products', authenticateAdmin, async (req, res) => {
    const { name, price, description, quantity, categoryId } = req.body;
    if (!name || !price) {
        return res.status(400).send('Name and price are required.');
    }
    try {
        const newProduct = await Product.create({ name, price, description, quantity });
        res.status(201).json(newProduct);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error creating product.');
    }
});


// see all products by all users
app.get('/products', async (req, res) => {
    try {
        const products = await Product.findAll();
        res.status(200).json(products);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error retrieving products.');
    }
});


//see a specific product by product id by all users
app.get('/products/:id', async (req, res) => {
    const productId = req.params.id;
    try {
        const product = await Product.findByPk(productId);
        if (!product) {
            return res.status(404).send('Product not found.');
        }
        res.status(200).json(product);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error retrieving product.');
    }
});


//update a product using productId by admin
app.put('/products/:id', authenticateAdmin, async (req, res) => {
    const productId = req.params.id;
    const { name, price, description } = req.body;
    try {
        const product = await Product.findByPk(productId);
        if (!product) {
            return res.status(404).send('Product not found.');
        }
        if (name) product.name = name;
        if (price) product.price = price;
        if (description) product.description = description;
        await product.save();
        res.status(200).json(product);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error updating product.');
    }
});


//delete products using product id by admin
app.delete('/products/:id', authenticateAdmin, async (req, res) => {
    const productId = req.params.id;
    try {
        const product = await Product.findByPk(productId);
        if (!product) {
            return res.status(404).send('Product not found.');
        }
        await product.destroy();
        res.status(200).send('Product deleted successfully.');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error deleting product.');
    }
});


//add item to cart by user
app.post('/cart', authenticateUser, async (req, res) => {
    const { productId, quantity } = req.body;
    const userId = req.userId;
    if (!productId) {
        return res.status(400).send('Product ID is required.');
    }
    try {
        const product = await Product.findByPk(productId);
        if (!product) {
            return res.status(404).send('Product not found.');
        }
        const [cartItem, created] = await Cart.findOrCreate({
            where: { userId, productId },
            defaults: { quantity: quantity || 1 },
        });
        if (!created) {
            cartItem.quantity += quantity || 1;
            await cartItem.save();
        }
        res.status(201).json(cartItem);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error adding product to cart.');
    }
});


//see items in cart by user
app.get('/cart', authenticateUser, async (req, res) => {
    const userId = req.userId;
    try {
        const cartItems = await Cart.findAll({
            where: { userId },
            include: [{
                model: Product,
                required: true,
            }],
        });
        if (!cartItems.length) {
            return res.status(200).json([]);
        }
        const cartDetails = cartItems.map(item => ({
            id: item.id,
            productId: item.productId,
            quantity: item.quantity,
            product: {
                name: item.Product.name,
                price: item.Product.price,
                description: item.Product.description,
            },
        }));
        res.status(200).json(cartDetails);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error retrieving cart.');
    }
});


//update the items in cart using product id by user
app.put('/cart/:productId', authenticateUser, async (req, res) => {
    const userId = req.userId;
    const productId = req.params.productId;
    const { quantity } = req.body;
    if (typeof quantity !== 'number' || quantity <= 0) {
        return res.status(400).send('Quantity must be a positive number.');
    }
    try {
        const cartItem = await Cart.findOne({ where: { userId, productId } });
        if (!cartItem) {
            return res.status(404).send('Product not found in cart.');
        }
        const product = await Product.findByPk(productId);
        if (!product) {
            return res.status(404).send('Product not found.');
        }
        cartItem.quantity = quantity;
        await cartItem.save();
        res.status(200).json(cartItem);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error updating product quantity in cart.');
    }
});


//delete item in cart by user
app.delete('/cart/:productId', authenticateUser, async (req, res) => {
    const userId = req.userId;
    const productId = req.params.productId;
    try {
        const cartItem = await Cart.findOne({ where: { userId, productId } });
        if (!cartItem) {
            return res.status(404).send('Product not found in cart.');
        }
        await cartItem.destroy();
        res.status(200).send('Product removed from cart successfully.');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error removing product from cart.');
    }
});


//place order by user
app.post('/order', authenticateUser, async (req, res) => {
    const userId = req.userId;
    try {
        const cartItems = await Cart.findAll({
            where: { userId },
            include: [Product],
        });
        if (!cartItems.length) {
            return res.status(400).send('Cart is empty, cannot place an order.');
        }
        const totalAmount = cartItems.reduce((total, item) => {
            return total + (item.quantity * item.Product.price);
        }, 0);
        const products = cartItems.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            name: item.Product.name,
            price: item.Product.price,
        }));
        const order = await Order.create({
            userId,
            products,
            totalAmount,
            status: 'pending',
        });
        await Cart.destroy({ where: { userId } });
        res.status(201).json({
            id: order.id,
            userId: order.userId,
            products: order.products,
            totalAmount: order.totalAmount,
            status: order.status,
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error placing order.');
    }
});


//see particlar order placed by a user using orderId
app.get('/order/:id', authenticateUser, async (req, res) => {
    const userId = req.userId;
    const orderId = req.params.id;
    try {
        const order = await Order.findOne({
            where: {
                id: orderId,
                userId: userId,
            },
        });
        if (!order) {
            return res.status(404).send('Order not found.');
        }
        res.status(200).json(order);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error retrieving order.');
    }
});


//see all orders by admin
app.get('/orders', authenticateAdmin, async (req, res) => {
  try {
      const orders = await Order.findAll({
          include: [{
              model: User,
              attributes: ['id', 'name', 'email'], // Ensure you include the correct attributes
          }],
      });
      res.status(200).json(orders);
  } catch (error) {
      console.error('Error retrieving orders:', error);
      res.status(500).send('Error retrieving orders.');
  }
});


app.listen(Port, () => {
    console.log(`The server is running on ${Port}`);
});