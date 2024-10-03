var express = require('express');
var router = express.Router();
var Prisma = require('@prisma/client');
const client = new Prisma.PrismaClient();
const { githubData, closedBy } = require('../controllers');

async function addGithubDataToDatabase(temp) {
        await githubData.addUsers(temp.users);

        await client.github_issues.upsert({
            where: { id: temp.id },
            update: {
                id: temp.id,
                user_id: temp.users,
                status: temp.Status,
                title: temp.title,
                complexity: parseInt(temp.Complexity?.toString().split('-')[0]),
                quality: parseInt(temp.Quality?.toString().split('-')[0]),
                priority: parseInt(temp.Priority?.toString().split('-')[0]),
                time_estimate: parseInt(temp['Time Estimate (Minutes)']),
                designation: temp.Designation,
                numberOfUsers: temp.users.split(", ")[0] === '' ? 0 : temp.users.split(", ").length,
                closed: temp.closed,
                closed_at: temp.closed_at,
                closed_by: await closedBy.closedBy("Optimal-Schedule-Builder", temp.issue_num),
                issue_number: temp.issue_num
                
            },
            create: {
                id: temp.id,
                user_id: temp.users,
                status: temp.Status,
                title: temp.title,
                complexity: parseInt(temp.Complexity?.toString().split('-')[0]),
                quality: parseInt(temp.Quality?.toString().split('-')[0]),
                priority: parseInt(temp.Priority?.toString().split('-')[0]),
                time_estimate: parseInt(temp['Time Estimate (Minutes)']),
                designation: temp.Designation,
                numberOfUsers: temp.users.split(", ")[0] === '' ? 0 : temp.users.split(", ").length,
                closed: temp.closed,
                closed_at: temp.closed_at,
                closed_by: await closedBy.closedBy("Optimal-Schedule-Builder", temp.issue_num),
                issue_number: temp.issue_num
            }
        })
    await githubData.calculatePoints(temp.id);
}


router.get('/', async function(req, res, next) {
    let githubResponse = [];

    try {
        const response = await githubData.getGithubData(3);
        const resJson = await response.json();
        const arr = resJson.data.organization.projectV2.items.edges;
    
        // Use map instead of forEach to create an array of promises
        const promises = arr.map(async (element) => {
            let temp = {};
            element.node?.fieldValues.nodes.forEach((item) => {
                let arrAdd = item.name || item.number;
                if (arrAdd) {
                    temp[item.field.name] = arrAdd;
                }
            });
            temp['title'] = element.node.content.title;
            temp['id'] = element.node.content.id;
            temp['closed'] = element.node.content.closed;
            temp['closed_at'] = element.node.content.closedAt;
            temp['issue_num'] = element.node.content.number;
            var assignees = element.node.fieldValues.nodes.find((item) => item.field?.name === 'Assignees');
            var tempUser = "";
            for (let i = 0; i < assignees?.users.nodes.length; i++) {
                tempUser += assignees.users.nodes[i].login;
                if (tempUser.length > 0 && i < assignees.users.nodes.length - 1) {
                    tempUser += ", ";
                }
            }
            temp['users'] = tempUser;
            console.log(temp)
            if (temp.id) {
                await addGithubDataToDatabase(temp);
            }
        });
    
        // Wait for all promises to resolve
        await Promise.all(promises);
    
        res.status(200).send('Operation completed successfully');
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;