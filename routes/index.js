import express from 'express';
var indexRouter = express.Router();
import Prisma from '@prisma/client';
const client = new Prisma.PrismaClient();

/* GET home page. */
indexRouter.get('/', function(req, res, next) {
  console.log(req.body);
  res.send('Express API is running properly.');
});

indexRouter.get('/getLeaderBoard', async function(req, res, next) {
  try {
    let rawData = await client.points.findMany({
      select: {
        points: true,
        users: {
          select: {
            githubLogin: true,
            full_name: true,
            id: true,
          }
        }
      }
    });

    // Aggregate points by githubLogin and include fullName and paid status
    let aggregatedPoints = {};
    for (const item of rawData) {
      let login = item.users.githubLogin;
      let fullName = item.users.full_name;
      let userId = item.users.id;

      // Fetch the paid status using the userId
      let userPage = await client.userInfo.findUnique({
        where: { user_id: userId },
        select: { 
          user_page: {
            select: {
              paid: true
            }
          }
         }
      });

      console.log( await userPage?.user_page.paid);

      let paid = userPage ? await userPage.user_page.paid : false;

      if (!aggregatedPoints[login]) {
        aggregatedPoints[login] = { points: 0, fullName, paid };
      }
      aggregatedPoints[login].points += item.points;
    }

    // Convert to array and sort by points
    let sortedLeaderBoard = Object.entries(aggregatedPoints).map(([githubLogin, data]) => ({
      githubLogin,
      fullName: data.fullName,
      points: data.points,
      paid: data.paid
    })).sort((a, b) => b.points - a.points);

    res.json(sortedLeaderBoard);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).send('Internal Server Error');
  }
});

export default indexRouter;
