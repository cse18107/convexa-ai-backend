const { User, Campaign } = require('../models');
const sequelize = require('../config/database');

const clearDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('Connecting to database...');
    
    // Disable foreign key checks to allow truncation if needed
    await sequelize.query('PRAGMA foreign_keys = OFF');
    
    console.log('Clearing Campaign table...');
    await Campaign.destroy({ where: {}, truncate: true });
    
    console.log('Clearing User table...');
    await User.destroy({ where: {}, truncate: true });
    
    // Re-enable foreign key checks
    await sequelize.query('PRAGMA foreign_keys = ON');
    
    console.log('Database cleared successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error clearing database:', error);
    process.exit(1);
  }
};

clearDatabase();
