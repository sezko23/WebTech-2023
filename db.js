const pgp = require('pg-promise')();
const connectionString = 'postgres://postgres:postgres@localhost:5432/users'; // replace with your actual connection string
const db = pgp(connectionString);

async function getUserByUsername(username) {
    return await db.oneOrNone('SELECT * FROM webtech.userDB WHERE username = $1', [username]);
  }
  
  async function getUserById(id) {
    return await db.oneOrNone('SELECT * FROM webtech.userDB WHERE id = $1', [id]);
  }

  module.exports = {
    db,
    getUserByUsername,
    getUserById,
  };
