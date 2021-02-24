#!/usr/bin/env node
'use strict';

/* eslint-disable camelcase */
const http = require('https');
const inquirer = require('inquirer');
const simpleGit = require('simple-git')();


/*
posts a request for a circleci workflow
you can alternatively use a curl command like:

curl -u ${CIRCLECI_TOKEN}: -X POST \
  --header 'Content-Type: application/json' \
  -d '{
    "branch": "master",
    "parameters": {
        "pr_workflow": false,
        "custom_workflow": false,
        "backend_workflow": true,
        "test_stability" : "stable",
        "environment": "stage"
    }
}' \
https://circleci.com/api/v2/project/github/twilio/twilio-video.js/pipeline

Note: environment, tag, test_stability are optional parameters.
*/

// returns a Promise that resolves with branch information
let branchesPromise = null;
function getBranches() {
  if (branchesPromise === null) {
    branchesPromise = new Promise((resolve, reject) => {
      simpleGit.branchLocal((e, branches) => {
        if (e) {
          reject(e);
        } else {
          resolve(branches);
        }
      });
    });
  }
  return branchesPromise;
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
    branch: 'master',
    parameters: {
      pr_workflow: program.workflow === 'pr',
      custom_workflow: program.workflow === 'custom',
      backend_workflow: program.workflow === 'backend',
      environment: program.environment,
      test_stability: program.test_stability,
      test_files: program.test_files
    }
  };

  if (program.workflow === 'pr') {
    body.branch = program.branch;
  } else if (program.workflow === 'custom') {
    body.branch = program.branch;
    body.parameters.browser = program.browser;
    body.parameters.bver = program.bver;
    body.parameters.topology = program.topology;
  } else if (program.workflow === 'backend') {
    body.branch = program.branch;
    body.parameters.tag = program.tag;
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

const tokenPrompt = {
  type: 'input',
  name: 'token',
  message: 'Circle CI Token:',
  validate: (val) => { return typeof val === 'string' && val.length > 5; }
};

const workflowPrompt = {
  type: 'list',
  name: 'workflow',
  message: 'Workflow:',
  choices: ['pr', 'custom', 'backend'],
  default: 'pr'
};

const stableTestsPrompt = {
  when: (answers) => answers.workflow === 'custom',
  validate: answer => answer.length > 0,
  type: 'checkbox',
  name: 'test_stability',
  message: 'Run Stable Tests Only:',
  choices: ['stable', 'unstable'],
  default: 'all'
};

// you may pick branch for pr or custom workflow.
const branchPrompt = {
  // when: (answers) => answers.workflow !== 'backend',
  type: 'list',
  name: 'branch',
  message: 'Branch:',
  choices: () => getBranches().then(branches => [branches.current, new inquirer.Separator(), ...branches.all]),
  default: () => getBranches().then(branches => branches.current)
};

// environment defaults to stage for backend workflow.
const environmentListPrompt = {
  when: (answers) => answers.workflow !== 'custom',
  type: 'list',
  name: 'environment',
  message: 'Environment:',
  choices: ['prod', 'stage', 'dev'],
  default: (answers) => answers.workflow === 'backend' ? 'stage' :'prod'
};

const environmentCheckboxPrompt = {
  when: (answers) => answers.workflow === 'custom',
  validate: answer => answer.length > 0,
  type: 'checkbox',
  name: 'environment',
  message: 'Environment:',
  choices: ['prod', 'stage', 'dev'],
  default: (answers) => answers.workflow === 'backend' ? 'stage' :'prod'
};

const browserPrompt = {
  when: (answers) => answers.workflow === 'custom',
  validate: answer => answer.length > 0,
  type: 'checkbox',
  name: 'browser',
  message: 'Browser:',
  choices: ['chrome', 'firefox'],
  default: 'chrome'
};

const bverPrompt = {
  when: (answers) => answers.workflow === 'custom',
  validate: answer => answer.length > 0,
  type: 'checkbox',
  name: 'bver',
  message: 'Bver:',
  choices: ['stable', 'beta', 'unstable'],
  default: 'stable'
};

const topologyPrompt = {
  when: (answers) => answers.workflow === 'custom',
  type: 'checkbox',
  name: 'topology',
  message: 'Topology:',
  choices: ['group', 'peer-to-peer'],
  validate: answer => answer.length > 0,
  default: 'group',
};

const testFilesPrompt = {
  when: (answers) => answers.workflow === 'custom',
  type: 'input',
  name: 'test_files',
  message: 'Files to test against:',
  default: 'auto',
  validate: (val) => { return typeof val === 'string' && val.length > 3; }
};


// tag can be chosen only for backend workflow
const tagPrompt = {
  when: (answers) => answers.workflow === 'backend',
  type: 'input',
  name: 'tag',
  message: 'Tag to use (type branch name if you do not want to use tag):',
  default: '2.0.0-beta15',
  validate: (val) => { return typeof val === 'string' && val.length > 5; }
};


const confirmPrompt = {
  type: 'confirm',
  name: 'confirm',
  message: 'Confirm the build request:',
  default: true,
};

if (process.env.CIRCLECI_TOKEN) {
  tokenPrompt.default = process.env.CIRCLECI_TOKEN;
}

inquirer.prompt([
  tokenPrompt,
  workflowPrompt,
  branchPrompt,
  tagPrompt,
  environmentCheckboxPrompt,
  environmentListPrompt,
  browserPrompt,
  bverPrompt,
  topologyPrompt,
  stableTestsPrompt,
  testFilesPrompt
]).then(answers => {
  console.log('Will make a CI request with:', answers);

  // get basic values from answers.
  const { branch, token, workflow, tag, test_files } = answers;

  // make combo of possible multi-select (checkbox) values.
  var combo = ['browser', 'bver', 'environment', 'topology', 'test_stability'].reduce( (acc, dim) => {
    const dimValues = Array.isArray(answers[dim]) ?  answers[dim] : [answers[dim]];
    const result = [];
    acc.forEach(accElement => dimValues.forEach(dimValue => result.push({ ...accElement, [dim]: dimValue})));
    return result;
  }, [{ branch, token, workflow, tag, test_files }]);

  inquirer.prompt([confirmPrompt]).then(({ confirm }) => {
    if (confirm) {
      combo.map(build => {
        const {options, body} = generateBuildRequest(build);
        triggerBuild({options, body}).then((result) => {
          console.log(result);
        }).catch(e => console.log('Failed to trigger a build:', e));
      });
    }
  });
});


