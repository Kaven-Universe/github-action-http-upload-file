/********************************************************************
 * @author:      Kaven
 * @email:       kaven@wuwenkai.com
 * @website:     http://blog.kaven.xyz
 * @file:        [github-action-http-upload-file] /index.js
 * @create:      2021-11-18 21:09:32.138
 * @modify:      2021-11-19 21:04:31.988
 * @version:     1.0.1
 * @times:       13
 * @lines:       117
 * @copyright:   Copyright © 2021 Kaven. All Rights Reserved.
 * @description: [description]
 * @license:     [license]
 ********************************************************************/

const { existsSync, createReadStream, renameSync } = require("fs");
const { join, dirname } = require("path");

const core = require("@actions/core");
const github = require("@actions/github");

const FormData = require("form-data");
const { FileSize } = require("kaven-basic");


function logJson(data) {
    console.log(JSON.stringify(data, undefined, 2));
}

/**
 * 
 * @param {String} server 
 * @param {import("form-data")} form 
 */
function upload(server, form) {
    let progress = 0;

    // (available to req handler)
    const expectedLength = form._lastBoundary().length + form._overheadLength;

    const R = form.submit(server, function(err, res) {
        if (err) {
            core.setFailed(err.message);
        }

        console.log("statusCode:", res.statusCode);

        // unstuck new streams
        res.resume();
    });

    // augment into request
    const oWrite = R.write;
    R.write = function(chunk) {
        return oWrite.call(this, chunk, function() {
            form.emit("progress", chunk);
        });
    };

    // track progress
    form.on("progress", function(chunk) {
        progress += chunk.length;

        console.log(`progress: ${(progress / expectedLength).toFixed(2)}, ${FileSize(progress)} of ${FileSize(expectedLength)}`);
    });
}

try {
    // inputs defined in action metadata file
    const debug = core.getBooleanInput("debug");
    const server = core.getInput("server");
    const filedName = core.getInput("field-name");

    let file = core.getInput("file");
    let newFile = core.getInput("rename-file-to");

    if (debug) {
        logJson(process.env);

        console.log(__dirname, __filename);
    }

    if (!existsSync(file)) {
        if (debug) {
            file = __filename;
        } else {
            core.setFailed(`file not exists: ${file}`);
            return;
        }
    }

    if (newFile) {

        const dir = dirname(file);
        newFile = join(dir, newFile);

        renameSync(file, newFile);
        console.log(`rename ${file} to ${newFile}`);

        file = newFile;
    }

    const form = new FormData();
    form.append("runId", github.context.runId);
    form.append("runNumber", github.context.runNumber);
    form.append(filedName, createReadStream(file));

    upload(server, form);

    core.setOutput("file", file);

    // Get the JSON webhook payload for the event that triggered the workflow
    // const payload = JSON.stringify(github.context.payload, undefined, 2);
    // console.log(`The event payload: ${payload}`);
} catch (error) {
    core.setFailed(error.message);
}