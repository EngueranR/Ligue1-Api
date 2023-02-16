/*
Author: Enguéran Raout
Student at INSA Haut de France, Mont-Houy
Date: 2023-02-17
Description: This project allows for the collection and analysis of data from the French Ligue 1 football league. It extracts match results, league standings, and team statistics. The collected data can be used to create analyses and visualizations.
*/

process.setMaxListeners(39);
const fs = require("fs");
const puppeteer = require('puppeteer');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
//const cron = require("node-cron");

const urlClassement = 'https://www.ligue1.fr/classement';
const selectorClassement = '.GeneralStats-row';
const {SingleBar} = require('cli-progress');

(async function () {
    try {
        const browser = await puppeteer.launch({
            timeout: 300000,
         //   executablePath: '/usr/bin/chromium'     // vps
            executablePath: '/usr/local/bin/chromium' // local
        });
        const page = await browser.newPage();

        const progressBar = new SingleBar({
            format: 'Téléchargement du classement : [{bar}] {percentage}% | ETA: {eta}s',
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            hideCursor: true,
        });
        progressBar.start(100, 0);

        await page.goto(urlClassement, {timeout: 300000, waitUntil: 'networkidle0'});

        progressBar.update(50);

        const classement = await page.$$eval(selectorClassement, nodes => {
            return nodes.map(node => {
                const position = node.querySelector('.GeneralStats-item--position').textContent;
                const clubDesktop = node.querySelector('.GeneralStats-clubName.desktop-item').textContent;
                const clubMobile = node.querySelector('.GeneralStats-clubName.mobile-item').textContent;
                const points = node.querySelector('.GeneralStats-item--points').textContent;
                return {position, clubDesktop, clubMobile, points}
            })
        });

        progressBar.update(100);
        progressBar.stop();

        fs.writeFile('./JSON/classement.json', JSON.stringify(classement), err => err ? console.log(err) : null);
        await browser.close();
    } catch (err) {
        console.error(err);
        return null;
    }
})();

async function getJournee(journee) {
    try {
        const urlJournee = `https://www.ligue1.fr/calendrier-resultats?matchDay=${journee}`;
        const selectorJournee = '.match-result';
        const browser = await puppeteer.launch({
            timeout: 300000,
            //   executablePath: '/usr/bin/chromium'     // vps
            // executablePath: '/usr/local/bin/chromium' // local
        });
        const page = await browser.newPage();
        await page.goto(urlJournee, {timeout: 300000});
        const matchs = await page.$$eval(selectorJournee, (nodes, j) => {
            return nodes.map((node, index) => {
                const id = node.querySelector('.result').id;
                const clubDesktop_domicile = node.querySelector('.calendarTeamNameDesktop').textContent;
                const clubMobile_domicile = node.querySelector('.calendarTeamNameMobile').textContent;
                const score_domicile = node.querySelector('.result').textContent.trim()[0] || null;
                const score_exterieur = node.querySelector('.result').textContent.trim()[2] || null;
                const clubDesktop_exterieur = node.querySelector('.away .calendarTeamNameDesktop').textContent;
                const clubMobile_exterieur = node.querySelector('.away .calendarTeamNameMobile').textContent;
                return {
                    id,
                    journee: j,
                    clubDesktop_domicile,
                    clubMobile_domicile,
                    score_domicile,
                    score_exterieur,
                    clubDesktop_exterieur,
                    clubMobile_exterieur,
                };
            });
        }, journee);

        await browser.close();
        fs.writeFile(`./JSON/journee${journee}.json`, JSON.stringify(matchs), (err) => {
            if (err) throw err;
        });
        return matchs;
    } catch (error) {
        console.error(error);
        return null;
    }
}

const combineMatchs = async () => {
    const allMatchs = [];
    for (let i = 1; i <= 38; i++) {
        try {
            const matchs = JSON.parse(await fs.promises.readFile(`./JSON/journee${i}.json`, 'utf-8'));
            allMatchs.push(...matchs);
        } catch (err) {
            console.error(err);
        }
    }
    await fs.promises.writeFile('./JSON/saison.json', JSON.stringify(allMatchs));
};

const promises = [];
for (let i = 1; i <= 38; i++) {
    const progressBar = new SingleBar({
        format: `Téléchargement de la journée ${i} : [{bar}] {percentage}% | ETA: {eta}s`,
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: false,
    });
    progressBar.start(100, 0);
    promises.push(getJournee(i).then(() => {
        progressBar.update(100);
        progressBar.stop();
    }));
}

Promise.all(promises).then(() => {
    combineMatchs();
});






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

