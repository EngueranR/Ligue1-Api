process.setMaxListeners(0);

let chrome = {};
let puppeteer;
const fs = require("fs")
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
//const cron = require("node-cron");

if (process.env.AWS_LAMBDA_FUNCTION_VERSION) {
    chrome = require("chrome-aws-lambda");
    puppeteer = require("puppeteer-core");
} else {
    puppeteer = require("puppeteer");
}

if (process.env.AWS_LAMBDA_FUNCTION_VERSION) {
    options = {
        args: [...chrome.args, "--hide-scrollbars", "--disable-web-security"],
        defaultViewport: chrome.defaultViewport,
        executablePath: await chrome.executablePath,
        headless: true,
        ignoreHTTPSErrors: true,
        timeout: 300000,
    };
}

// cron.schedule(' */5 * * * *', () => {

app.listen(3000, () => {
    console.log(`Site : http://localhost:${PORT}/`);
});
module.exports = app;


app.get('/', (req, res) => {
    res.send('Ligue1 API crée par Enguéran 2023');
});

app.get('/saison', (req, res) => {
    fs.readFile('./JSON/saison.json', 'utf-8', (err, data) => {
        if (err) throw err;
        res.send(JSON.parse(data));
    });
});

app.get('/classement', (req, res) => {
    fs.readFile('./JSON/classement.json', 'utf-8', (err, data) => {
        if (err) throw err;
        res.send(JSON.parse(data));
    });
});

app.get('/journee/:id', (req, res) => {
    fs.readFile(`./JSON/journee${req.params.id}.json`, (err, data) => {
        if (err) throw err;
        res.send(JSON.parse(data));
    });
});

app.get('/equipe/:club', (req, res) => {
    fs.readFile('./JSON/saison.json', (err, data) => {
        if (err) throw err;
        let saison = JSON.parse(data);
        let matchs = saison.filter(journee => journee.clubDesktop_domicile === req.params.club || journee.clubDesktop_exterieur === req.params.club || journee.clubMobile_domicile === req.params.club || journee.clubMobile_exterieur === req.params.club);
        res.send(matchs);
    });
});


const urlClassement = 'https://www.ligue1.fr/classement';
const selectorClassement = '.GeneralStats-row';
(async function () {
    try {
        let browser = await puppeteer.launch(options);
        const page = await browser.newPage();
    await page.goto(urlClassement, {timeout: 300000});
    const classement = await page.$$eval(selectorClassement, nodes => {
        return nodes.map(node => {
            const position = node.querySelector('.GeneralStats-item--position').textContent;
            const clubDesktop = node.querySelector('.GeneralStats-clubName.desktop-item').textContent;
            const clubMobile = node.querySelector('.GeneralStats-clubName.mobile-item').textContent;
            //const img = node.querySelector('img').getAttribute('src');
            const points = node.querySelector('.GeneralStats-item--points').textContent;
            return {position, clubDesktop, clubMobile, points}
        })
    });
    fs.writeFile('./JSON/classement.json', JSON.stringify(classement), err => err ? console.log(err) : null)
    await browser.close()
    } catch (err) {
        console.error(err);
        return null;
    }
})();


const getJournee = async (j) => {
    let urlJournee = "https://www.ligue1.fr/calendrier-resultats?matchDay=" + j;
    const selectorJournee = ".match-result";
    try {
        let browser = await puppeteer.launch(options);
        const page = await browser.newPage();
        await page.goto(urlJournee, {timeout: 300000});
        const matchs = await page.$$eval(selectorJournee, (nodes, journee) => {
            return nodes.map(node => {
                const id = node.querySelector('.result').id;
                const clubDesktop_domicile = node.querySelector('.calendarTeamNameDesktop').textContent;
                const clubMobile_domicile = node.querySelector('.calendarTeamNameMobile').textContent;
                let score_domicile = node.querySelector('.result').textContent.trim().charAt(0);
                let score_exterieur = node.querySelector('.result').textContent.trim().charAt(2);
                const clubDesktop_exterieur = node.querySelector('.away .calendarTeamNameDesktop').textContent;
                const clubMobile_exterieur = node.querySelector('.away .calendarTeamNameMobile').textContent;

                if (!Number.isInteger(score_domicile) && !Number.isInteger(score_exterieur)) {
                    score_exterieur = null;
                    score_domicile = null;
                }

                return {
                    id,
                    journee,
                    clubDesktop_domicile,
                    clubMobile_domicile,
                    score_domicile,
                    score_exterieur,
                    clubDesktop_exterieur,
                    clubMobile_exterieur
                };
            });
        }, j);
        fs.writeFile(
            './JSON/journee' + j + '.json',
            JSON.stringify(matchs),
            err => (err ? console.log(err) : null)
        );
        await browser.close();
    }
    catch (err) {
        console.error(err);
        return null;
    }
};


const combineMatchs = async () => {
    const allMatchs = [];
    for (let i = 1; i <= 38; i++) {
        const matchs = JSON.parse(fs.readFileSync(`./JSON/journee${i}.json`, 'utf-8'));
        allMatchs.push(...matchs);
    }
    fs.writeFile(
        './JSON/saison.json',
        JSON.stringify(allMatchs),
        err => (err ? console.log(err) : null)
    );
};

const promises = [];
for (let i = 1; i <= 38; i++) {
    promises.push(getJournee(i));
}
Promise.all(promises).then(() => {
    combineMatchs();
});
//})






