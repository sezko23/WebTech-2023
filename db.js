const pgp = require('pg-promise')();
const connectionString = 'postgres://postgres:postgres@localhost:5432/users'; // replace with your actual connection string
const db = pgp(connectionString);

async function getUserByUsername(username) {
    return await db.oneOrNone('SELECT * FROM webtech.userDB WHERE username = $1', [username]);
 }
  
async function getUserById(id) {
    return await db.oneOrNone('SELECT * FROM webtech.userDB WHERE id = $1', [id]);
}

// async function createFolder(name, parentFolderId, userId) {
//   return await db.one('INSERT INTO webtech.folderDB (name, parentFolderId, userId) VALUES ($1, $2, $3) RETURNING *', [name, parentFolderId, userId]);
// }

// async function getFolder(id) {
//   return await db.one('SELECT * FROM webtech.folderDB WHERE id = $1', [id]);
// }

// async function updateFolder(id, name, parentFolderId) {
//   return await db.none('UPDATE webtech.folderDB SET name = $1, parentFolderId = $2 WHERE id = $3', [name, parentFolderId, id]);
// }

// async function deleteFolder(id) {
//   return await db.none('DELETE FROM webtech.folderDB WHERE id = $1', [id]);
// }

  module.exports = {
    db,
    getUserByUsername,
    getUserById
    // createFolder,
    // getFolder,
    // updateFolder,
    // deleteFolder
  };
