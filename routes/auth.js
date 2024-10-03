var express = require('express');
var router = express.Router();
var Prisma = require('@prisma/client');
const client = new Prisma.PrismaClient();

router.get('/', function(req, res, next) {
    res.send('Express API is running properly.');
  });