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
            full_name: true
          }
        }
      }
    });

    // Aggregate points by githubLogin and include fullName
    let aggregatedPoints = {};
    rawData.forEach(item => {
      let login = item.users.githubLogin;
      let fullName = item.users.full_name;
      if (!aggregatedPoints[login]) {
        aggregatedPoints[login] = { points: 0, fullName };
      }
      aggregatedPoints[login].points += item.points;
    });

    // Convert to array and sort by points
    let sortedLeaderBoard = Object.entries(aggregatedPoints).map(([githubLogin, data]) => ({
      githubLogin,
      fullName: data.fullName,
      points: data.points
    })).sort((a, b) => b.points - a.points);

    res.json(sortedLeaderBoard);
  } catch (error) {
    res.status(500).send("Error fetching leaderboard");
  }
});

export default indexRouter;
