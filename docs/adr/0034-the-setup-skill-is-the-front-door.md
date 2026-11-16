# The setup skill is the front door

One install line is the front door for getting started with `traj`: the setup skill, `traj-onboarding` from `trajectonomics/skills`. Every surface that tells a person how to begin names it first, and the operator skill, `traj` from `trajectonomics/internal-skills`, is the second line for an agent whose setup is already done. `trajectonomics/skills` already states the setup line; this repository's README follows it, and the docs portal follows when it next edits its installation page.

The two lines do different jobs and both stay. `traj-onboarding` asks for a person's situation and goal, installs the operating skill in the same scope it was installed in, and hands the conversation over; the operating skill is what an agent loads on every later conversation about money. A README that names only the operator skill leaves a stranger with an agent that knows how to run commands and no setup, and a README that names only the setup skill makes a person who keeps several agents re-run onboarding to add one. Order is the decision: the first command is the one a stranger runs.

## Considered options

Naming both lines without an order was rejected because two equal commands are not a front door, and a stranger picks one at random. Naming only the setup skill was rejected because the operator-only path is real and cheap to state in one sentence. Moving the setup line out of this README into the skills repository's page was rejected because the README's `## Install` section is where a new user already is, and the issue that produced this ADR (cli#121) found the two repositories disagreeing precisely because each named a different skill.

## Consequences

This repository's README carries two skill commands and one sentence distinguishing them, and the first one is the setup skill. Changing which skill is the front door is a pull request that edits this ADR and every install section that states the line, so the surfaces cannot drift apart again one at a time. The setup skill states its own floor for the command line it assumes (`trajectonomics/skills` ADR-0002); this ADR does not restate that number, and the release markers of ADR-0033 are how this repository says which release ships what its own pages describe.
