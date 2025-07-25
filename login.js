const axios = require('axios');
require('dotenv').config();

async function login() {
  try {
    const response = await axios.post('https://ennexos.sunnyportal.com/api/v1/login', {
      username: process.env.USERNAME,
      password: process.env.PASSWORD
    });
    return response.data.token;
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
}

module.exports = login;