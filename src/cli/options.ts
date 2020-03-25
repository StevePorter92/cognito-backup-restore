import * as AWS from 'aws-sdk';
import * as fuzzy from 'fuzzy';
import * as inquirer from 'inquirer';
import chalk from 'chalk';
import { argv } from './args';

inquirer.registerPrompt('directory', require('inquirer-select-directory'));
inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));
inquirer.registerPrompt('filePath', require('inquirer-file-path'));

const verifyOptions = async () => {
    let { mode, userpool, directory, file, password, passwordModulePath, delay } = argv;

    // choose the mode if not passed through CLI or invalid is passed
    if (!mode || !['restore', 'backup'].includes(mode)) {
        const modeChoice = await inquirer.prompt<{ selected: string }>({
            type: 'list',
            name: 'selected',
            message: 'Choose the mode',
            choices: ['Backup', 'Restore'],
        });

        mode = modeChoice.selected.toLowerCase();
    }

    if (!userpool) {
        // update the config of aws-sdk based on profile/credentials passed
        const cognitoISP = new AWS.CognitoIdentityServiceProvider();
        const { UserPools } = await cognitoISP.listUserPools({ MaxResults: 60 }).promise();
        // TODO: handle data.NextToken when exceeding the MaxResult limit

        const userPoolList = UserPools
            && UserPools.map(el => ({ name: el.Name || '', value: el.Id || '' })) || []

        if (!userPoolList.length)
            throw Error(`No userpool found in this region.`);

        if (mode === 'backup') userPoolList.unshift({ name: chalk.magentaBright.bold('ALL'), value: 'all' });

        const searchCognitoPool = async (_: never, input: string) => {
            input = input || '';

            const fuzzyResult = fuzzy.filter(input, userPoolList, { extract: el => el.value });
            return fuzzyResult.map(el => {
                return el.original
            });
        };

        // choose your cognito pool from the region you selected
        const cognitoPoolChoice = await inquirer.prompt({
            type: 'autocomplete',
            name: 'selected',
            message: 'Choose your Cognito Pool',
            source: searchCognitoPool,
            pageSize: 60
        } as inquirer.Question);

        userpool = cognitoPoolChoice.selected;
    };

    if (mode === 'backup' && !directory) {
        const directoryLocation = await inquirer.prompt({
            type: 'directory',
            name: 'selected',
            message: 'Choose your file destination',
            basePath: '.'
        } as inquirer.Question);

        directory = directoryLocation.selected;
    };

    if (mode === 'restore' && !file) {
        const fileLocation = await inquirer.prompt({
            type: 'filePath',
            name: 'selected',
            message: 'Choose the JSON file',
            basePath: '.'
        } as inquirer.Question);

        file = fileLocation.selected;
    }

    if (mode === 'restore' && passwordModulePath) {
        try {
            const pwdModule = require(passwordModulePath);
            if (typeof pwdModule.getPwdForUsername !== 'function') {
                throw Error(`Cannot find getPwdForUsername(username: String) in password module "${passwordModulePath}".`);
            };
        } catch(e) {
            throw Error(`Cannot load password module path "${passwordModulePath}".`);
        }
    }
    return { mode, userpool, directory, file, password, passwordModulePath, delay }
};


export const options = verifyOptions();
