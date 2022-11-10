#!/usr/bin/env node

// vim:ft=javascript

'use strict';

import cheerio from 'cheerio';
import { Command, Argument, Option } from 'commander';
import log4js from 'log4js';
import fetch from 'node-fetch';
import fetchSync from 'sync-fetch';
import _ from 'lodash';

const logger = log4js.getLogger('tap');

const TAP_MAX_RETRIES = 5;
const TAP_RETRY_MS = 5000;
const TAP_MAX_USER_DISTANCE = 1000000;
const TAP_MAX_PAGE_SIZE = 96;
const TAP_SEARCH_URL = 'https://www.trade-a-plane.com/search?';
const TAP_TYPES = [
  'Single Engine Piston',
  'Multi Engine Piston',
  'Turboprop',
  'Jets',
  'Gliders | Sailplanes',
  'Rotary Wing',
  'Piston Helicopters',
  'Turbine Helicopters'
];

const NOW = Date.now();

function parseRange(range) {
  let min;
  let max;
  const rangeSplit = range.split('-');
  if (rangeSplit.length === 2) {
    min = rangeSplit[0];
    max = rangeSplit[1];
  } else {
    logger.warn(`invalid range format for ${range}`);
  }
  return [min, max];
}

function buildURL(options, cmd, action) {
  let url = TAP_SEARCH_URL;

  switch (action) {
    case 'search':
      url += '&s-advanced=yes';
      url += '&s-type=aircraft';
      url += '&sale_status=For+Sale';
      url += `&s-page_size=${TAP_MAX_PAGE_SIZE}`;

      switch (options.fractional) {
        case 'Any':
          break;
        case 'None':
          url += '&fractional_ownership=1%2F1';
          break;
        default:
          url += `&fractional_ownership=${encodeURIComponent(options.fractional)}`;
          break;
      }

      url += '&user_distance=' + options.distance.toString();
      url += `&category_level1=${options.type.replaceAll(' ', '+')}`;

      if (options.modelGroup) url += `&model_group=${options.modelGroup.toUpperCase().replaceAll(' ', '+')}`;
      if (options.model) url += `&model=${options.model.toUpperCase()}`;
      if (options.make) url += `&make=${options.make.toUpperCase()}`;
      if (options.year) { 
        const [min, max] = parseRange(options.year);
        if (min && max) {
          url += `&year-min=${min}`;
          url += `&year-max=${max}`;
        }
      }
      if (options.totalTime) {
        const [min, max] = parseRange(options.totalTime);
        if (min && max) {
          url += `&total_time-min=${min}`;
          url += `&total_time-max=${max}`;
        }
      }
      if (options.price) {
        const [min, max] = parseRange(options.price);
        if (min && max) {
          url += `&price-min=${min}`;
          url += `&price-max=${max}`;
        }
      }
      if (options.sort) {
        url += `&s-sort_key=${options.sort}`;
        url += `&s-sort_order=${options.sortOrder}`;
      }
      break;
    case 'category':
      url += '&s-type=aircraft;'
      url += `&category_level1=${options.type.replaceAll(' ', '+')}`;
      url += `&s-lvl=${options.level}`;
      break;
    case 'listing':
      url += `&listing_id=${options.id}`;
      break;
    default:
      throw new Error(`can not build URL, invalid action ${action}`);
      break;
  }

  return url;
}

