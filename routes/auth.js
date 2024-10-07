import express from 'express';
var authRouter = express.Router();
import Prisma from '@prisma/client';
import password from 'generate-password';
const prisma = new Prisma.PrismaClient();
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import session from 'express-session';

import { sendEmailVerification } from '../controllers/emailVerification.controller.js';

import timestamp from 'unix-timestamp';
timestamp.round = true;

function genPass() {
    return password.generate({
        numbers: true,
        length: 95,
        uppercase: false
    });
}

authRouter.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
        secure: true, // Set to true in production for HTTPS
        maxAge: 1000 * 60 * 60 * 24, // 24 hours
    }
}));

authRouter.get('/', function(req, res, next) {
    res.send('Express API is running properly.');
});

authRouter.post('/createUser', async (req, res) => {
    if (req.body.first_name == null) {
        res.send({
            code: "MISSING_FIELD_REQURED",
            message: "The 'first_name' field is required."
        })
        return;
    }

    if (req.body.email_address == null) {
        res.send({
            code: "MISSING_FIELD_REQURED",
            message: "The 'email_address' field is required."
        })
        return;
    }

    if (req.body.password == null) {
        res.send({
            code: "MISSING_FIELD_REQURED",
            message: "The 'password' field is required."
        })
        return;
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(req.body.password, salt);

    try {
        let newUser = await prisma.userInfo.create({
            data: {
                first_name: req.body.first_name,
                last_name: req.body.last_name,
                email_address: req.body.email_address,
                password_hash: hash,
                salt: salt
            }
        })

        let code = password.generate({
            length: 6,
            numbers: true
        })

        await prisma.refresh_token.create({
            data: {
                userId: newUser.id,
                refresh_token: genPass()
            }
        })

        var expireTime = new Date(timestamp.duration("+5m")).toISOString();

        if (process.env.EMAIL_VERIFICATION == 'TRUE') {
            await prisma.email_verification.create({
                data: {
                    id: newUser.id,
                    code: code,
                    expireTimestamp: expireTime
                }
            })

            sendEmailVerification(code, req.body.email_address);
        }

        const user_email = newUser.email_address;
        req.session.user = { user_email };
        console.log(req.session.user);
    } catch (err) {
        if (err.code == "P2002") {
            res.send({
                code: "409 Conflict",
                message: "The user with the email address: " + req.body.email_address + " already exists."
            })
            return;
        } else {
            res.status(500).send({
                code: "500 INTERNAL SERVER ERROR",
                message: "An error occured while creating the user."
            })
            console.log(err)
            return;
        }
    }

    res.send({
        code: "200 OK",
        message: "User created successfully."
    })
});

// TODO: Add try catch block
authRouter.get('/getAccessToken', async (req, res) => {
    const {email_address, password} = req.body;

    if (email_address == null) {
        res.send({
            code: "MISSING_FIELD_REQURED",
            message: "The 'email_address' field is required."
        })
        return;
    }
    
    if (password == null) {
        res.send({
            code: "MISSING_FIELD_REQURED",
            message: "The 'password' field is required."
        })
        return;
    }

    const secret_key = process.env.SECRET_KEY;

    const userInfo = await prisma.userInfo.findFirst({
        where: {
            email_address: email_address,
        },
    })

    const hash = await bcrypt.hash(password, userInfo.salt);
    if (userInfo.password_hash === hash) {
        const token = jwt.sign({
            sub: process.env.ORG,
            scopes: "user",
            userId: userInfo.id,
            iat: timestamp.now(),
            exp: timestamp.add(timestamp.now(), "+5m")
        }, secret_key)

        let refresh_token = await prisma.refresh_token.findFirst({
            where: {
                userId: userInfo.id
            },
            select: {
                refresh_token: true
            }
        })
        refresh_token = refresh_token.refresh_token

        res.send({token, refresh_token});
    } else {
        res.status(401).send({
            code: "401 UNAUTHORIZED",
            message: "Unauthorized access to resource."
        })
    }

});

// TODO: Convert into a middleware function to check if user is verified
authRouter.get('/getUserData', (req, res) => {
    const token = req.body.token;
    const secret_key = process.env.SECRET_KEY;

    let payload; 
    try {
        payload = jwt.verify(token, secret_key)
        if (payload.exp > timestamp.now()) {
            sendData();
        } else {
            res.send({
                code: "419 Access Token Expired",
                message: "Access token is expired. Regain access to resource by getting a new access token."
            })
        }
    } catch (err) {
        res.send({
            code: "401 UNAUTHORIZED",
            message: "Unauthorized access to resource."
        })
    }

    function sendData() {
        
    }
})

authRouter.get('/getNewToken', async (req, res) => {
    const token = req.body.token;
    const refresh_token = req.body.refresh_token;
    const secret_key = process.env.SECRET_KEY;

    if (token == null) {
        res.send({
            code: "MISSING_FIELD_REQURED",
            message: "The 'token' field is required."
        })
        return;
    }

    if (refresh_token == null) {
        res.send({
            code: "MISSING_FIELD_REQURED",
            message: "The 'refresh_token' field is required."
        })
        return;
    }

    var userId;
    try {
        userId = await jwt.decode(token).userId;
    } catch (err) {
        res.send({
            code: "401 UNAUTHORIZED",
            message: "Unauthorized access to resource."
        })
        return;
    }

    try {
        jwt.verify(token, secret_key)
    } catch (err) {
        res.send({
            code: "401 UNAUTHORIZED",
            message: "Unauthorized access to resource."
        })
        return;
    }
    
    const userInfo = await prisma.userInfo.findUnique({
        where: {
            id: userId
        },
    })

    const dbRefresh = await prisma.refresh_token.findUnique({
        where: {
            userId: userInfo.id
        },
        select: {
            refresh_token: true
        }
    })

    let payload;
    try {
        payload = jwt.verify(token, secret_key)
        if (payload.exp > timestamp.now()) {
            res.send({token})
        }
    } catch (err) {
        if (err == "JsonWebTokenError: invalid signature") {
            res.send({
                code: "401 UNAUTHORIZED",
                message: "Unauthorized access to resource."
            })
        }

        if (err == "TokenExpiredError: jwt expired") {
            if (dbRefresh.refresh_token == refresh_token) {
                const newRefresh = genPass();

                try {
                    await prisma.refresh_token.update({
                        where: {
                            userId: userInfo.id
                        },
                        data: {
                            refresh_token: newRefresh
                        }
                    })
                } catch (err) {
                    console.log(err)
                }

                res.send({
                    token: jwt.sign({
                        sub: process.env.ORG,
                        userId: userInfo.id,
                        iat: timestamp.now(),
                        exp: timestamp.add(timestamp.now(), "+5m")
                    }, secret_key),
                    refresh_token: newRefresh
                })
            } else {
                res.send({
                    code: "401 UNAUTHORIZED",
                    message: "The provided refresh token is not valid."
                })
            }
        }
    }

})

authRouter.post('/resetPassword', async (req, res) => {
    const {email_address, password} = req.body;

    if (email_address == null) {
        res.send({
            code: "MISSING_FIELD_REQURED",
            message: "The 'email_address' field is required."
        })
        return;
    }

    let userInfo;
    try {
      userInfo = await prisma.userInfo.findFirst({
          where: {
              email_address: email_address
          }
      })
    } catch (err) {
      res.send({
        code: "404 NOT FOUND",
        message: "The user with the email address: " + email_address + " does not exist."
      })
      return;
    }

    // TODO FIGURE OUT A WAY TO VERIFY USER

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    await prisma.userInfo.update({
        where: {
            id: userInfo.id,
            email_address: email_address
        },
        data: {
            password_hash: hash,
            salt: salt
        }
    })

    res.status(200).send({
        code: "200 OK",
        message: "Password reset successful."
    })
});

function isAuthenticated(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.send({
            code: "401 UNAUTHORIZED",
            message: "Unauthorized access to resource."
        });
    }
}

