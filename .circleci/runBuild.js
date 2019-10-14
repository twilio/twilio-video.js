#!/usr/bin/env node
'use strict';

/* eslint-disable camelcase */
const http = require('https');
const inquirer = require('inquirer');
const simpleGit = require('simple-git')();

// returns a Promise that resolves with branch information
function getBranches() {
  return new Promise((resolve, reject) => {
    simpleGit.branchLocal((e, branches) => {
      if (e) {
        reject(e);
      } else {
        resolve(branches);
      }
    });
  });
}

// generates a circleCI request using parameters provided
function generateBuildRequest(program) {
  // https://circleci.com/api/v2/project/github/twilio/twilio-video.js/pipeline
  var options = {
    hostname: 'circleci.com',
    path: '/api/v2/project/github/twilio/twilio-video.js/pipeline',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + Buffer.from(program.token).toString('base64'),
      'Accept': 'application/json',
      'Host': 'circleci.com',
    }
  };

  const body = {
    branch: program.branch,
    parameters: {
      pr_workflow: program.workflow === 'pr',
      custom_workflow: program.workflow === 'custom',
      environment: program.environment,
    }
  };

  if (program.workflow === 'custom') {
    body.parameters.browser = program.browser;
    body.parameters.bver = program.bver;
    body.parameters.topology = program.topology;
  }

  return { options, body };
}

// sends a request using given options/body
function triggerBuild({options, body}) {
  return new Promise((resolve, reject) => {
    const request = http.request(options, function(res) {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        var resBody = Buffer.concat(chunks);
        resolve(resBody.toString());
      });
    });

    request.once('error', reject);
    request.end(JSON.stringify(body));
  });
}

getBranches().then(branches => {
  const branchPrompt = {
    type: 'list',
    name: 'branch',
    message: 'Branch:',
    choices: [branches.current, new inquirer.Separator(), ...branches.all],
    default: branches.current
  };

  const environmentPrompt = {
    type: 'list',
    name: 'environment',
    message: 'Environment:',
    choices: ['prod', 'stage', 'dev'],
    default: 'prod'
  };

  const workflowPrompt = {
    type: 'list',
    name: 'workflow',
    message: 'Workflow:',
    choices: ['pr', 'custom'],
    default: 'pr'
  };

  const browserPrompt = {
    when: (answers) => answers.workflow === 'custom',
    type: 'list',
    name: 'browser',
    message: 'Browser:',
    choices: ['chrome', 'firefox'],
    default: 'chrome'
  };

  const confirmPrompt = {
    type: 'confirm',
    name: 'confirm',
    message: 'Confirm the build request:',
    default: true,
  };

  const bverPrompt = {
    when: (answers) => answers.workflow === 'custom',
    type: 'list',
    name: 'bver',
    message: 'Bver:',
    choices: ['stable', 'beta', 'unstable'],
    default: 'stable'
  };

  const topologyPrompt = {
    when: (answers) => answers.workflow === 'custom',
    type: 'list',
    name: 'topology',
    message: 'Topology:',
    choices: ['group', 'peer-to-peer'],
    default: 'group'
  };

  const tokenPrompt = {
    type: 'input',
    name: 'token',
    message: 'Circle CI Token:',
    validate: (val) => { return typeof val === 'string' && val.length > 5; }
  };

  if (process.env.CIRCLECI_TOKEN) {
    tokenPrompt.default = process.env.CIRCLECI_TOKEN;
  }

  inquirer.prompt([
    tokenPrompt,
    environmentPrompt,
    workflowPrompt,
    branchPrompt,
    browserPrompt,
    bverPrompt,
    topologyPrompt,
  ]).then(answers => {
    const {options, body} = generateBuildRequest(answers);
    console.log('Will make a CI request with:', options, body);
    inquirer.prompt([confirmPrompt]).then(({ confirm }) => {
      if (confirm) {
        triggerBuild({options, body}).then((result) => {
          console.log(result);
        }).catch(e => console.log('Failed to trigger a build:', e));
      }
    });
  });
});

