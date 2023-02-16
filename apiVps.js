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
const cron = require('node-cron');
const {SingleBar} = require('cli-progress');

const urlClassement = 'https://www.ligue1.fr/classement';
const selectorClassement = '.GeneralStats-row';

async function getClassementData(page) {
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

    return classement;
}


async function combineMatchs() {
    const allMatchs = [];

    for (let i = 1; i <= 38; i++) {
        try {
            const matchs = JSON.parse(await fs.promises.readFile(`./JSON/journee${i}.json`, 'utf-8'));
            allMatchs.push(...matchs);
        } catch (err) {
            console.error(err);
        }
    }
    fs.writeFileSync('./JSON/saison.json', JSON.stringify(allMatchs));
}

async function getMatchData(page, journee) {
    try {
        const urlJournee = `https://www.ligue1.fr/calendrier-resultats?matchDay=${journee}`;
        const selectorJournee = '.match-result';
        await page.goto(urlJournee, {timeout: 300000, waitUntil: 'networkidle2'});
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

        return matchs;
    } catch (error) {
        console.error(error);
        return null;
    }
}

async function main() {
    try {
        const browser = await puppeteer.launch({
            timeout: 300000,
            executablePath: '/usr/bin/chromium'     // vps
        });
        const page = await browser.newPage();

        const classement = await getClassementData(page);
        fs.writeFileSync('./JSON/classement.json', JSON.stringify(classement));

        const promises = [];
        for (let i = 1; i <= 38; i++) {
            const progressBar = new SingleBar({
                format: `Téléchargement de la journée ${i} : [{bar}] {percentage}% | ETA: {eta}s`,
                barCompleteChar: '\u2588',
                barIncompleteChar: '\u2591',
                hideCursor: false,
            });
            progressBar.start(100, 0);
                promises.push(getMatchData(await browser.newPage(), i).then((matchs) => {

                    progressBar.update(100);
                progressBar.stop();
                fs.writeFileSync(`./JSON/journee${i}.json`, JSON.stringify(matchs));
            }));
        }

        await Promise.all(promises);
        await browser.close();

        await combineMatchs();
    } catch (error) {
        console.error(error);
    }
}
cron.schedule('*/15 * * * *', () => {
    console.log('Exécution de main');
    main();
});
