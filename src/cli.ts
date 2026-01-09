#!/usr/bin/env node

import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { ingestCommand } from "./commands/ingest.js";
import { statsCommand } from "./commands/stats.js";
import { sampleCommand } from "./commands/sample.js";
import { labelTemplateCommand } from "./commands/labelTemplate.js";
import { publishCommand } from "./commands/publish.js";
import { versionsCommand } from "./commands/versions.js";
import { exportCommand } from "./commands/export.js";

const program = new Command();

program
  .name("goldenset")
  .description("Golden Dataset Management Tool")
  .version("1.0.0");

program.addCommand(initCommand());
program.addCommand(ingestCommand());
program.addCommand(statsCommand());
program.addCommand(sampleCommand());
program.addCommand(labelTemplateCommand());
program.addCommand(publishCommand());
program.addCommand(versionsCommand());
program.addCommand(exportCommand());

program.parse();

