# Scout Study 

This repository contains code to support running the Scout study and the resulting data that was collected.

The Scout tool can be found [here]().
The tool for running the study in VSCode is [here]().


## Instruments

- `post-study-questions.txt` Survey questions asked once participants completed all of the tasks.
- `post-task-questions.txt` Questions asked in the IDE each time a participant completed each task.
- `prescreen-questions.txt` Questions used to screen workers on the Prolific and Mechanical Turk Platforms for JavaScript experience.

## Raw Data

`./data/raw/`

Archived participant GitHub repositories and survey responses.
The archive name corresponds to a random study identifier.

To download the repos, add their URLs to `./data/repolist` and run `yarn clone:repos` from `./data/scripts/`.

Download survey responses from the "Data and Analysis" tab of the [_Scout Evaluation_](https://ubc.yul1.qualtrics.com/responses/#/surveys/SV_29vvq6zg3DIivmS) survey on qualtrics. Click the dropdown next to "Add Filter" and choose "completed-tasks" which should filter the responses to 40. Click "Export & Import > Export Data..." Under the CSV option, uncheck "Download all fields" and click "Download". Note that the fields/columns in the Data and Analysis tab have already been selected to match the data to import in the Notebook. 


## Clean Data

`./data/clean/`

Data prepared for analysis.
The raw data is transformed by running `yarn make:datasets` from `./data/scripts/`. 


## Resources

A collection of random files and scripts to manage the study.


### JavaScript for Survey pages (survey-pages)

Qualtrics strips HTML content (e.g., style tags) when saving.
Copy and paste the content of the files to ensure that the qualtrics pages work as expected.
