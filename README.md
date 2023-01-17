# Scout Study 

This repository contains code to support running the Scout study and the resulting data that was collected.

The Scout tool can be found [here](https://github.com/nickbradley/scout).
The tool for running the study in VSCode is [here](https://github.com/nickbradley/toast).

## Data

### Gathering raw data

Raw study data from GitHub (`data/repos`) and Qualtrics (`data/survey-responses.tsv`) go here.

Add all valid repos to `data/repolist`.
You can then download the repos by running `yarn clone:repos` from the `./scripts`.

Download survey responses from the "Data and Analysis" tab of the [_Scout Evaluation_](https://ubc.yul1.qualtrics.com/responses/#/surveys/SV_29vvq6zg3DIivmS) survey on qualtrics. Click the dropdown next to "Add Filter" and choose "completed-tasks" which should filter the responses to 40. Click "Export & Import > Export Data..." Under the CSV option, uncheck "Download all fields" and click "Download". Note that the fields/columns in the Data and Analysis tab have already been selected to match the data to import in the Notebook. 

## Resources

A collection of random files and scripts to manage the study.

### Managing CodeSpaces (cs-cleaner)

GitHub only allows a maximum of 30 codespaces to be running at time.
Attempting to create a new codespace once the maximum has been reached results in a client error (e.g., when the survey attempts to provision a workspace).

This limit can be quickly reached as mechanical turk workers start the survey and provision a workspace only to drop out of the study.
To control this, I have created a small package `cs-cleaner` in `./resources` that gets the active codespaces from GitHub and deletes any that have not been used recently (configurable).
It is deployed on heroku as `enigmatic-brook-86776` and scheduled to run every 60 minutes.
See the [README.md](./resources/cs-cleaner/README.md) for deployment instructions.

### JavaScript for Survey pages (survey-pages)

Qualtrics strips HTML content (e.g., style tags) when saving.
Copy and paste the content of the files to ensure that the qualtrics pages work as expected.
