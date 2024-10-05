// test env for functions/routes

import express from 'express';
var testEnvRouter = express.Router();
import Prisma from '@prisma/client';
const prisma = new Prisma.PrismaClient();

import {Resend} from 'resend';
const email = new Resend(process.env.RESEND_API_KEY)