authRouter.get('/login', async (req, res) => {
    const {email_address, password} = req.body;

    if (email_address == null) {
        res.send({
            code: "MISSING_FIELD_REQURED",
            message: "The 'email_address' field is required."
        })
        return;
    }

    if (password == null) {
        res.send({
            code: "MISSING_FIELD_REQURED",
            message: "The 'password' field is required."
        })
        return;
    }

    const userInfo = await prisma.userInfo.findFirst({
        where: {
            email_address: email_address
        }
    })

    if (userInfo) {
        if (bcrypt.compare(password, userInfo.password_hash)) {
            req.session.user = { user_email: email_address };
            res.send({
                code: "200 OK",
                message: "User logged in successfully."
            })
        } else {
            res.send({
                code: "401 UNAUTHORIZED",
                message: "Unauthorized access to resource."
            })
        }
    } else {
        res.send({
            code: "404 NOT FOUND",
            message: "The user with the email address: " + email_address + " does not exist."
        })
    }
});

authRouter.get('/restricted', isAuthenticated, (req, res) => {
    res.status(200).send(`${req.sessionID} is authenticated.`);
});

authRouter.get('/logout', (req, res) => {
    req.session.destroy();
    res.send('Logged out successfully.');
});

authRouter.get('*', function(req, res){
    res.status(404);
});

export default authRouter;