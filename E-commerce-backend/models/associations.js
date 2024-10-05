const User = require('./User');
const Order = require('./Order');

User.hasMany(Order, { foreignKey: 'userId', sourceKey: 'id' });
Order.belongsTo(User, { foreignKey: 'userId', targetKey: 'id' });