function sleep(ms) {
   Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function tapFetchSync(url) {
  // TaP has severe rate-throttling so everything is synchronous with
  // three second back-off.
  logger.debug(`fetching ${url} ...`);
  let resp;
  for (let i = 0; i < TAP_MAX_RETRIES; ++i) {
    try {
      resp = fetchSync(url);
      if (resp.status === 200)
        return resp.text();
      sleep(TAP_RETRY_MS);
    } catch (err) {
      logger.error(err);
    }
  }

  logger.warn(`could not fetch '${url}': ${resp.status} - ${resp.statusText}`);
  return "";
}

async function shutdown(err) {
  if (err) {
    logger.error(err);
    process.exit(-1);
  }
}

async function categoryCmd(options, cmd) {
  const url = buildURL(options, cmd, 'category');
  const text = tapFetchSync(url);
  const $ = cheerio.load(text);

  const levels = [];
  const selector = $('.column > ul > li > a');
  $(selector).each((index, element) => {
    const level = $(element).attr('title').trim();
    if (level !== 'Show All Makes')
      console.log(level);
  });
}

async function searchCmd(options, cmd) {
  let totalPages = 1;
  const fetchTexts = [];
  const url = buildURL(options, cmd, 'search');
  const text = tapFetchSync(url);
  fetchTexts.push(text);

  // Parse total number of results found first before fetching the rest.
  const $ = cheerio.load(text);
  const selector = $('#search_results_area > .search_options > h2');
  let resultsFound = $(selector).text();
  if (resultsFound) {
    resultsFound = resultsFound.replace(/\r?\n|\r/g, "");
    resultsFound = resultsFound.replace(/\s/g, "");
    const resultsRE = /^Showing.*of(.*)results*/;
    const match = resultsFound.match(resultsRE);
    if (match && match.length > 1) {
      let numResults = parseInt(match[1].replace(/,/g, ''), 10)
      const number = (options.number) ? parseInt(options.number) : Infinity;
      numResults = Math.min(numResults, number);

      // Now determine how many URLs to fetch and fetch tte rest
      totalPages = (numResults <= TAP_MAX_PAGE_SIZE) ? 1 : Math.round(numResults / TAP_MAX_PAGE_SIZE) + ((numResults % TAP_MAX_PAGE_SIZE) ? 1 : 0);
      const fetchURLs = [];
      for (let page = 1; page <= totalPages; ++page) {
        fetchURLs.push(url + `&s-page=${page}`);
      }
      
      logger.debug(`fetching ${numResults} results over ${totalPages} page(s) ...`);

      // We run this loop synchronously since TaP enforces some rate-limiting (429)
      for (const url of fetchURLs.slice(1, fetchURLs.length)) {
        fetchTexts.push(tapFetchSync(url));
      }

      logger.debug(`scraped ${totalPages} pages ...`);
      let resultsProcessed = 0;
      for (const body of fetchTexts) {
        const $ = cheerio.load(body);

        // Parse the entire result listing
        const selector = '.result_listing';
        $(selector).each((index, element) => {
          const ad = {};
          ad['id'] = $(element).attr('data-listing_id');
          const dataModelGroup = $(element).attr('data-model_group');
          ad['model_group'] = dataModelGroup.trim();
          const dataSellerID = $(element).attr('data-seller_id');
          ad['seller_id'] = dataSellerID;

          const titleLink = $(element).find('.lst-title > h3 > a');
          ad['title'] = $(titleLink).text().trim();
          const titleHref = $(titleLink).attr('href');
          const titleHrefNoSearch = titleHref.replace('/search?', '');
          const titleHrefSplit = titleHrefNoSearch.split('&');
          _.forEach(titleHrefSplit, (nvp) => {
            const nvpSplit = nvp.split('=');
            if (nvpSplit.length === 2) {
              const [key, value] = nvpSplit;
              if (key === 'make' || key === 'model') ad[key] = value.replaceAll('+', ' ');
              if (key === 's-type') ad['type'] = value.replaceAll('+', ' ');
              if (key === 'category_level1') ad['category'] = value.replaceAll('+', ' ');
            }
          });
          const titleSplit = ad['title'].split(' ');
          ad['year'] = _.isNaN(parseInt(titleSplit[0])) ? 'Not Listed' : titleSplit[0];
          const priceArea = $(element).find('.txt-price');
          ad['price'] = $(priceArea).text().trim();
          const regArea = $(element).find('.txt-reg-num');
          ad['registration'] = $(regArea).text().trim().replace(/Reg#\s*/g, '');
          const ttArea = $(element).find('.txt-total-time');
          ad['total_time'] = $(ttArea).text().trim().replace(/TT:\s*/g, '');
          const addressArea = $(element).find('.address');
          ad['address'] = $(addressArea).text().trim();
          ad['last_updated'] = $(element).find('.last-update').text().trim().replace(/Last Update:\s*/, '');
          ad['fetch_date'] = NOW;
          if (options.deep) {
            options.id = ad['id'];
            const url = buildURL(options, cmd, 'listing');
            const text = tapFetchSync(url);
            const $ = cheerio.load(text);
            let selector = $('#bottom_section > #general_specs > p');
            ad['specs'] = $(selector).text().trim();
            selector = $('#detailed_desc > pre');
            ad['description'] = $(selector).text().trim();
            selector = $('#avionics_equipment > pre');
            ad['avionics'] = $(selector).text().trim();
            selector = $('#airframe > pre');
            ad['airframe'] = $(selector).text().trim();
            selector = $('#engines_mods > pre');
            ad['engine'] = $(selector).text().trim();
            selector = $('#interior_exterior > pre');
            ad['int_ext'] = $(selector).text().trim();
            selector = $('#remarks > pre');
            ad['remarks'] = $(selector).text().trim();
          }

          process.stdout.write(JSON.stringify(ad));
          process.stdout.write('\n');

          resultsProcessed += 1;
          if (resultsProcessed == numResults)
            return false;
        });
      }
    } 
  }
}

const tap = new Command();
tap
  .name('tap')
  .description('Trade-a-Plane')
  .version('0.1.0')
  .addOption(new Option('-d, --debug', 'debug output'))
  .hook('preSubcommand', async (thisCommand, subCommand) => {
    try {
      logger.level = (thisCommand.opts().debug) ? 'debug' : 'info';
      logger.debug(`${thisCommand._name} preSubcommand ... `);
      logger.debug('command options: ' + JSON.stringify(thisCommand.opts()));
    } catch (err) {
      logger.error(err);
      process.exit(-1);
    }
  });

const search = tap.command('search').alias('s').description('Search Trade-a-Plane');
search
 .addOption(new Option('-t, --type <type>', 'category type').choices(TAP_TYPES).default(TAP_TYPES[0]))
 .addOption(new Option('-f, --fractional <percentage>', 'fractional ownership percentage').choices(['None', 'Any', '1/2', '1/3', '1/4', '1/6', '1/7', '1/8', '1/16' ]).default('None'))
 .addOption(new Option('-d, --distance <distance>', 'user distance').default(TAP_MAX_USER_DISTANCE))
 .addOption(new Option('-m, --make <make>', 'make'))
 .addOption(new Option('-o, --model <model>', 'model'))
 .addOption(new Option('-g, --model-group <group>', 'model group'))
 .addOption(new Option('-y, --year <year>', 'year range'))
 .addOption(new Option('-p, --price <price>', 'price range'))
 .addOption(new Option('-l, --total-time <time>', 'total time range'))
 .addOption(new Option('--sort <sort>', 'sort key').choices(['days_since_update', 'price', 'make', 'model', 'year', 'overhaul1_time', 'total_time']))
 .addOption(new Option('--sort-order <order>', 'sort order').choices(['asc', 'desc']).default('asc'))
 .addOption(new Option('-n, --number <number>', 'number of results'))
 .addOption(new Option('--deep', 'deep query mode'))
 .action(async (options, cmd) => {
   try {
     logger.debug('search subcommand ... ');
     logger.debug('command options: ' + JSON.stringify(options));
     await searchCmd(options, cmd);
   } catch (err) {
     shutdown(err);
   }
 });

const category = tap.command('category').alias('c').description('List Categories');
category
 .addOption(new Option('-t, --type <type>', 'category level').choices(TAP_TYPES).default(TAP_TYPES[0]))
 .addOption(new Option('-l, --level <level>').choices(['1', '2']).default('1'))
 .action(async (options, cmd) => {
   try {
     logger.debug('category subcommand ... ');
     logger.debug('command options: ' + JSON.stringify(options));
     await categoryCmd(options, cmd);
   } catch (err) {
     shutdown(err);
   }
 });

function main() {
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  tap.parse();
}

if (import.meta.url.startsWith(`file://${process.argv[1]}`)) {
  main();
}
