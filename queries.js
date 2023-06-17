const getUsers = "SELECT * FROM webtech.userDB ORDER BY id"
const getUserByUsername = "select * from webtech.userDB where username = $1"
const getUserByEmail = "select * from webtech.userDB where email = $1"
const checkIfEmailExists = "select s from webtech.userDB s where s.email = $1"
const checkIfEmailIsValid = "SELECT s FROM webtech.userDB s WHERE s.email ~ '^[a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,4}$'";
const checkIfUsernameExists = "select s from webtech.userDB s where s.username = $1"
const addUser = "insert into webtech.userDB (username, email, password) values ($1, $2, $3)"
const updateUser = "UPDATE webtech.userDB SET name = $1, surname = $2, username = $3, email = $4, dob = $5 WHERE id = $6";
const deleteUser = "delete from webtech.userDB where username = $1"

module.exports = {
    getUsers,
    getUserByUsername,
    getUserByEmail,
    checkIfEmailExists,
    checkIfEmailIsValid,
    checkIfUsernameExists,
    addUser,
    updateUser,
    deleteUser,
}