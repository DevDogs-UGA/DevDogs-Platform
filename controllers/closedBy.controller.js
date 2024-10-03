const axios = require('axios');

async function closedBy(repo, issue_number) {
    let closedBy = null;
    const url = 'https://api.github.com/repos/DevDogs-UGA/' + repo + '/issues/' + issue_number + '/events';

    try {
        const response =
        await axios.get(url, {
            headers: {
            'X-GitHub-Api-Version': '2022-11-28',
            'Authorization': 'Bearer ' + process.env.GITHUB_TOKEN
            }
        });
        closedBy = await response.data.filter(event => event.event === 'closed')[0].actor.login;
        // console.log(closedBy)
    } catch (err) {
        closedBy = null;
        // console.log(closedBy)
    }

    return closedBy;
}

module.exports = {
    closedBy
  };

//   https://api.github.com/repos/DevDogs-UGA/Optimal-Schedule-Builder/issues/62/events