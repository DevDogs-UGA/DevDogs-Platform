var Prisma = require('@prisma/client');
const client = new Prisma.PrismaClient();
const { closedBy } = require('./closedBy.controller');

async function getGithubData(projectNum) {
    const response = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
            'Authorization': `bearer ${process.env.GITHUB_TOKEN}`,
        },
        body: JSON.stringify({
            query: `
            query DevDogs {
                organization(login: "DevDogs-UGA") {
                    projectV2(number: ${projectNum}) {
                        items(first: 100) {
                            totalCount
                            edges {
                                node {
                                    content {
                                        ... on Issue {
                                            title
                                            id
                                            closed
                                            closedAt
                                            number
                                        }
                                    }
                                    fieldValues(first: 20) {
                                        nodes {
                                            ... on ProjectV2ItemFieldSingleSelectValue {
                                                name
                                                field {
                                                    ... on ProjectV2SingleSelectField {
                                                        name
                                                        updatedAt
                                                    }
                                                }
                                            }
                                            ... on ProjectV2ItemFieldNumberValue {
                                                number
                                                field {
                                                    ... on ProjectV2Field {
                                                        name
                                                    }
                                                }
                                            }
                                            ... on ProjectV2ItemFieldDateValue {
                                                field {
                                                    ... on ProjectV2Field {
                                                        name
                                                    }
                                                }
                                                date
                                            }
                                            ... on ProjectV2ItemFieldUserValue {
                                                field {
                                                    ... on ProjectV2FieldCommon {
                                                        name
                                                    }
                                                }
                                                users(first: 10) {
                                                    totalCount
                                                    nodes {
                                                        email
                                                        name
                                                        login
                                                    }
                                                }
                                            }
                                            ... on ProjectV2ItemFieldTextValue {
                                                field {
                                                    ... on ProjectV2Field {
                                                        name
                                                    }
                                                }
                                                text
                                            }
                                        }
                                        totalCount
                                    }
                                }
                            }
                        }
                    }
                }
            }
`,
        }),
    });

    return response;
}

// only for DevDogs-website
async function addGithubDataToDatabase(temp) {
    await addUsers(temp.users);

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
            closed_by: await closedBy("DevDogs-Website", temp.issue_num),
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
            closed_by: await closedBy("DevDogs-Website", temp.issue_num),
            issue_number: temp.issue_num
        }
    })

    await calculatePoints(temp.id);
}

async function deletePointsIfTakenOut(issue_id, data) {
    const pointsDbUser = await client.points.findMany({
        where: { issue_id: issue_id },
        select: { user_id: true }
    }).then((res) => res.map((item) => item.user_id));

    // userIds of the users associated with the issue (updated)
    const updatedUsers = data.user_id.split(", ");
    for (var i = 0; i < updatedUsers.length; i++) {
        updatedUsers[i] = await client.users.findFirst({ where: { githubLogin: updatedUsers[i] }, select: { id: true } }).then((res) => res.id);
    }
    
    for (const oldUser of pointsDbUser) {
        if (!updatedUsers.includes(oldUser)) {
            console.log(await client.points.deleteMany({
                where: {
                    issue_id: issue_id,
                    user_id: oldUser
                }
            }));
        }
    }
}

async function calculatePoints(issue_id) {
    let points;

    const data = await client.github_issues.findFirst({ where: { id: issue_id } });

    if (data.closed === true) {
        // formula to calculate points
        points = ((data.time_estimate / 60) * ((data.quality/3)*(50) + (data.priority/3)*(25) + (data.complexity/3)*(25))) || null;
        
        if (points && (data.numberOfUsers > 0)) {
            for (var i = 0; i < data.numberOfUsers; i++) {
                let github = data.user_id.split(", ")[i];
                let user = await client.users.findFirst({ where: { githubLogin: github }, select: { id: true } }).then((res) => res.id);
                let pointsExist = false;

                await deletePointsIfTakenOut(issue_id, data);

                try {
                    await client.points.findFirstOrThrow({ where: { issue_id: issue_id, user_id: user } })
                    pointsExist = true;
                } catch (error) {
                    // console.log('Points do not exist');
                }

                if (pointsExist) {
                    // console.log('Points already exist');
                    await client.points.updateMany({
                        where: { issue_id: issue_id, user_id: user },
                        data: {
                            issue_id: issue_id,
                            user_id: user,
                            points: points / data.numberOfUsers
                        }
                    });
                } else {
                    await client.points.create({
                        data: {
                            issue_id: issue_id,
                            user_id: user,
                            points: points/data.numberOfUsers
                        }
                    });
                }
            }
        } else {
            console.log('Points could not be calculated', issue_id);
        }
    } else {
        // console.log('Issue is not done');
    }
}

function getPriority(priority) {
    if (priority === 1) {
        return 4;
    } else if (priority === 2) {
        return 3;
    } else if (priority === 3) {
        return 2;
    } else if (priority === 4) {
        return 1;
    } else {
        return null;
    }
}

async function addUsers(temp_users) {
    let userArr = temp_users.split(", ");
    // console.log(userArr);

    for (var j = 0; j < userArr.length; j++) {
        if (userArr[j] === '') {
            continue;
        } else {
            try {
                let url = `https://api.github.com/users/` + userArr[j];
                console.log(url);
                let full_name = await fetch(url, {
                    headers: {
                        'Authorization': `bearer ${process.env.GITHUB_TOKEN}`,
                    },
                })
                    .then((res) => res.json()).then((res) => res.name);
                
                    console.log(await full_name);
                    await client.users.create({
                    data: {
                        githubLogin: userArr[j],
                        full_name: await full_name || userArr[j]
                    }
                });
            } catch (error) {
                console.log(error);
            }
        }
    }
}

module.exports = {
    getGithubData,
    addGithubDataToDatabase,
    deletePointsIfTakenOut,
    calculatePoints,
    getPriority,
    addUsers
};