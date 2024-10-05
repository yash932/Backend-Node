const { DataTypes } = require('sequelize');
const db = require('../config/db.js');
const Order = require('./Order');

const User = db.define('User', {
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    role: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'User',
    },
}, {
    timestamps: true, 
});

User.sync({ alter: true });

module.exports = User;
