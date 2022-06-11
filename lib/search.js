'use strict';

const request = require('./utils/request');
const { BASE_URL } = require('./constants');
const processPages = require('./utils/processPages');
const scriptData = require('./utils/scriptData');
const R = require('ramda');
const fs = require('fs');

/*
 * Make the first search request as in the browser and call `checkfinished` to
 * process the next pages.
 */
function initialRequest (opts) {
  console.log(opts, '2 phase opts');
  // sometimes the first result page is a cluster of subsections,
  // need to skip to the full results page
  function skipClusterPage (html) {
    fs.writeFile('test.html', html, err => {
      if (err) {
        console.error(err);
      }
      // file written successfully
    });
    const match = html.match(/href="\/store\/apps\/details?(.*?)"/);

    // console.log(match[0], 'match');

    if (match) {
      const innerUrl = BASE_URL + match[0].split(/"/)[1];
      return request(Object.assign({
        url: innerUrl
      }, opts.requestOptions), opts.throttle);
    }
    return html;
  }

  const INITIAL_MAPPINGS1 = {
    apps: ['ds:4', 1, 2, 0, 77, 0],
    // apps: ['ds:4', 0, 1, 1, 21, 0],
    token: ['ds:4', 1, 2, 77]
  };
  const INITIAL_MAPPINGS2 = {
    // apps: ['ds:4', 0, 1, 2, 22, 0],
    apps: ['ds:4', 1, 2, 2, 77, 0],
    token: ['ds:4', 1, 2, 77]
  };
  var mapping = INITIAL_MAPPINGS1;

  const url = `${BASE_URL}/store/search?c=apps&q=${opts.term}&hl=${opts.lang}&gl=${opts.country}&price=${opts.price}&fpr=false`;

  return request(Object.assign({ url }, opts.requestOptions), opts.throttle)
    .then(skipClusterPage)
    .then(scriptData.parse)
    // comment next line to get raw data
    .then((parsedData) => {
      // console.log(parsedData['ds:4'][1][2], 'parsedData');
      const isV2 = R.path(['ds:4', 1, 2], parsedData).length === 4;
      mapping = isV2 ? INITIAL_MAPPINGS2 : INITIAL_MAPPINGS1;
      // console.log(mapping.apps);

      return parsedData;
    })
    .then((html) => processPages(html, opts, [], mapping));
}

function getPriceGoogleValue (value) {
  switch (value.toLowerCase()) {
    case 'free':
      return 1;
    case 'paid':
      return 2;
    case 'all':
    default:
      return 0;
  }
}

function search (appData, opts) {
  // console.log('1 phase');

  return new Promise(function (resolve, reject) {
    if (!opts || !opts.term) {
      throw Error('Search term missing');
    }

    if (opts.num && opts.num > 250) {
      throw Error("The number of results can't exceed 250");
    }

    opts = {
      term: encodeURIComponent(opts.term),
      lang: opts.lang || 'en',
      country: opts.country || 'us',
      num: opts.num || 20,
      fullDetail: opts.fullDetail,
      price: opts.price ? getPriceGoogleValue(opts.price) : 0,
      throttle: opts.throttle,
      cache: opts.cache,
      requestOptions: opts.requestOptions
    };

    initialRequest(opts)
      .then(resolve)
      .catch(reject);
  }).then((results) => {
    console.log(results, 'results')
    if (opts.fullDetail) {
      // if full detail is wanted get it from the app module
      return Promise.all(results.map((app) => appData({ ...opts, appId: app.appId })));
    }
    return ['hello', results];
  });
}

module.exports = search;
