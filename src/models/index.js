const sequelize = require('../config/database');
const User = require('./User');
const Campaign = require('./Campaign');

const initModels = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
    
    // Using standard sync instead of alter: true for SQLite
    // alter: true often fails in SQLite due to limited ALTER TABLE support
    await sequelize.sync();
    
    console.log('All models were synchronized successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
};

module.exports = {
  User,
  Campaign,
  initModels,
};
