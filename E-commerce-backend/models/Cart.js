
const { DataTypes } = require('sequelize');
const db = require('../config/db.js');
const Product = require('./Product.js'); 

const Cart = db.define('Cart', {
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    productId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
}, {
    timestamps: true, 
});

Cart.belongsTo(Product, { foreignKey: 'productId' });
Product.hasMany(Cart, { foreignKey: 'productId' });

Cart.sync({ alter: true });

module.exports = Cart;



