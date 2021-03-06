const puppeteer = require('puppeteer');
const notifier = require('node-notifier');
const Airtable = require('airtable');
const dotenv = require('dotenv');

dotenv.config();

let base;

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE = process.env.AIRTABLE_BASE;

const shouldSaveToCloud = AIRTABLE_API_KEY && AIRTABLE_BASE;

const airtableConfig = {
	apiKey: AIRTABLE_API_KEY
};

if (shouldSaveToCloud) {
	base = new Airtable(airtableConfig).base(AIRTABLE_BASE);
}

let browser;

async function getBrowser() {
	browser = browser || await puppeteer.launch({headless: false});
	return Promise.resolve(browser)
}

function sleep(ms = 1000) {return new Promise((resolve) => setTimeout(resolve, ms))};

let price = 0;
let maxChecks = 5;
let checksMade = 0;

async function getLatestPrice() {
	const browser = await getBrowser();
	const page = await browser.newPage();
	await page.goto('https://automatebrowsers.com/amazon/cat-mug/');
	await page.waitForSelector('#price_inside_buybox');
	const latestPrice = await page.$eval('#price_inside_buybox', el => {
		const priceAsFloat = parseFloat(el.textContent.substr(1));
		return Math.round(priceAsFloat);
	});

	await page.close();

	return latestPrice;
}

async function logPriceChange(latestPrice) {
	if (price === latestPrice) {
		return;
	}

	const priceDifference = latestPrice - price;

	if (priceDifference > 0) {
		console.log(`Price increase $${latestPrice} (+${priceDifference})`);
	} else {
		const message = `Price decrease $${latestPrice} (${priceDifference})`;
		console.log(message);
		notifier.notify(message);
	}

	if (shouldSaveToCloud) {
		await base('Amazon Price Updates').create([{
			"fields": {
				"Price": latestPrice,
				"Time": new Date().toString()
			}
		}]);
	}
}

async function check() {
	if (checksMade <= maxChecks ) {
		checksMade++;
		const latestPrice = await getLatestPrice();
		if (checksMade > 1) await logPriceChange(latestPrice);
		price = latestPrice;
		await sleep(2000);
		return check();
	} else {
		console.log('Closing browser');
		const browser = await getBrowser();
		await browser.close();
	}
}

check();
